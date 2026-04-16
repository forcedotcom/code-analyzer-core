/**
 * Public API for the suppressions module
 */

export type {
    SuppressionMarker,
    SuppressionRange,
    FileSuppressions,
    SuppressionsMap
} from './suppression-types';

export {
    parseSuppressionMarkers,
    buildSuppressionRanges,
    parseFileSuppressions
} from './suppression-parser';

export {
    processSuppressions,
    isTextFile,
    extractSuppressionsFromFiles,
    filterSuppressedViolations
} from './suppression-processor';

export type { LoggerCallback } from './suppression-processor';

export {
    applyBulkSuppressions
} from './bulk-suppression-processor';

export type {
    BulkSuppressionQuotas,
    BulkSuppressionResult
} from './bulk-suppression-processor';
