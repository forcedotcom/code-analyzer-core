import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";

// Convenience tag to apply to framework specific rules
const LWC = "LWC";
const SLDS = "SLDS";

/**
 * The following is a list of the base rules that we have reviewed where we have designated the rule tags and
 * severity (most important to determine if the "Recommended" tag is applied or not). This also helps fixed these values
 * just in case eslint and the owners of the other base plugins decides to change them.
 *
 * Any base rule not listed here will get flagged by one of our unit tests to be reviewed. All other rules must
 * then be custom rules which the user has added themselves, and thus will automatically get "Recommended" and "Custom"
 * tag applied with a severity level defined by our default mapping strategy.
 */
export const RULE_MAPPINGS: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    // =================================================================================================================
    //   ESLINT JAVASCRIPT BASE RULES  (Note that most of these also work for typescript as well)
    // =================================================================================================================
    "accessor-pairs": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "array-callback-return": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "arrow-body-style": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "block-scoped-var": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "camelcase": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "capitalized-comments": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "class-methods-use-this": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "complexity": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "consistent-return": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "consistent-this": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "constructor-super": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "curly": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "default-case": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "default-case-last": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "default-param-last": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "dot-notation": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "eqeqeq": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "for-direction": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "func-name-matching": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "func-names": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "func-style": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "getter-return": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "grouped-accessor-pairs": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "guard-for-in": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "id-denylist": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "id-length": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "id-match": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "init-declarations": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "logical-assignment-operators": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "max-classes-per-file": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "max-depth": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "max-lines": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "max-lines-per-function": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "max-nested-callbacks": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "max-params": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "max-statements": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "new-cap": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-alert": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-array-constructor": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-async-promise-executor": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-await-in-loop": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-bitwise": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-caller": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-case-declarations": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-class-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-compare-neg-zero": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-cond-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-console": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-const-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-constant-binary-expression": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-constant-condition": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-constructor-return": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-continue": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-control-regex": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-debugger": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-delete-var": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-div-regex": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-dupe-args": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-dupe-class-members": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-dupe-else-if": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-dupe-keys": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-duplicate-case": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-duplicate-imports": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-else-return": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-empty": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-empty-character-class": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-empty-function": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-empty-pattern": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-empty-static-block": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-eq-null": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-eval": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-ex-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-extend-native": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-extra-bind": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-extra-boolean-cast": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-extra-label": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-fallthrough": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-func-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-global-assign": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-implicit-coercion": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-implicit-globals": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-implied-eval": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-import-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-inline-comments": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-inner-declarations": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-invalid-regexp": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-invalid-this": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-irregular-whitespace": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-iterator": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-label-var": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-labels": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-lone-blocks": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-lonely-if": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-loop-func": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-loss-of-precision": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-magic-numbers": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-misleading-character-class": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-multi-assign": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-multi-str": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-negated-condition": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-nested-ternary": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-new": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-new-func": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-new-native-nonconstructor": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-new-wrappers": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-nonoctal-decimal-escape": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-obj-calls": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-object-constructor": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-octal": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-octal-escape": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-param-reassign": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-plusplus": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-promise-executor-return": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-proto": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-prototype-builtins": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-redeclare": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-regex-spaces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-restricted-exports": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-restricted-globals": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-restricted-imports": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-restricted-properties": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-restricted-syntax": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-return-assign": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-script-url": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-self-assign": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-self-compare": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-sequences": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-setter-return": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-shadow": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-shadow-restricted-names": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-sparse-arrays": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-template-curly-in-string": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-ternary": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-this-before-super": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-throw-literal": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-unassigned-vars": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-undef": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-undef-init": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-undefined": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-underscore-dangle": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unexpected-multiline": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unmodified-loop-condition": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unneeded-ternary": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unreachable": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-unreachable-loop": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unsafe-finally": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unsafe-negation": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-unsafe-optional-chaining": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unused-expressions": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-unused-labels": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unused-private-class-members": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-unused-vars": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-use-before-define": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-useless-assignment": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-backreference": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-call": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-catch": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-computed-key": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-concat": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-constructor": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "no-useless-escape": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-rename": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-useless-return": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-var": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-void": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-warning-comments": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "no-with": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "object-shorthand": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "one-var": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "operator-assignment": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-arrow-callback": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-const": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-destructuring": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "prefer-exponentiation-operator": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-named-capture-group": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-numeric-literals": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-object-has-own": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-object-spread": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-promise-reject-errors": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "prefer-regex-literals": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-rest-params": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-spread": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "prefer-template": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "preserve-caught-error": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "radix": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "require-atomic-updates": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "require-await": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT] // Not available with TypeScript
    },
    "require-unicode-regexp": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "require-yield": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "sort-imports": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "sort-keys": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "sort-vars": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "strict": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "symbol-description": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "unicode-bom": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "use-isnan": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "valid-typeof": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "vars-on-top": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "yoda": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },



    // =================================================================================================================
    //   LWC JAVASCRIPT BASE RULES
    // =================================================================================================================
    "@lwc/lwc-platform/no-aura": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-aura-libs": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-community-import": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-create-context-provider": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-deprecated-module-import": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-dynamic-import-identifier": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-inline-disable": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-create": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-dispatch": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-controller-with-client-def": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-with-callback": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-privileged": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-raw-response": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-get-event": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-get-module": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-is-external-definition": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-load-definitions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-module-instrumentation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-module-storage": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-register": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-render": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-sanitize": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-lds-aura-controller-method": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-process-env": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-restricted-namespaces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-site-import": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-wire-service": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/valid-dynamic-import-hint": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },

    // This one rule is broken and thus we need to turn it off for now.
    // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/152
    // TODO: Turn it back on when the rule has been fixed:
    // "@lwc/lwc-platform/valid-offline-wire": {
    //     severity: SeverityLevel.Moderate,
    //     tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    // },

    "@lwc/lwc/no-api-reassignments": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/newer-version-available": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-async-operation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-attributes-during-construction": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-deprecated": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-document-query": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-disallowed-lwc-imports": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-inner-html": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-leading-uppercase-api-name": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-template-children": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-unexpected-wire-adapter-usages": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-unknown-wire-adapters": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/prefer-custom-event": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-api": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-graphql-wire-adapter-callback-parameters": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-track": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-wire": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@salesforce/lightning/valid-apex-method-invocation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/default": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/export": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/named": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/namespace": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/expect-expect": {
        severity: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-alias-methods": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-commented-out-tests": {
        severity: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-conditional-expect": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },

    // This one rule makes eslint throw an exception if the user doesn't have jest installed (which should be
    // optional), so we turn it off for now. See https://github.com/salesforce/eslint-config-lwc/issues/161
    // "jest/no-deprecated-functions": {
    //     severity: SeverityLevel.Moderate,
    //     tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    // },
    "jest/no-disabled-tests": {
        severity: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-done-callback": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-export": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-focused-tests": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-identical-title": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-interpolation-in-snapshots": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-jasmine-globals": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-mocks-import": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-standalone-expect": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-test-prefixes": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-describe-callback": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-expect": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-expect-in-promise": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-title": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },


    // =================================================================================================================
    //   TYPESCRIPT-ESLINT BASE RULES
    // =================================================================================================================
    "@typescript-eslint/adjacent-overload-signatures": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/array-type": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/await-thenable": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/ban-ts-comment": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/ban-tslint-comment": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/class-literal-property-style": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/class-methods-use-this": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-generic-constructors": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-indexed-object-style": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-return": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-type-assertions": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-type-definitions": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-type-exports": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/consistent-type-imports": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/default-param-last": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/dot-notation": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/explicit-function-return-type": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/explicit-member-accessibility": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/explicit-module-boundary-types": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/init-declarations": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/max-params": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/member-ordering": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/method-signature-style": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-misused-spread": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/naming-convention": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-array-constructor": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-array-delete": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-base-to-string": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-confusing-non-null-assertion": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-confusing-void-expression": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-deprecated": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-dupe-class-members": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-duplicate-enum-values": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-duplicate-type-constituents": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-dynamic-delete": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-empty-function": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-empty-object-type": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-explicit-any": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-extra-non-null-assertion": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-extraneous-class": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-floating-promises": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-for-in-array": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-implied-eval": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-import-type-side-effects": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-inferrable-types": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-invalid-this": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-invalid-void-type": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-loop-func": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-magic-numbers": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-meaningless-void-operator": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-misused-new": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-misused-promises": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-mixed-enums": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-namespace": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-non-null-asserted-nullish-coalescing": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-non-null-asserted-optional-chain": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-non-null-assertion": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-redeclare": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-redundant-type-constituents": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-require-imports": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-restricted-imports": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-restricted-types": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-shadow": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-this-alias": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-condition": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-parameter-property-assignment": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-qualifier": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-template-expression": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-type-arguments": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-type-assertion": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-type-constraint": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-type-conversion": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unnecessary-type-parameters": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-argument": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-assignment": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-call": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-declaration-merging": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-enum-comparison": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-function-type": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-member-access": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-return": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-type-assertion": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unsafe-unary-minus": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unused-expressions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unused-private-class-members": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-unused-vars": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-use-before-define": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-useless-constructor": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-useless-default-assignment": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */     COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-useless-empty-export": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/no-wrapper-object-types": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/non-nullable-type-assertion-style": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/only-throw-error": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/parameter-properties": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-as-const": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-destructuring": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-enum-initializers": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-find": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-for-of": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-function-type": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-includes": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-literal-enum-member": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-namespace-keyword": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-nullish-coalescing": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-optional-chain": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-promise-reject-errors": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-readonly": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-readonly-parameter-types": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-reduce-type-parameter": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-regexp-exec": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-return-this-type": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/prefer-string-starts-ends-with": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/promise-function-async": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/related-getter-setter-pairs": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/require-array-sort-compare": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/require-await": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/restrict-plus-operands": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/restrict-template-expressions": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/return-await": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/strict-boolean-expressions": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/switch-exhaustiveness-check": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/triple-slash-reference": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/unbound-method": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/unified-signatures": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "@typescript-eslint/use-unknown-in-catch-callback-variable": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },

    // =================================================================================================================
    //   SLDS - HTML BASE RULES - @salesforce-ux/eslint-plugin-slds
    // =================================================================================================================
    "@salesforce-ux/slds/enforce-bem-usage": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.HTML]
    },
    "@salesforce-ux/slds/modal-close-button-issue": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.HTML]
    },
    "@salesforce-ux/slds/no-deprecated-classes-slds2": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.HTML]
    },

    // =================================================================================================================
    //   SLDS - CSS BASE RULES - @salesforce-ux/eslint-plugin-slds
    // =================================================================================================================
    "@salesforce-ux/slds/enforce-component-hook-naming-convention": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/enforce-sds-to-slds-hooks": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/lwc-token-to-slds-hook": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-deprecated-slds-classes": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-hardcoded-values-slds2": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-slds-class-overrides": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-slds-namespace-for-custom-hooks": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-slds-private-var": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-slds-var-without-fallback": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-sldshook-fallback-for-lwctoken": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/no-unsupported-hooks-slds2": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.CSS]
    },
    "@salesforce-ux/slds/reduce-annotations": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.CSS]
    },
}
