import {Violation} from "../results";
import {BulkSuppressionRule} from "../config";
import {toSelector, Selector} from "../selectors";
import {SeverityLevel} from "../rules";
import * as path from 'node:path';
import {LoggerCallback} from "./suppression-processor";

/**
 * Tracks the number of suppressions applied per config path and rule selector combination
 * Key format: "configPath|ruleSelector" - shared across all files matching the config path
 */
export type BulkSuppressionQuotas = Map<string, number>; // key: "configPath|ruleSelector"

/**
 * Bulk suppression rule paired with its config path (for quota tracking)
 */
type RuleWithConfigPath = {
    rule: BulkSuppressionRule;
    configPath: string; // The path from config that matched (e.g., "src/" or "src/file.js")
    ruleIndex: number; // Index in the rules array for unique quota tracking
};

/**
 * Result of applying bulk suppressions to a list of violations
 */
export type BulkSuppressionResult = {
    unsuppressedViolations: Violation[];
    suppressedCount: number;
};

/**
 * Applies bulk suppressions to violations based on config, updating quota tracking
 * @param violations List of violations to process
 * @param bulkConfig Bulk suppression configuration from YAML
 * @param quotas Shared quota tracker (mutated by this function)
 * @param workspaceRoot Root directory for resolving relative paths
 * @param logger Optional logger callback for debug/info messages
 * @returns Object containing unsuppressed violations and count of suppressions applied
 */
export function applyBulkSuppressions(
    violations: Violation[],
    bulkConfig: Record<string, BulkSuppressionRule[]>,
    quotas: BulkSuppressionQuotas,
    workspaceRoot: string,
    logger?: LoggerCallback
): BulkSuppressionResult {
    const log = (msg: string) => logger?.('debug', msg);

    log(`Bulk suppressions: processing ${violations.length} violation(s) with workspace root ${workspaceRoot}`);

    if (Object.keys(bulkConfig).length === 0) {
        log('No bulk suppressions configured');
        return { unsuppressedViolations: violations, suppressedCount: 0 };
    }

    log(`Bulk suppression config paths: ${Object.keys(bulkConfig).join(', ')}`);

    // Sort violations for deterministic processing within this engine
    const sortedViolations = [...violations].sort((a, b) => {
        const fileA = a.getPrimaryLocation().getFile() || '';
        const fileB = b.getPrimaryLocation().getFile() || '';
        if (fileA !== fileB) {
            return fileA.localeCompare(fileB);
        }

        const lineA = a.getPrimaryLocation().getStartLine() || 0;
        const lineB = b.getPrimaryLocation().getStartLine() || 0;
        return lineA - lineB;
    });

    const unsuppressedViolations: Violation[] = [];
    let suppressedCount = 0;

    for (const violation of sortedViolations) {
        const violationFile = violation.getPrimaryLocation().getFile();
        if (!violationFile) {
            // Skip violations id no file path is present
            unsuppressedViolations.push(violation);
            continue;
        }

        // Find matching suppression rules for this violation's file
        const matchingRules = findMatchingBulkSuppressionRules(violationFile, bulkConfig, workspaceRoot);

        let suppressed = false;
        for (const ruleWithPath of matchingRules) {
            if (shouldSuppressViolation(violation, ruleWithPath.rule, quotas, ruleWithPath.configPath, ruleWithPath.ruleIndex, logger)) {
                suppressed = true;
                suppressedCount++;
                break; // Violation suppressed, move to next
            }
        }

        if (!suppressed) {
            unsuppressedViolations.push(violation);
        }
    }

    log(`Bulk suppressions: ${suppressedCount} suppressed, ${unsuppressedViolations.length} unsuppressed`);

    return { unsuppressedViolations, suppressedCount };
}

/**
 * Finds bulk suppression rules that match the given file path
 * Returns rules paired with their config paths for shared quota tracking
 * @param violationFile Absolute file path from violation
 * @param bulkConfig Bulk suppression configuration
 * @param workspaceRoot Root directory for resolving relative paths
 * @returns Array of rules with their matching config paths
 */
function findMatchingBulkSuppressionRules(
    violationFile: string,
    bulkConfig: Record<string, BulkSuppressionRule[]>,
    workspaceRoot: string
): RuleWithConfigPath[] {
    const matchingRules: RuleWithConfigPath[] = [];

    for (const [configPath, rules] of Object.entries(bulkConfig)) {
        const matches = doesFileMatchConfigPath(violationFile, configPath, workspaceRoot);

        if (matches) {
            // Add each rule with its config path and index for unique quota tracking
            for (let i = 0; i < rules.length; i++) {
                matchingRules.push({ rule: rules[i], configPath, ruleIndex: i });
            }
        }
    }

    return matchingRules;
}

