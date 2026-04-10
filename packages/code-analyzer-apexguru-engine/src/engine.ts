

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

        // Check if workspace has any Apex files (following SFGE pattern)
        if (describeOptions.workspace) {
            const workspaceFiles = await describeOptions.workspace.getWorkspaceFiles();
            const hasApexFiles = workspaceFiles.some(file => this.isApexFile(path.basename(file)));

            if (!hasApexFiles) {
                this.emitLogEvent(LogLevel.Debug, 'No Apex files found in workspace. Returning no ApexGuru rules.');
                this.emitDescribeRulesProgressEvent(100);
                return [];
            }
        }

        // ApexGuru is dynamic - new rules can be added by Salesforce at any time.
        // We declare known rules explicitly (in apexguru-rules.ts), plus a fallback rule.
        // Unknown violations from the API will be mapped to "apexguru-other" by ViolationMapper.
        this.emitDescribeRulesProgressEvent(100);

        return APEXGURU_RULES;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        // Note: ApexGuru API analyzes code and returns ALL detected violations.
        // Individual rules cannot be enabled/disabled via the API.
        // We filter violations to match the selected rules after analysis completes.

        // Create a Set for faster rule name lookup
        const selectedRulesSet = new Set(ruleNames);

        // Extract targetOrg from environment
        const targetOrg = this.getTargetOrgFromEnvironment();

        // Initialize authentication
        try {
            await this.apexGuruService.initialize(targetOrg);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Failed to authenticate: ${message}\n` +
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
            this.apexGuruService.cleanup(); // Cleanup even on early return
            return { violations: [] };
        }

        try {
            // Analyze each file
            const allViolations: Violation[] = [];
            let filesProcessed = 0;

            for (let i = 0; i < apexFiles.length; i++) {
                const filePath = apexFiles[i];

                try {
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

                    const violations = this.violationMapper.mapViolations(
                        apexGuruViolations,
                        filePath,
                        runOptions.includeSuggestions ?? false
                    );

                    // Filter violations to only include selected rules
                    const filteredViolations = violations.filter(v => selectedRulesSet.has(v.ruleName));
                    allViolations.push(...filteredViolations);

                    if (violations.length !== filteredViolations.length) {
                        this.emitLogEvent(
                            LogLevel.Fine,
                            `Filtered ${violations.length - filteredViolations.length} violation(s) for unselected rules`
                        );
                    }

                    filesProcessed++;
                    const endProgress = (filesProcessed / apexFiles.length) * 100;
                    this.emitRunRulesProgressEvent(endProgress);
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.emitLogEvent(
                        LogLevel.Warn,
                        `Failed to analyze ${path.basename(filePath)}: ${message}`
                    );
                    // Continue with other files
                }
            }

            return { violations: allViolations };
        } finally {
            // Always cleanup resources to allow process to exit
            this.apexGuruService.cleanup();
        }
    }

    /**
     * Check if file is an Apex file based on extension
     */
    private isApexFile(fileName: string): boolean {
        return APEXGURU_FILE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * Extract target org from environment
     * Note: Workspace does not currently expose org configuration through the Engine API.
     * Target org can be set via SF_TARGET_ORG environment variable.
     */
    private getTargetOrgFromEnvironment(): string | undefined {
        // Check environment variable
        if (process.env.SF_TARGET_ORG) {
            return process.env.SF_TARGET_ORG;
        }

        // Return undefined to use default org from SF CLI
        return undefined;
    }

}
