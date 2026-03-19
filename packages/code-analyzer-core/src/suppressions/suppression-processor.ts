/**
 * Processes violations and filters out suppressed ones based on suppression markers
 */

import { Violation } from '../results';
import { FileSuppressions, SuppressionRange, SuppressionsMap } from './suppression-types';
import { parseFileSuppressions } from './suppression-parser';
import fs from 'node:fs';
import { isBinaryFile } from 'isbinaryfile';

/**
 * Checks if a file is a text file (not binary)
 * Uses the isbinaryfile library (same as used in retire-js and regex engines)
 * @param filePath Absolute path to the file
 * @returns true if the file appears to be text, false if binary
 */
export async function isTextFile(filePath: string): Promise<boolean> {
    try {
        return !(await isBinaryFile(filePath));
    } catch (_err) {
        // If we can't read the file, assume it's not text
        return false;
    }
}

/**
 * Reads and parses suppression information from files that have violations
 * Uses caching to avoid re-parsing the same file multiple times
 *
 * @param filePaths Set of absolute file paths to process
 * @param suppressionsMap Map to store/cache suppression information
 * @param logger Optional logger callback for error/warning messages
 * @returns Updated suppressions map
 */
export async function extractSuppressionsFromFiles(
    filePaths: Set<string>,
    suppressionsMap: SuppressionsMap = new Map(),
    logger?: LoggerCallback
): Promise<SuppressionsMap> {
    for (const filePath of filePaths) {
        // Skip if already processed
        if (suppressionsMap.has(filePath)) {
            continue;
        }

        // Skip non-text files (binary files)
        if (!(await isTextFile(filePath))) {
            // Store empty suppressions to mark as processed
            suppressionsMap.set(filePath, { filePath, ranges: [] });
            continue;
        }

        try {
            // Read file content
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            // Parse suppressions
            const fileSuppressions = parseFileSuppressions(fileContent, filePath);

            // Cache the result
            suppressionsMap.set(filePath, fileSuppressions);
        } catch (err) {
            // If we can't read the file, skip it and log the error
            if (logger) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                logger('error', `Failed to read file for suppression parsing: ${filePath}. Error: ${errorMsg}`);
            }
            // Store empty suppressions to mark as processed
            suppressionsMap.set(filePath, { filePath, ranges: [] });
        }
    }

    return suppressionsMap;
}

/**
 * Gets the specificity level of a rule selector
 * More specific selectors override less specific ones
 */
function getSelectorSpecificity(selector: string): number {
    if (selector === 'all') {
        return 1; // Least specific
    }
    if (selector.includes(':')) {
        return 3; // Most specific (engine:rule)
    }
    return 2; // Medium specific (engine only)
}

/**
 * Checks if a violation should be suppressed based on suppression ranges
 * Uses hierarchical matching with specificity rules
 *
 * @param violation The violation to check
 * @param fileSuppressions Suppression information for the file
 * @returns true if the violation should be suppressed, false otherwise
 */
export function isViolationSuppressed(violation: Violation, fileSuppressions: FileSuppressions | undefined): boolean {
    if (!fileSuppressions || fileSuppressions.ranges.length === 0) {
        return false;
    }

    const primaryLocation = violation.getPrimaryLocation();
    const file = primaryLocation.getFile();
    const startLine = primaryLocation.getStartLine();

    // If violation has no file or start line, we can't suppress it
    if (!file || startLine === undefined || startLine === null) {
        return false;
    }

    const endLine = primaryLocation.getEndLine();

    // Find all ranges that apply to this violation
    const applicableRanges = fileSuppressions.ranges.filter(range =>
        doesRangeOverlapViolation(range, startLine, endLine) &&
        doesRuleSelectorMatch(range.ruleSelector, violation)
    );

    if (applicableRanges.length === 0) {
        return false; // No applicable ranges
    }

    // Apply specificity rules: find the most specific applicable range
    // If there are multiple ranges at the same specificity, take the one with the highest startLine (most recent)
    let mostSpecificRange: SuppressionRange | null = null;
    let highestSpecificity = 0;

    for (const range of applicableRanges) {
        const specificity = getSelectorSpecificity(range.ruleSelector);

        if (specificity > highestSpecificity ||
            (specificity === highestSpecificity && mostSpecificRange &&
             range.startLine > mostSpecificRange.startLine)) {
            mostSpecificRange = range;
            highestSpecificity = specificity;
        }
    }

    // Return the isSuppressed value of the most specific range
    return mostSpecificRange ? mostSpecificRange.isSuppressed : false;
}

