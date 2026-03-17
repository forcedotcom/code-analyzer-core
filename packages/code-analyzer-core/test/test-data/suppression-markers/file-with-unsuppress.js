/**
 * Test file with suppress and unsuppress markers
 * Tests that unsuppress re-enables violation reporting
 */

// code-analyzer-suppress(eslint:no-console)
console.log('Suppressed'); // Line 7 - Should be suppressed

// code-analyzer-unsuppress(eslint:no-console)
console.log('Not suppressed'); // Line 10 - Should NOT be suppressed
