/**
 * Test file with suppress(all) marker
 * All violations below the marker should be suppressed
 */

// code-analyzer-suppress(all)
const x = 1; // Would normally violate no-magic-numbers
console.log(x); // Would normally violate no-console
eval('test'); // Would normally violate no-eval
