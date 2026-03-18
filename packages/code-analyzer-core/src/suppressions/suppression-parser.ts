/**
 * Parser for suppression markers in source files
 */

import { SuppressionMarker, SuppressionRange, FileSuppressions } from './suppression-types';

/**
 * Regular expressions to match suppression markers (case-insensitive)
 * Matches: code-analyzer-suppress(rule) or code-analyzer-suppress() or code-analyzer-suppress
 * Also matches: Code-Analyzer-Suppress, CODE-ANALYZER-SUPPRESS, etc.
 * The pattern handles complex selectors with nested parentheses like "eslint:(3,4)"
 * Pattern breakdown: [^()]* matches chars that aren't parens, (?:\([^)]*\)[^()]*)* handles nested parens
 */
const SUPPRESS_PATTERN = /code-analyzer-suppress(?:\(([^()]*(?:\([^)]*\)[^()]*)*)\))?/gi;
const UNSUPPRESS_PATTERN = /code-analyzer-unsuppress(?:\(([^()]*(?:\([^)]*\)[^()]*)*)\))?/gi;

/**
 * Parses a file's content to extract suppression markers
 * @param fileContent The full content of the file as a string
 * @param filePath The absolute path to the file (for error reporting)
 * @returns Array of SuppressionMarker objects found in the file
 */
export function parseSuppressionMarkers(fileContent: string, _filePath: string): SuppressionMarker[] {
    const markers: SuppressionMarker[] = [];
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const lineNumber = i + 1; // Convert to 1-indexed
        const line = lines[i];

        // Find all suppress markers in this line
        const suppressMatches = Array.from(line.matchAll(SUPPRESS_PATTERN));
        for (const match of suppressMatches) {
            const ruleSelector = normalizeRuleSelector(match[1]);
            markers.push({
                type: 'suppress',
                ruleSelector,
                lineNumber
            });
        }

        // Find all unsuppress markers in this line
        const unsuppressMatches = Array.from(line.matchAll(UNSUPPRESS_PATTERN));
        for (const match of unsuppressMatches) {
            const ruleSelector = normalizeRuleSelector(match[1]);
            markers.push({
                type: 'unsuppress',
                ruleSelector,
                lineNumber
            });
        }
    }

    return markers;
}

/**
 * Normalizes a rule selector from a marker
 * Empty or undefined selectors default to "all"
 * Trims whitespace from the selector
 */
function normalizeRuleSelector(selector: string | undefined): string {
    if (!selector || selector.trim() === '') {
        return 'all';
    }
    return selector.trim();
}

/**
 * Parse a selector into its hierarchical components
 */
function parseSelector(sel: string): { scope: 'all' | 'engine' | 'specific', engine?: string, rule?: string } {
    if (sel === 'all') {
        return { scope: 'all' };
    }
    // Handle special case for severity selectors like "eslint:(3,4)"
    const colonIndex = sel.indexOf(':');
    if (colonIndex === -1) {
        return { scope: 'engine', engine: sel };
    }
    const engine = sel.substring(0, colonIndex);
    const rest = sel.substring(colonIndex + 1);
    return { scope: 'specific', engine, rule: rest };
}

/**
 * Checks if an unsuppress selector can hierarchically end a suppress selector
 *
 * Hierarchical matching rules (CORRECTED):
 * - unsuppress(all) ends ANY suppress
 * - unsuppress(engine) ends suppress(engine) or suppress(engine:rule) from same engine
 * - unsuppress(engine:rule) ends suppress(engine:rule) (exact match only)
 *
 * More specific unsuppress creates an EXCEPTION (overlapping range), not an ending:
 * - unsuppress(engine) does NOT end suppress(all) - creates exception
 * - unsuppress(engine:rule) does NOT end suppress(all) - creates exception
 * - unsuppress(engine:rule) does NOT end suppress(engine) - creates exception
 *
 * @param suppressSelector The selector that started the suppression
 * @param unsuppressSelector The selector attempting to end it
 * @returns true if the unsuppress can hierarchically end this suppress
 */
function canUnsuppressEndSuppress(suppressSelector: string, unsuppressSelector: string): boolean {
    // Exact match always works
    if (suppressSelector === unsuppressSelector) {
        return true;
    }

    const suppressParsed = parseSelector(suppressSelector);
    const unsuppressParsed = parseSelector(unsuppressSelector);

    // unsuppress(all) ends ANY suppress (broader scope always ends)
    if (unsuppressParsed.scope === 'all') {
        return true;
    }

    // unsuppress(engine) ends suppress(engine) or suppress(engine:rule) from same engine
    if (unsuppressParsed.scope === 'engine') {
        if (suppressParsed.scope === 'engine' && suppressParsed.engine === unsuppressParsed.engine) {
            return true; // Redundant with exact match, but explicit
        }
        if (suppressParsed.scope === 'specific' && suppressParsed.engine === unsuppressParsed.engine) {
            return true; // unsuppress(engine) ends suppress(engine:rule)
        }
    }

    // More specific unsuppress should NOT end broader suppress
    // This creates an exception (overlapping range) instead
    // The processor will use specificity rules to determine which range wins

    return false;
}

/**
 * Checks if a suppress selector can hierarchically close an unsuppress selector
 *
 * Reverse hierarchical matching rules:
 * - suppress(all) closes ANY unsuppress
 * - suppress(engine) closes unsuppress(engine) or unsuppress(engine:rule) from same engine
 * - suppress(engine:rule) closes unsuppress(engine:rule) (exact match only)
 *
 * @param suppressSelector The selector from the suppress marker
 * @param unsuppressSelector The selector from the active unsuppress
 * @returns true if the suppress can hierarchically close this unsuppress
 */
