import path from 'node:path';
import * as fs from 'node:fs/promises';
import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    Violation
} from '@salesforce/code-analyzer-engine-api';
import { ENGINE_NAME } from './constants';
import { FlowAnalyzerEngineConfig } from './config';
import { getMessage } from './messages';
import { CollectedFlowFile, FlowAnalyzerFinding } from './types';
import { FlowAnalyzerAuthService } from './services/FlowAnalyzerAuthService';
import { FlowAnalyzerApiClient } from './services/FlowAnalyzerApiClient';
import { FlowFileCollector } from './services/FlowFileCollector';
import { FindingLocationMapper } from './services/FindingLocationMapper';

export class FlowAnalyzerEngine extends Engine {
    static readonly NAME = ENGINE_NAME;

    private readonly config: FlowAnalyzerEngineConfig;
    private readonly authService: FlowAnalyzerAuthService;
    private readonly apiClient: FlowAnalyzerApiClient;
    private readonly fileCollector: FlowFileCollector;
    private readonly locationMapper: FindingLocationMapper;
    private catalogCache?: RuleDescription[];

    constructor(
        config: FlowAnalyzerEngineConfig,
        dependencies?: {
            authService?: FlowAnalyzerAuthService;
            apiClient?: FlowAnalyzerApiClient;
            fileCollector?: FlowFileCollector;
            locationMapper?: FindingLocationMapper;
        }
    ) {
        super();
        this.config = config;
        this.authService = dependencies?.authService ?? new FlowAnalyzerAuthService(this.emitLogEvent.bind(this));
        this.apiClient = dependencies?.apiClient ?? new FlowAnalyzerApiClient(
            this.authService,
            config.api_timeout_ms,
            config.api_version,
            config.rules_path,
            config.analyze_path,
            this.emitLogEvent.bind(this)
        );
        this.fileCollector = dependencies?.fileCollector ?? new FlowFileCollector(
            config.max_file_count,
            config.max_file_bytes,
            config.max_payload_bytes
        );
        this.locationMapper = dependencies?.locationMapper ?? new FindingLocationMapper();
    }

    getName(): string {
        return FlowAnalyzerEngine.NAME;
    }

    async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: { version: string } = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        if (describeOptions.workspace) {
            const collected = await this.fileCollector.collect(describeOptions.workspace);
            if (collected.length === 0) {
                this.emitLogEvent(LogLevel.Debug, getMessage('NoFlowFiles'));
                this.emitDescribeRulesProgressEvent(100);
                return [];
            }
        }

        await this.ensureAuthenticated();
        this.emitDescribeRulesProgressEvent(50);
        try {
            this.catalogCache = await this.apiClient.describeRules();
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            this.emitLogEvent(LogLevel.Error, getMessage('CatalogUnavailable', detail));
            this.emitDescribeRulesProgressEvent(100);
            return [];
        }
        this.emitDescribeRulesProgressEvent(100);
        return this.catalogCache;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        if (ruleNames.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        const collected = await this.fileCollector.collect(runOptions.workspace);
        if (collected.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        try {
            await this.ensureAuthenticated();
            this.emitRunRulesProgressEvent(20);

            const catalog = this.catalogCache ?? await this.apiClient.describeRules();
            this.catalogCache = catalog;
            const catalogNames = new Set(catalog.map(rule => rule.name));
            const selectedRules = new Set(ruleNames);

            this.emitRunRulesProgressEvent(40);
            const findings = await this.apiClient.analyze(collected, { rules: ruleNames });
            this.emitRunRulesProgressEvent(80);

            const submittedPaths = new Map(collected.map(file => [file.relativeFilePath, file]));
            const violations: Violation[] = [];
            for (const finding of findings) {
                this.assertFindingContract(finding, catalogNames, submittedPaths);
                const findingRule = finding.ruleId || finding.ruleName;
                if (!selectedRules.has(findingRule)) {
                    continue;
                }
                const collectedFile = submittedPaths.get(finding.relativeFilePath)!;
                const location = this.locationMapper.map(finding, collectedFile);
                violations.push({
                    ruleName: findingRule,
                    message: finding.message,
                    codeLocations: [location],
                    primaryLocationIndex: 0,
                    resourceUrls: []
                });
            }

            this.emitRunRulesProgressEvent(100);
            return { violations };
        } catch (err) {
            return this.skipWithError(err);
        }
    }

    private skipWithError(error: unknown): EngineRunResults {
        const detail = error instanceof Error ? error.message : String(error);
        this.emitLogEvent(LogLevel.Error, detail);
        this.emitRunRulesProgressEvent(100);
        return {
            violations: [],
            insights: {
                status: 'skipped',
                error: {
                    code: 'FLOW_ANALYZER_UNAVAILABLE',
                    message: detail,
                    remediation: getMessage('CatalogUnavailableRemediation')
                }
            }
        };
    }

    private async ensureAuthenticated(): Promise<void> {
        await this.authService.initialize({ targetOrg: this.config.target_org });
    }

    private assertFindingContract(
        finding: FlowAnalyzerFinding,
        catalogNames: Set<string>,
        submittedPaths: Map<string, CollectedFlowFile>
    ): void {
        const findingRule = finding.ruleId || finding.ruleName;
        if (!catalogNames.has(findingRule)) {
            throw new Error(getMessage('UnknownRuleInFindings', findingRule));
        }
        if (!submittedPaths.has(finding.relativeFilePath)) {
            throw new Error(getMessage('PathNotSubmitted', finding.relativeFilePath));
        }
    }
}
