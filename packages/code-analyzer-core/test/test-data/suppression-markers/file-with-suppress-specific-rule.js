/**
 * Test file with suppress(engine:rule) marker
 * Only specific rule violations should be suppressed
 */

console.log('Before marker'); // Line 6 - Would violate no-console

// code-analyzer-suppress(eslint:no-console)
console.log('After suppress marker'); // Line 9 - Should be suppressed
const x = 1; // Line 10 - Would still violate no-magic-numbers (not suppressed)
console.log(x); // Line 11 - Should be suppressed (no-console)
