

import {
    Engine,
    EngineEventEmitter,
    DescribeOptions,
    RunOptions,
    RuleDescription,
    EngineRunResults,
    Violation,
    CodeLocation,
    Fix,
    Suggestion,
    LogLevel
} from '@salesforce/code-analyzer-engine-api';
import { ApexGuruService } from './services/ApexGuruService';
import { ApexGuruViolation, ApexGuruLocation, ApexGuruFix, ApexGuruSuggestion } from './types';
import { ApexGuruEngineConfig, DEFAULT_APEXGURU_ENGINE_CONFIG } from './config';
import { ENGINE_NAME, APEXGURU_FILE_EXTENSIONS } from './constants';
import { APEXGURU_RULES, isKnownRule, FALLBACK_RULE_NAME } from './apexguru-rules';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * ApexGuru Engine implementation
 * Analyzes Apex classes using Salesforce ApexGuru APIs
 */
export class ApexGuruEngine extends EngineEventEmitter implements Engine {
    private readonly apexGuruService: ApexGuruService;
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

        // Check if targeted files contain any Apex files
        if (describeOptions.workspace) {
            const targetedFiles = await describeOptions.workspace.getTargetedFiles();
            const hasApexFiles = targetedFiles.some(file => this.isApexFile(path.basename(file)));

            if (!hasApexFiles) {
                this.emitLogEvent(LogLevel.Debug, 'No Apex files in target set. Returning no ApexGuru rules.');
                this.emitDescribeRulesProgressEvent(100);
                return [];
            }
        }

        // ApexGuru is dynamic - new rules can be added by Salesforce at any time.
        // We declare known rules explicitly (in apexguru-rules.ts), plus a fallback rule.
        // Unknown violations from the API will be mapped to "apexguru-other".
        this.emitDescribeRulesProgressEvent(100);

        return APEXGURU_RULES;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        // Short-circuit if no rules selected - avoid unnecessary auth/network calls
        if (ruleNames.length === 0) {
            return { violations: [] };
        }

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
        try {
            await this.apexGuruService.validate();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to validate ApexGuru access: ${message}`);
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

                    const violations = apexGuruViolations.map(av =>
                        toViolation(av, filePath, runOptions.includeFixes ?? false, runOptions.includeSuggestions ?? false)
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
        // Return target_org from config (set via CLI --target-org flag or config file)
        // If undefined, ApexGuruAuthService will use default SF CLI org
        return this.config.target_org;
    }

}

/**
 * Convert ApexGuru violation to Code Analyzer violation format
 *
 * Note: Violations do not include severity/tags in Code Analyzer's data model.
 * Severity and tags are defined in RuleDescription (from describeRules()).
 *
 * For unknown rules (not in apexguru-rules.ts), violations are mapped to the
 * fallback rule "apexguru-other" to ensure Core validation passes.
 */
function toViolation(
    av: ApexGuruViolation,
    filePath: string,
    includeFixes: boolean,
    includeSuggestions: boolean
): Violation {
    // Map unknown rules to fallback to ensure Core validation passes
    const ruleName = isKnownRule(av.rule) ? av.rule : FALLBACK_RULE_NAME;

    const violation: Violation = {
        ruleName,
        message: av.message,
        codeLocations: av.locations.map(loc => normalizeLocation(loc, filePath)),
        primaryLocationIndex: av.primaryLocationIndex,
        resourceUrls: av.resources
    };

    // Add fixes if requested and available
    if (includeFixes && av.fixes?.length) {
        violation.fixes = av.fixes.map(fix => toFix(fix, filePath));
    }

    // Add suggestions if requested and available
    if (includeSuggestions && av.suggestions?.length) {
        violation.suggestions = av.suggestions.map(suggestion => toSuggestion(suggestion, filePath));
    }

    return violation;
}

/**
 * Convert ApexGuru fix to Code Analyzer Fix format
 * Note: ApexGuru API does not currently return fixes, only suggestions
 */
function toFix(apexGuruFix: ApexGuruFix, filePath: string): Fix {
    return {
        location: normalizeLocation(apexGuruFix.location, filePath),
        fixedCode: apexGuruFix.fixedCode
    };
}

/**
 * Convert ApexGuru suggestion to Code Analyzer Suggestion format
 * Note: suggestion.message contains "// explanation\ncode" - we keep it as-is
 */
function toSuggestion(apexGuruSuggestion: ApexGuruSuggestion, filePath: string): Suggestion {
    return {
        location: normalizeLocation(apexGuruSuggestion.location, filePath),
        message: apexGuruSuggestion.message  // Keep "// explanation\ncode" as-is
    };
}

/**
 * Normalize location by filling in required fields
 *
 * ApexGuru API only provides:
 * - startLine (required)
 * - comment (optional)
 *
 * We fill in:
 * - file (required by Code Analyzer, not in ApexGuru response)
 * - startColumn = 1 (required by Code Analyzer, reasonable default)
 * - endLine/endColumn are left undefined (optional fields)
 */
function normalizeLocation(location: ApexGuruLocation, filePath: string): CodeLocation {
    const startLine = location.startLine ?? 1;
    const startColumn = location.startColumn ?? 1;  // Default to column 1 if not provided

    return {
        file: filePath,
        startLine,
        startColumn,
        endLine: location.endLine,      // undefined if not provided (optional)
        endColumn: location.endColumn,  // undefined if not provided (optional)
        comment: location.comment
    };
}