function canSuppressCloseUnsuppress(suppressSelector: string, unsuppressSelector: string): boolean {
    // Exact match always works
    if (suppressSelector === unsuppressSelector) {
        return true;
    }

    const suppressParsed = parseSelector(suppressSelector);
    const unsuppressParsed = parseSelector(unsuppressSelector);

    // suppress(all) closes ANY unsuppress
    if (suppressParsed.scope === 'all') {
        return true;
    }

    // suppress(engine) closes unsuppress(engine) or unsuppress(engine:rule) from same engine
    if (suppressParsed.scope === 'engine') {
        if (unsuppressParsed.scope === 'engine' && suppressParsed.engine === unsuppressParsed.engine) {
            return true;
        }
        if (unsuppressParsed.scope === 'specific' && suppressParsed.engine === unsuppressParsed.engine) {
            return true;
        }
    }

    // suppress(engine:rule) only closes exact match (handled above)
    return false;
}

/**
 * Converts a list of suppression markers into suppression ranges
 * This processes suppress/unsuppress markers to create overlapping ranges with specificity-based precedence
 *
 * Key behaviors:
 * - unsuppress(all) ends all active suppressions
 * - More specific unsuppress creates EXCEPTION (overlapping range), not ending:
 *   - unsuppress(engine) does NOT end suppress(all) - creates exception
 *   - unsuppress(engine:rule) does NOT end suppress(all) or suppress(engine) - creates exception
 * - Broader suppress CAN override more specific unsuppress:
 *   - suppress(all) closes any unsuppress
 *   - suppress(engine) closes unsuppress(engine) or unsuppress(engine:rule) from same engine
 * - The processor uses specificity rules to determine which range wins when checking violations
 *
 * @param markers Sorted list of markers (by line number)
 * @param filePath The file path (for error reporting)
 * @returns Array of SuppressionRange objects
 */
export function buildSuppressionRanges(markers: SuppressionMarker[], _filePath: string): SuppressionRange[] {
    const ranges: SuppressionRange[] = [];

    // Track which rule selectors are currently active (suppressed or unsuppressed)
    // Map: ruleSelector -> {isSuppressed, startLine}
    const activeStates = new Map<string, { isSuppressed: boolean, startLine: number }>();

    for (const marker of markers) {
        if (marker.type === 'suppress') {
            // Check if already suppressed (no-op if so)
            const currentState = activeStates.get(marker.ruleSelector);
            if (currentState && currentState.isSuppressed) {
                continue;  // Already suppressed, skip
            }

            // Check if this suppress should close any active unsuppressions hierarchically
            // For example, suppress(regex) should close unsuppress(regex:AvoidOldApi)
            const statesToEnd: string[] = [];
            for (const [activeSelector, state] of activeStates.entries()) {
                if (!state.isSuppressed && activeSelector !== marker.ruleSelector &&
                    canSuppressCloseUnsuppress(marker.ruleSelector, activeSelector)) {
                    // Close this unsuppression range (but not for the same selector - handled below)
                    ranges.push({
                        startLine: state.startLine,
                        endLine: marker.lineNumber - 1,
                        ruleSelector: activeSelector,
                        isSuppressed: false
                    });
                    statesToEnd.push(activeSelector);
                }
            }

            // Remove closed states
            for (const selector of statesToEnd) {
                activeStates.delete(selector);
            }

            // If there was an unsuppression active for this exact selector, close it
            if (currentState && !currentState.isSuppressed) {
                ranges.push({
                    startLine: currentState.startLine,
                    endLine: marker.lineNumber - 1,
                    ruleSelector: marker.ruleSelector,
                    isSuppressed: false
                });
            }

            // Start new suppression
            activeStates.set(marker.ruleSelector, {
                isSuppressed: true,
                startLine: marker.lineNumber
            });
        } else if (marker.type === 'unsuppress') {
            // End active suppression ranges that match hierarchically
            const statesToEnd: string[] = [];

            for (const [suppressSelector, state] of activeStates.entries()) {
                if (state.isSuppressed && canUnsuppressEndSuppress(suppressSelector, marker.ruleSelector)) {
                    // Create a suppression range from the suppress marker to the unsuppress marker (exclusive of unsuppress line)
                    ranges.push({
                        startLine: state.startLine,
                        endLine: marker.lineNumber - 1,
                        ruleSelector: suppressSelector,
                        isSuppressed: true
                    });
                    statesToEnd.push(suppressSelector);
                }
            }

            // Remove ended suppressions
            for (const selector of statesToEnd) {
                activeStates.delete(selector);
            }

            // Now start an unsuppression range for this selector
            // This creates the "exception" behavior - marking that this selector is explicitly unsuppressed
            if (statesToEnd.length > 0 || marker.ruleSelector !== 'all') {
                // Only create unsuppression range if we actually ended something, or if it's a specific selector
                activeStates.set(marker.ruleSelector, {
                    isSuppressed: false,
                    startLine: marker.lineNumber
                });
            }
        }
    }

    // Any remaining active states extend to the end of the file
    for (const [ruleSelector, state] of activeStates.entries()) {
        ranges.push({
            startLine: state.startLine,
            endLine: undefined,
            ruleSelector,
            isSuppressed: state.isSuppressed
        });
    }

    return ranges;
}

/**
 * Parses a file's content and builds complete suppression information
 * @param fileContent The full content of the file as a string
 * @param filePath The absolute path to the file
 * @returns FileSuppressions object containing all suppression ranges for the file
 */
export function parseFileSuppressions(fileContent: string, filePath: string): FileSuppressions {
    const markers = parseSuppressionMarkers(fileContent, filePath);
    const ranges = buildSuppressionRanges(markers, filePath);

    return {
        filePath,
        ranges
    };
}
