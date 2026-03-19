/**
 * Test file with case-insensitive markers
 * Markers should work regardless of case
 */

// Code-Analyzer-Suppress(eslint:no-console)
console.log('Mixed case suppress'); // Line 7 - Should be suppressed

// CODE-ANALYZER-UNSUPPRESS(eslint:no-console)
console.log('Upper case unsuppress'); // Line 10 - Should NOT be suppressed

// code-analyzer-SUPPRESS(eslint:no-console)
console.log('Mixed case suppress again'); // Line 13 - Should be suppressed
