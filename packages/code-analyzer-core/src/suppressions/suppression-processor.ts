/**
 * Processes violations and filters out suppressed ones based on suppression markers
 */

import { Violation } from '../results';
import { FileSuppressions, SuppressionRange, SuppressionsMap } from './suppression-types';
import { parseFileSuppressions } from './suppression-parser';
import { Selector } from '../selectors';
import { SeverityLevel } from '@salesforce/code-analyzer-engine-api';
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
            // Read file content asynchronously
            const fileContent = await fs.promises.readFile(filePath, 'utf-8');

            // Parse suppressions
            const fileSuppressions = parseFileSuppressions(fileContent, filePath, logger);

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

    // Find the most recent applicable range (highest startLine wins)
    // This is the simplest rule: the nearest suppression marker takes precedence
    //
    // EDGE CASE - Multiple markers on same line:
    // If multiple suppression markers are placed on the same line (e.g., same comment),
    // the behavior is undefined (whichever appears last in the array wins).
    // This is an anti-pattern and users should NOT write markers this way.
    // We intentionally do not implement complex tie-breaking logic for this edge case.
    //
    // Example of what NOT to do:
    //   // code-analyzer-suppress(all) code-analyzer-suppress(eslint)
    //
    // Proper usage - one marker per line:
    //   // code-analyzer-suppress(all)
    //   // code-analyzer-suppress(eslint)
    //
    let selectedRange: SuppressionRange | null = null;
    let highestStartLine = 0;

    for (const range of applicableRanges) {
        if (range.startLine >= highestStartLine) {
            selectedRange = range;
            highestStartLine = range.startLine;
        }
    }

    // Return the isSuppressed value of the selected range
    return selectedRange ? selectedRange.isSuppressed : false;
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
 * Uses the same Selector.matchesSelectables() logic as rule selection
 *
 * @param ruleSelector The Selector from suppression marker
 * @param violation The violation to check
 * @returns true if the selector matches this violation's rule
 */
function doesRuleSelectorMatch(ruleSelector: Selector, violation: Violation): boolean {
    const rule = violation.getRule();

    // Build selectables array (same as Rule.matchesRuleSelector in rules.ts)
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

    return ruleSelector.matchesSelectables(selectables);
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
 * @param existingSuppressionsMap Optional pre-populated suppressions map to use for caching across multiple calls
 * @returns Filtered violations with suppressions applied
 */
export async function processSuppressions(
    violations: Violation[],
    logger?: LoggerCallback,
    existingSuppressionsMap?: SuppressionsMap
): Promise<Violation[]> {
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

    // Use provided map or create new one
    const suppressionsMap = existingSuppressionsMap || new Map();

    // Parse suppression information from files (will skip already-cached files)
    await extractSuppressionsFromFiles(filePaths, suppressionsMap, logger);

    // Filter violations
    return filterSuppressedViolations(violations, suppressionsMap);
}
