/**
 * Test file with suppress(engine) marker
 * Only violations from specified engine should be suppressed
 */

const y = 2; // Would normally violate no-magic-numbers

// code-analyzer-suppress(eslint)
const x = 1; // eslint violations suppressed
console.log(x); // eslint violations suppressed
// But pmd violations would still be reported
