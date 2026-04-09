

import {
    Engine,
    EngineEventEmitter,
    DescribeOptions,
    RunOptions,
    RuleDescription,
    EngineRunResults,
    Violation,
    LogLevel
} from '@salesforce/code-analyzer-engine-api';
import { ApexGuruService } from './services/ApexGuruService';
import { ViolationMapper } from './mappers/ViolationMapper';
import { ApexGuruViolation } from './types';
import { ApexGuruEngineConfig, DEFAULT_APEXGURU_ENGINE_CONFIG } from './config';
import { ENGINE_NAME, APEXGURU_FILE_EXTENSIONS } from './constants';
import { APEXGURU_RULES } from './apexguru-rules';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * ApexGuru Engine implementation
 * Analyzes Apex classes using Salesforce ApexGuru APIs
 */
export class ApexGuruEngine extends EngineEventEmitter implements Engine {
    private readonly apexGuruService: ApexGuruService;
    private readonly violationMapper: ViolationMapper;
    private readonly config: ApexGuruEngineConfig;

    constructor(config: ApexGuruEngineConfig = DEFAULT_APEXGURU_ENGINE_CONFIG) {
        super();
        this.config = config;
        this.apexGuruService = new ApexGuruService(
            this.emitLogEvent.bind(this),
            config.api_timeout_ms,
            config.api_initial_retry_ms,
            config.api_max_retry_ms,
            config.api_backoff_multiplier
        );
        this.violationMapper = new ViolationMapper();
    }

    getName(): string {
        return ENGINE_NAME;
    }

    async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        this.emitLogEvent(LogLevel.Fine, 'Returning known ApexGuru rules plus fallback for new rules');

        // ApexGuru is dynamic - new rules can be added by Salesforce at any time.
        // We declare known rules explicitly (in apexguru-rules.ts), plus a fallback rule.
        // Unknown violations from the API will be mapped to "apexguru-other" by ViolationMapper.
        this.emitDescribeRulesProgressEvent(100);

        return APEXGURU_RULES;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        // Note: ruleNames parameter is ignored. ApexGuru API analyzes code and returns
        // all detected violations. Individual rules cannot be enabled/disabled.
        // This is by design - ApexGuru determines which rules to apply dynamically.

        this.emitLogEvent(LogLevel.Info, 'Starting ApexGuru analysis...');

        // Extract targetOrg from workspace (if available)
        const targetOrg = this.getTargetOrgFromWorkspace(runOptions);

        // Initialize authentication
        try {
            await this.apexGuruService.initialize(targetOrg);
        } catch (error: any) {
            throw new Error(
                `Failed to authenticate: ${error.message}\n` +
                'Please authenticate with: sf org login web'
            );
        }

        // Validate ApexGuru access
        const hasAccess = await this.apexGuruService.validate();
        if (!hasAccess) {
            throw new Error(
                'ApexGuru is not available for this org.\n' +
                'Please check that ApexGuru is enabled and you have the required permissions.'
            );
        }

        // Get targeted files from workspace and filter for Apex files
        const targetedFiles = await runOptions.workspace.getTargetedFiles();
        const apexFiles = targetedFiles.filter(file => this.isApexFile(path.basename(file)));

        if (apexFiles.length === 0) {
            this.emitLogEvent(LogLevel.Warn, 'No Apex class files found to analyze');
            return { violations: [] };
        }

        this.emitLogEvent(LogLevel.Info, `Found ${apexFiles.length} Apex class(es) to analyze`);

        // Analyze each file
        const allViolations: Violation[] = [];
        let filesProcessed = 0;

        for (let i = 0; i < apexFiles.length; i++) {
            const filePath = apexFiles[i];

            try {
                this.emitLogEvent(LogLevel.Fine, `Analyzing: ${filePath}`);

                // Emit progress at start of file
                const baseProgress = (filesProcessed / apexFiles.length) * 100;
                this.emitRunRulesProgressEvent(baseProgress);

                // Set up progress callback for polling
                // Each file gets a slice of the total progress (0-95% of that slice during polling)
                const progressSlicePerFile = 100 / apexFiles.length;
                this.apexGuruService.setProgressCallback((pollingProgress: number) => {
                    // Map polling progress (0-95) to this file's slice
                    const fileProgress = baseProgress + (pollingProgress / 100) * progressSlicePerFile;
                    this.emitRunRulesProgressEvent(fileProgress);
                });

                const fileContent = await fs.readFile(filePath, 'utf-8');
                const apexGuruViolations: ApexGuruViolation[] = await this.apexGuruService.analyzeApexClass(
                    fileContent,
                    filePath
                );

                const violations = this.violationMapper.mapViolations(apexGuruViolations, filePath);
                allViolations.push(...violations);

                filesProcessed++;
                const endProgress = (filesProcessed / apexFiles.length) * 100;
                this.emitRunRulesProgressEvent(endProgress);

                this.emitLogEvent(
                    LogLevel.Fine,
                    `Found ${violations.length} violation(s) in ${path.basename(filePath)}`
                );
            } catch (error: any) {
                this.emitLogEvent(
                    LogLevel.Warn,
                    `Failed to analyze ${path.basename(filePath)}: ${error.message}`
                );
                // Continue with other files
            }
        }

        this.emitLogEvent(LogLevel.Info, `ApexGuru analysis complete. Total violations: ${allViolations.length}`);

        return { violations: allViolations };
    }

    /**
     * Check if file is an Apex file based on extension
     */
    private isApexFile(fileName: string): boolean {
        return APEXGURU_FILE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * Extract target org from workspace or environment
     */
    private getTargetOrgFromWorkspace(runOptions: RunOptions): string | undefined {
        // Try to get from workspace config
        // This is a placeholder - actual implementation depends on how RunOptions exposes config
        const workspace = runOptions.workspace as any;

        // Check if workspace has org config
        if (workspace.targetOrg) {
            return workspace.targetOrg;
        }

        // Check environment variable
        if (process.env.SF_TARGET_ORG) {
            return process.env.SF_TARGET_ORG;
        }

        // Return undefined to use default org
        return undefined;
    }

}
