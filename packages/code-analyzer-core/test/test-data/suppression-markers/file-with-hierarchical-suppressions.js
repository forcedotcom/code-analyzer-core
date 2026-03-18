/**
 * Test file with hierarchical suppressions
 * Tests specificity rules: specific rule > engine > all
 */

// code-analyzer-suppress(all)
console.log('All suppressed'); // Line 7 - Should be suppressed

// code-analyzer-unsuppress(eslint:no-console)
console.log('Specific unsuppress wins'); // Line 10 - Should NOT be suppressed (higher specificity)

const x = 1; // Line 12 - Should be suppressed (no-magic-numbers still suppressed by 'all')
