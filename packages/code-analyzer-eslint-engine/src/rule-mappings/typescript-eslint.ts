import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";

export const RULE_MAPPINGS_TYPESCRIPT_ESLINT: Record<string, {severity: SeverityLevel, tags: string[]}> = {
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
};