/**
 * Checks if a suppression range overlaps with a violation's location
 * According to the spec: "if any part of the violation's primary location range overlaps,
 * then the range applies"
 *
 * @param range The suppression range
 * @param violationStartLine The start line of the violation
 * @param violationEndLine The end line of the violation (may be undefined for single-line violations)
 * @returns true if the range overlaps with the violation
 */
function doesRangeOverlapViolation(
    range: SuppressionRange,
    violationStartLine: number,
    violationEndLine: number | undefined
): boolean {
    const violationEnd = violationEndLine ?? violationStartLine;
    const rangeEnd = range.endLine ?? Number.MAX_SAFE_INTEGER;

    // Check for overlap: violation overlaps if any part of it is within the suppression range
    // Overlap occurs when: violationStart <= rangeEnd AND violationEnd >= rangeStart
    return violationStartLine <= rangeEnd && violationEnd >= range.startLine;
}

/**
 * Checks if a rule selector matches a violation's rule
 *
 * Rule selector matching rules:
 * - "all" matches all rules
 * - "engineName" matches all rules from that engine (e.g., "pmd", "eslint")
 * - "engineName:ruleName" matches specific rule
 * - "engineName:(severity1,severity2)" matches rules from engine with those severities
 *
 * @param ruleSelector The rule selector from suppression marker
 * @param violation The violation to check
 * @returns true if the selector matches this violation's rule
 */
function doesRuleSelectorMatch(ruleSelector: string, violation: Violation): boolean {
    // "all" matches everything
    if (ruleSelector === 'all') {
        return true;
    }

    const rule = violation.getRule();
    const engineName = rule.getEngineName();
    const ruleName = rule.getName();
    const severity = rule.getSeverityLevel();

    // Check for exact "engineName:ruleName" match
    const fullRuleName = `${engineName}:${ruleName}`;
    if (ruleSelector === fullRuleName) {
        return true;
    }

    // Check for engine-only match (e.g., "pmd" matches all pmd rules)
    if (ruleSelector === engineName) {
        return true;
    }

    // Check for severity-based match (e.g., "eslint:(3,4)")
    const severityPattern = /^([^:]+):\(([^)]+)\)$/;
    const severityMatch = ruleSelector.match(severityPattern);
    if (severityMatch) {
        const selectorEngine = severityMatch[1];
        const severitiesStr = severityMatch[2];

        if (selectorEngine === engineName) {
            // Parse severities: "3,4" -> [3, 4]
            const severities = severitiesStr.split(',').map(s => parseInt(s.trim(), 10));
            if (severities.includes(severity)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Filters violations based on suppression information
 * This is the main entry point for the post-processing step
 *
 * @param violations Array of all violations
 * @param suppressionsMap Map of file paths to their suppression information
 * @returns Filtered array of violations (those that are not suppressed)
 */
export function filterSuppressedViolations(
    violations: Violation[],
    suppressionsMap: SuppressionsMap
): Violation[] {
    return violations.filter(violation => {
        const primaryLocation = violation.getPrimaryLocation();
        const file = primaryLocation.getFile();

        if (!file) {
            // No file location, can't suppress
            return true;
        }

        const fileSuppressions = suppressionsMap.get(file);
        const suppressed = isViolationSuppressed(violation, fileSuppressions);

        return !suppressed; // Keep violations that are NOT suppressed
    });
}

/**
 * Logger callback type for suppression processing
 */
export type LoggerCallback = (level: 'error' | 'warn' | 'debug', message: string) => void;

/**
 * Main function to process violations and apply suppressions
 * This is called after all engines have returned results
 *
 * @param violations Array of all violations from all engines
 * @param logger Optional logger callback for error/warning messages
 * @returns Filtered violations with suppressions applied
 */
export async function processSuppressions(violations: Violation[], logger?: LoggerCallback): Promise<Violation[]> {
    if (violations.length === 0) {
        return violations;
    }

    // Extract unique file paths from violations
    const filePaths = new Set<string>();
    for (const violation of violations) {
        const primaryLocation = violation.getPrimaryLocation();
        const file = primaryLocation.getFile();
        if (file) {
            filePaths.add(file);
        }
    }

    if (filePaths.size === 0) {
        // No files with violations
        return violations;
    }

    // Parse suppression information from files
    const suppressionsMap = await extractSuppressionsFromFiles(filePaths, new Map(), logger);

    // Filter violations
    return filterSuppressedViolations(violations, suppressionsMap);
}
