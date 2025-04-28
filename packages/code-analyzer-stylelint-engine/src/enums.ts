/**
 * Enum that maps to the Stylelint Rule Severity levels.
 * See https://stylelint.io/user-guide/configure#severity
 * Using the term "Status" here to differentiate from our own "Severity" term.
 * Also using numbers so that we can more easily compare them with > sign.
 */
export enum StylelintRuleStatus {
    ERROR = 2,
    WARN = 1,
    NULL = 0,
}
