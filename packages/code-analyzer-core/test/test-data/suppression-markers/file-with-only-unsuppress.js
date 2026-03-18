/**
 * Test file with ONLY unsuppress markers (no suppress markers)
 * This is an edge case - unsuppress without prior suppress should have no effect
 * All violations should be reported normally
 */

const x = 1; // Line 7 - Would normally violate no-magic-numbers

// code-analyzer-unsuppress(eslint:no-console)
console.log(x); // Line 10 - Should be reported (unsuppress without suppress has no effect)

const y = 2; // Line 12 - Would normally violate no-magic-numbers

// code-analyzer-unsuppress(all)
eval('test'); // Line 15 - Should be reported (unsuppress without suppress has no effect)
