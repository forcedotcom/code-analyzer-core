/**
 * Types and interfaces for the suppression system
 */

import {Selector} from "../selectors";

/**
 * Represents a suppression marker found in source code
 */
export interface SuppressionMarker {
    /** The type of marker (suppress or unsuppress) */
    type: 'suppress' | 'unsuppress';

    /** The rule selector specified in the marker (parsed using toSelector) */
    ruleSelector: Selector;

    /** The original rule selector string (kept for hierarchical ending logic) */
    ruleSelectorString: string;

    /** The line number where the marker was found (1-indexed) */
    lineNumber: number;
}

/**
 * Represents a range of lines where specific rules are suppressed or unsuppressed
 */
export interface SuppressionRange {
    /** The starting line number (1-indexed, inclusive) */
    startLine: number;

    /** The ending line number (1-indexed, inclusive). undefined means end of file */
    endLine: number | undefined;

    /** The rule selector that is affected in this range (Selector object from selectors.ts) */
    ruleSelector: Selector;

    /** The original rule selector string (kept for hierarchical ending logic and debugging) */
    ruleSelectorString: string;

    /** Whether this is a suppression (true) or unsuppression/exception (false) */
    isSuppressed: boolean;
}

/**
 * Contains all suppression information for a single file
 */
export interface FileSuppressions {
    /** The absolute path to the file */
    filePath: string;

    /** List of all suppression and unsuppression ranges in the file */
    ranges: SuppressionRange[];
}

/**
 * Map of file paths to their suppression information
 */
export type SuppressionsMap = Map<string, FileSuppressions>;
