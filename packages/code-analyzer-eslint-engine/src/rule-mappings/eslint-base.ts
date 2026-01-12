import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";

export const RULE_MAPPINGS_ESLINT_BASE: Record<string, {severity: SeverityLevel, tags: string[]}> = {
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
};