/**
 * Checks if a file path matches a config path (file or folder)
 * @param violationFile Absolute file path from violation
 * @param configPath Relative path from config (file or folder)
 * @param workspaceRoot Root directory for resolving relative paths
 * @returns true if the file matches
 */
function doesFileMatchConfigPath(
    violationFile: string,
    configPath: string,
    workspaceRoot: string
): boolean {
    // Convert config path to absolute
    const absoluteConfigPath = path.isAbsolute(configPath)
        ? configPath
        : path.resolve(workspaceRoot, configPath);

    // Normalize paths for comparison
    const normalizedViolationFile = path.normalize(violationFile);
    const normalizedConfigPath = path.normalize(absoluteConfigPath);

    // Check if it's an exact file match
    if (normalizedViolationFile === normalizedConfigPath) {
        return true;
    }

    // Check if violation file is within config folder
    // Config path is a folder if it matches the start of the file path
    const configPathWithSep = normalizedConfigPath.endsWith(path.sep)
        ? normalizedConfigPath
        : normalizedConfigPath + path.sep;

    return normalizedViolationFile.startsWith(configPathWithSep);
}

/**
 * Determines if a violation should be suppressed based on a bulk suppression rule
 * Updates the quota tracker if suppression is applied
 * Uses shared quota across all files matching the config path, but each array entry gets independent quota
 * @param violation The violation to check
 * @param rule The bulk suppression rule to apply
 * @param quotas Quota tracker (mutated if suppressed) - shared across config path
 * @param configPath Config path from YAML (e.g., "src/" or "src/file.js") for quota tracking
 * @param ruleIndex Index of rule in the array (for unique quota when duplicates exist)
 * @returns true if violation should be suppressed
 */
function shouldSuppressViolation(
    violation: Violation,
    rule: BulkSuppressionRule,
    quotas: BulkSuppressionQuotas,
    configPath: string,
    ruleIndex: number,
    logger?: LoggerCallback
): boolean {
    // Check if the rule selector matches this violation
    if (!ruleMatches(violation, rule.rule_selector, logger)) {
        return false;
    }

    // Quota key includes rule index to give each array entry independent quota
    // This allows duplicate rules to each have their own quota allocation
    const quotaKey = `${configPath}|${ruleIndex}|${rule.rule_selector}`;
    const currentCount = quotas.get(quotaKey) || 0;
    const maxLimit = rule.max_suppressed_violations;

    // If maxLimit is null/undefined, suppress all matching violations
    if (maxLimit === null || maxLimit === undefined) {
        quotas.set(quotaKey, currentCount + 1);
        return true;
    }

    // Check if we've reached the quota limit (shared across all files in config path)
    if (currentCount < maxLimit) {
        quotas.set(quotaKey, currentCount + 1);
        return true;
    }

    // Quota exceeded, don't suppress
    return false;
}

/**
 * Checks if a rule selector matches a violation
 * Uses the same rule selector matching logic as rule selection
 * @param violation The violation to check
 * @param ruleSelector The rule selector string (e.g., "pmd:UnusedMethod", "3,4", etc.)
 * @param logger Optional logger callback for debug messages
 * @returns true if the violation matches the selector
 */
function ruleMatches(violation: Violation, ruleSelector: string, logger?: LoggerCallback): boolean {
    const log = (msg: string) => logger?.('debug', msg);

    try {
        const selector: Selector = toSelector(ruleSelector);
        const rule = violation.getRule();

        // Build selectables array from rule (same as Rule.matchesRuleSelector)
        const sevNumber: number = rule.getSeverityLevel().valueOf();
        const sevName: string = SeverityLevel[sevNumber];
        const selectables: string[] = [
            "all",
            rule.getEngineName().toLowerCase(),
            rule.getName().toLowerCase(),
            sevName.toLowerCase(),
            String(sevNumber),
            ...rule.getTags().map(t => t.toLowerCase())
        ];

        return selector.matchesSelectables(selectables);
    } catch (error) {
        // If selector is invalid, don't match
        log(`Invalid rule selector "${ruleSelector}": ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}
