/**
 * Test file WITHOUT any suppression markers
 * All violations should be reported normally
 */

const x = 1; // Would normally violate no-magic-numbers
console.log(x); // Would normally violate no-console
eval('test'); // Would normally violate no-eval
