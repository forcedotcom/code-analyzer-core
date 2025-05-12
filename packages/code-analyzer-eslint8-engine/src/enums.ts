/**
 * Enum that maps to the ESLint Rule Severity levels.
 * See https://eslint.org/docs/v8.x/use/configure/rules#rule-severities
 * Using the term "Status" here to differentiate from our own "Severity" term.
 * Also using numbers so that we can more easily compare them with > sign.
 */
export enum ESLintRuleStatus {
    ERROR = 2,
    WARN = 1,
    OFF = 0
}

/**
 * Enum that maps to the ESLint rule types.
 * See https://eslint.org/docs/v8.x/extend/custom-rules#rule-structure
 */
export enum ESLintRuleType {
    PROBLEM = "problem",
    SUGGESTION = "suggestion",
    LAYOUT = "layout"
}