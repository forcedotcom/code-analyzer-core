

import {
    Engine,
    EngineEventEmitter,
    DescribeOptions,
    RunOptions,
    RuleDescription,
    EngineRunResults,
    Violation,
    CodeLocation,
    Suggestion,
    LogLevel
} from '@salesforce/code-analyzer-engine-api';
import { ApexGuruService } from './services/ApexGuruService';
import { ApexGuruViolation, ApexGuruLocation, ApexGuruSuggestion } from './types';
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

        // Note: SFAP ApexGuru API analyzes entire workspace and returns ALL detected violations.
        // Individual rules cannot be enabled/disabled via the API.
        // We filter violations to match the selected rules after analysis completes.

        // Create a Set for faster rule name lookup
        const selectedRulesSet = new Set(ruleNames);

        // Get target org alias/username from config (passed by CLI --target-org flag)
        const targetOrg = this.getTargetOrg();

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

        // Get workspace root path
        const workspaceRoot = runOptions.workspace.getWorkspaceRoot();

        // Get targeted files to verify we have Apex files
        const targetedFiles = await runOptions.workspace.getTargetedFiles();
        const apexFiles = targetedFiles.filter(file => this.isApexFile(path.basename(file)));

        if (apexFiles.length === 0) {
            this.emitLogEvent(LogLevel.Warn, 'No Apex class files found to analyze');
            this.apexGuruService.cleanup();
            return { violations: [] };
        }

        // Workspace root is null when files come from different drives/roots — ApexGuru requires a single zip
        if (!workspaceRoot) {
            this.apexGuruService.cleanup();
            throw new Error('ApexGuru requires a common workspace root, but the targeted files do not share one.');
        }

        // If the user passed --target, zip only those paths; otherwise zip the whole workspace.
        const pathsToZip = runOptions.workspace.getRawTargets() ?? [workspaceRoot];

        try {
            // Set up progress callback for polling
            this.apexGuruService.setProgressCallback((pollingProgress: number) => {
                this.emitRunRulesProgressEvent(pollingProgress);
            });

            // Scan (creates zip -> submits -> polls -> decodes)
            const { violations: apexGuruViolations, scanMetadata } = await this.apexGuruService.scanWorkspace(workspaceRoot, pathsToZip);

            // Convert all ApexGuru violations to Code Analyzer format
            const allViolations = apexGuruViolations.map(av => {
                // SFAP response includes file path in location.file
                const filePath = av.locations[0]?.file ?? 'unknown';
                return toViolation(av, filePath, runOptions.includeSuggestions ?? false);
            });

            // Filter violations to only include selected rules
            const filteredViolations = allViolations.filter(v => selectedRulesSet.has(v.ruleName));

            if (allViolations.length !== filteredViolations.length) {
                this.emitLogEvent(
                    LogLevel.Fine,
                    `Filtered ${allViolations.length - filteredViolations.length} violation(s) for unselected rules`
                );
            }

            // Return insights as scan metadata (workspace-level)
            const insights: Record<string, unknown> | undefined = scanMetadata ? { scan: scanMetadata } : undefined;

            return { violations: filteredViolations, insights };
        } finally {
            // Always cleanup resources
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
     * Get the target org alias/username from engine config.
     * The CLI passes this through as a plain string (alias or username).
     * Core resolves credentials internally via @salesforce/core.
     * If undefined, ApexGuruAuthService will fall back to the default SF CLI org.
     */
    private getTargetOrg(): string | undefined {
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

    // Add suggestions if requested and available
    if (includeSuggestions && av.suggestions?.length) {
        violation.suggestions = av.suggestions.map(suggestion => toSuggestion(suggestion, filePath));
    }

    return violation;
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
 * SFAP ApexGuru API provides:
 * - file (from SFAP response, workspace-relative path)
 * - startLine (required)
 * - comment (optional)
 *
 * We fill in:
 * - startColumn = 1 (required by Code Analyzer, reasonable default if not provided)
 * - Use file from location if provided, else use filePath parameter
 * - endLine/endColumn are left undefined (optional fields)
 */
function normalizeLocation(location: ApexGuruLocation, filePath: string): CodeLocation {
    const startLine = location.startLine ?? 1;
    const startColumn = location.startColumn ?? 1;  // Default to column 1 if not provided

    return {
        file: location.file ?? filePath,  // SFAP includes file path in response
        startLine,
        startColumn,
        endLine: location.endLine,      // undefined if not provided (optional)
        endColumn: location.endColumn,  // undefined if not provided (optional)
        comment: location.comment
    };
}
