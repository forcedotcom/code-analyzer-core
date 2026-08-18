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
import { existsSync } from 'node:fs';
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

        // Initialize authentication — skip gracefully if user is not authenticated
        try {
            await this.apexGuruService.initialize(targetOrg);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.apexGuruService.cleanup();
            if (this.isInvalidSessionError(error)) {
                return this.skipWithError('INVALID_SESSION',
                    'Code Analyzer skipped ApexGuru scan because your org session is invalid or expired. (401 Unauthorized: invalid session).\n' +
                    'Re-authenticate: sf org login web\n' +
                    'Then run the scan again.',
                    '');
            }
            return this.skipWithError('NO_ORG_CONNECTION',
                detail,
                "Please authenticate with 'sf org login web' or pass --target-org");
        }

        // Get workspace root path
        const workspaceRoot = runOptions.workspace.getWorkspaceRoot();

        // Get targeted files to verify we have Apex files
        const targetedFiles = await runOptions.workspace.getTargetedFiles();
        const apexFiles = targetedFiles.filter(file => this.isApexFile(path.basename(file)));

        if (apexFiles.length === 0) {
            this.apexGuruService.cleanup();
            return { violations: [] };
        }

        // Workspace root is null when files come from different drives/roots — ApexGuru requires a single zip
        if (!workspaceRoot) {
            this.apexGuruService.cleanup();
            throw new Error('ApexGuru requires a common workspace root, but the targeted files do not share one.');
        }

        // Zip only the Apex files the user actually targeted (via --target or the workspace itself).
        // Entry names are computed relative to workspaceRoot in createWorkspaceZip so project layout is preserved.
        const pathsToZip = apexFiles;

        // TEMP DIAGNOSTIC: log the exact set of files being zipped and shipped to SFAP.
        // Pair this with the [apexguru-diag] "Raw SFAP violation paths" log to confirm
        // that only what we zipped comes back in violations. Remove once verified.
        this.emitLogEvent(LogLevel.Fine,
            `[apexguru-diag] Zipping ${pathsToZip.length} file(s) for SFAP: ${JSON.stringify(pathsToZip)}`);

        try {
            // Set up progress callback for polling
            this.apexGuruService.setProgressCallback((pollingProgress: number) => {
                this.emitRunRulesProgressEvent(pollingProgress);
            });

            // Scan (creates zip -> submits -> polls -> decodes)
            const { violations: apexGuruViolations, scanMetadata, analysisMode } = await this.apexGuruService.scanWorkspace(workspaceRoot, pathsToZip);

            // TEMP DIAGNOSTIC: dump the raw file paths ApexGuru returned so we can see
            // exactly what SFAP is sending back (inner-class notation? relative? absolute?).
            // Remove once the "file does not exist" edge case is fully understood.
            const rawFilePaths = apexGuruViolations.map(av => ({
                rule: av.rule,
                file: av.locations[av.primaryLocationIndex]?.file ?? av.locations[0]?.file,
                startLine: av.locations[av.primaryLocationIndex]?.startLine ?? av.locations[0]?.startLine
            }));
            this.emitLogEvent(LogLevel.Fine,
                `[apexguru-diag] Raw SFAP violation paths (${rawFilePaths.length}): ${JSON.stringify(rawFilePaths)}`);

            // SFAP normalizes the paths it returns — it strips the longest common leading directory
            // shared by all files in the zip. e.g. if we zip `unpackaged/config/foo.cls` and
            // `unpackaged/config/bar.cls`, SFAP returns `foo.cls` and `bar.cls`. Reconstruct the
            // real absolute path by matching each returned path as a suffix of what we actually zipped.
            const resolveReturnedPath = (returnedFile: string | undefined): string | undefined => {
                if (!returnedFile) return undefined;
                const normalized = returnedFile.replace(/\\/g, '/');
                const match = pathsToZip.find(absPath => {
                    const absNormalized = absPath.replace(/\\/g, '/');
                    return absNormalized === normalized || absNormalized.endsWith(`/${normalized}`);
                });
                return match;
            };

            // Convert all ApexGuru violations to Code Analyzer format
            const allViolations = apexGuruViolations.map(av => {
                const returnedFile = av.locations[av.primaryLocationIndex]?.file ?? av.locations[0]?.file;
                const resolvedFile = resolveReturnedPath(returnedFile) ?? returnedFile ?? 'unknown';
                return toViolation(av, resolvedFile, workspaceRoot, runOptions.includeSuggestions ?? false, resolveReturnedPath);
            });

            // Drop violations whose primary code location points at a non-existent file.
            // Safety net for edge cases the suffix-match couldn't resolve (e.g. synthetic paths
            // like inner-class notation `Foo.InnerHelper.cls`) so we never hand Core a bad path.
            const validViolations = allViolations.filter(v => {
                const file = v.codeLocations[v.primaryLocationIndex]?.file;
                if (file && existsSync(file)) {
                    return true;
                }
                this.emitLogEvent(LogLevel.Warn,
                    `Dropping ${v.ruleName} violation: primary location file does not exist on disk: ${file ?? '(missing)'}`);
                return false;
            });

            // Filter violations to only include selected rules
            const filteredViolations = validViolations.filter(v => selectedRulesSet.has(v.ruleName));

            // Return insights with status: "completed", analysis mode, and scan metadata
            const insights: Record<string, unknown> = {
                status: 'completed',
                ...(analysisMode ? { analysisMode } : {}),
                ...(scanMetadata ? { scan: scanMetadata } : {})
            };

            return { violations: filteredViolations, insights };
        } catch (error) {
            // Catch API failures (5xx, timeout, connection refused) and unexpected errors
            const detail = error instanceof Error ? error.message : String(error);
            if (this.isScanTimeoutError(error)) {
                return this.skipWithError('SCAN_TIMEOUT',
                    `Code Analyzer skipped ApexGuru scan because the workspace scan timed out after ${formatSeconds(this.config.api_timeout_ms)}. ` +
                    'Increase the timeout setting in the Code Analyzer configuration file.',
                    '');
            }
            if (this.isApiUnavailableError(error)) {
                return this.skipWithError('API_UNAVAILABLE',
                    'Code Analyzer skipped ApexGuru scan because the service is unavailable right now. ' +
                    'Try again later. If the issue persists, contact Salesforce Support.',
                    '');
            }
            return this.skipWithError('UNEXPECTED_ERROR',
                `An unexpected error occurred: ${detail}`,
                'An unexpected error occurred. Please try again or file a support ticket if the issue persists.');
        } finally {
            // Always cleanup resources
            this.apexGuruService.cleanup();
        }
    }

    /**
     * Returns a graceful skip result with structured error insights.
     * Emits a warn-level log event and completes progress before returning.
     * NOTE: Caller is responsible for cleanup() — do NOT call cleanup here since
     * this may be invoked from within a try-finally that already handles cleanup.
     */
    private skipWithError(code: string, message: string, remediation: string): EngineRunResults {
        this.emitLogEvent(LogLevel.Warn, message);
        this.emitRunRulesProgressEvent(100);
        return {
            violations: [],
            insights: {
                status: 'skipped',
                error: { code, message, remediation }
            }
        };
    }

    /**
     * Determines whether an error is an invalid/expired org session (401 Unauthorized).
     * Surfaces from the Org JWT minting step during initialize() when the org access
     * token is no longer valid.
     */
    private isInvalidSessionError(error: unknown): boolean {
        if (!(error instanceof Error)) return false;
        const msg = error.message.toLowerCase();
        return msg.includes('401') || msg.includes('invalid session') || msg.includes('session id');
    }

    /**
     * Determines whether an error is the workspace scan timeout raised by ApexGuruService
     * when the scan exceeds the configured api_timeout_ms.
     */
    private isScanTimeoutError(error: unknown): boolean {
        return error instanceof Error && error.message.includes('Workspace scan timed out');
    }

    /**
     * Determines whether an error is an API unavailability issue (network/timeout/5xx).
     */
    private isApiUnavailableError(error: unknown): boolean {
        if (!(error instanceof Error)) return false;
        const msg = error.message.toLowerCase();
        const networkIndicators = ['econnrefused', 'etimedout', 'enotfound', 'socket hang up',
            'connection refused', 'timeout', 'network', '502', '503', '504', '500'];
        return networkIndicators.some(indicator => msg.includes(indicator));
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


function formatSeconds(ms: number): string {
    const seconds = ms / 1000;
    // Drop the trailing ".0" for whole numbers, keep up to 1 decimal otherwise.
    const rounded = Number.isInteger(seconds) ? seconds : Math.round(seconds * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'second' : 'seconds'}`;
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
    workspaceRoot: string,
    includeSuggestions: boolean,
    resolveReturnedPath: (returnedFile: string | undefined) => string | undefined
): Violation {
    // Map unknown rules to fallback to ensure Core validation passes
    const ruleName = isKnownRule(av.rule) ? av.rule : FALLBACK_RULE_NAME;

    const violation: Violation = {
        ruleName,
        message: av.message,
        codeLocations: av.locations.map(loc => normalizeLocation(loc, filePath, workspaceRoot, resolveReturnedPath)),
        primaryLocationIndex: av.primaryLocationIndex,
        resourceUrls: av.resources
    };

    // Add suggestions if requested and available
    if (includeSuggestions && av.suggestions?.length) {
        violation.suggestions = av.suggestions.map(suggestion => toSuggestion(suggestion, filePath, workspaceRoot, resolveReturnedPath));
    }

    return violation;
}

/**
 * Convert ApexGuru suggestion to Code Analyzer Suggestion format
 * Note: suggestion.message contains "// explanation\ncode" - we keep it as-is
 */
function toSuggestion(
    apexGuruSuggestion: ApexGuruSuggestion,
    filePath: string,
    workspaceRoot: string,
    resolveReturnedPath: (returnedFile: string | undefined) => string | undefined
): Suggestion {
    return {
        location: normalizeLocation(apexGuruSuggestion.location, filePath, workspaceRoot, resolveReturnedPath),
        message: apexGuruSuggestion.message  // Keep "// explanation\ncode" as-is
    };
}

/**
 * Normalize location by filling in required fields
 *
 * SFAP ApexGuru API provides:
 * - file (from SFAP response, path normalized against zip contents — may have common leading dirs stripped)
 * - startLine (required)
 * - comment (optional)
 *
 * We fill in:
 * - startColumn = 1 (required by Code Analyzer, reasonable default if not provided)
 * - Prefer the fallback filePath (already resolved via suffix-match against zipped files);
 *   if the location's own file matches a zipped path by suffix, use that instead
 * - Resolve any remaining workspace-relative paths against workspaceRoot
 * - endLine/endColumn are left undefined (optional fields)
 */
function normalizeLocation(
    location: ApexGuruLocation,
    filePath: string,
    workspaceRoot: string,
    resolveReturnedPath: (returnedFile: string | undefined) => string | undefined
): CodeLocation {
    const startLine = location.startLine ?? 1;
    const startColumn = location.startColumn ?? 1;  // Default to column 1 if not provided
    const locationResolved = resolveReturnedPath(location.file);
    const rawFile = locationResolved ?? location.file ?? filePath;
    const resolvedFile = path.isAbsolute(rawFile) ? rawFile : path.resolve(workspaceRoot, rawFile);

    return {
        file: resolvedFile,
        startLine,
        startColumn,
        endLine: location.endLine,      // undefined if not provided (optional)
        endColumn: location.endColumn,  // undefined if not provided (optional)
        comment: location.comment
    };
}
