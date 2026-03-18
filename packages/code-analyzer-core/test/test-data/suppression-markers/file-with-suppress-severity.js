/**
 * Test file with suppress by severity
 * Only violations with specified severity should be suppressed
 */

// code-analyzer-suppress(eslint:(3,4))
// Suppresses severity 3 (Moderate) and 4 (Low) violations
const x = 1; // Severity 3 or 4 - Should be suppressed
console.log(x); // Severity varies - suppressed if 3 or 4
eval('test'); // Severity 2 (High) - Should NOT be suppressed
