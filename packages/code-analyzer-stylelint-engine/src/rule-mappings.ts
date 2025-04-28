import {
    COMMON_TAGS,
    SeverityLevel,
} from "@salesforce/code-analyzer-engine-api";
import { StylelintRuleStatus } from "./enums";

/**
 * The following is a list of the base rules that we have reviewed where we have designated the rule tags and
 * severity (most important to determine if the "Recommended" tag is applied or not). This also helps fixed these values
 * just in case stylelint and the owners of the other base plugins decides to change them.
 *
 * Any base rule not listed here will get flagged by one of our unit tests to be reviewed. All other rules must
 * then be custom rules which the user has added themselves, and thus will automatically get "Recommended" and "Custom"
 * tag applied with a severity level defined by our default mapping strategy.
 */
export const RULE_MAPPINGS: Record<
    string,
    { severity: SeverityLevel; tags: string[]; status?: StylelintRuleStatus }
> = {
    // =================================================================================================================
    //   STYLELINT CSS BASE RULES
    // =================================================================================================================
    "alpha-value-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.WARN,
    },
    "annotation-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "at-rule-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.NULL,
    },
    "at-rule-descriptor-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "at-rule-descriptor-value-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "at-rule-disallowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.NULL,
    },
    "at-rule-empty-line-before": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.NULL,
    },
    "at-rule-no-deprecated": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "at-rule-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "at-rule-no-vendor-prefix": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.NULL,
    },
    "at-rule-prelude-no-invalid": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "at-rule-property-required-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.NULL,
        },
    "block-no-empty": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
        status: StylelintRuleStatus.ERROR,
    },
    "color-function-alias-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "color-function-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "color-hex-alpha": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "color-hex-length": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "color-named": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "color-no-hex": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "color-no-invalid-hex": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "comment-empty-line-before": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "comment-no-empty": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "comment-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "comment-whitespace-inside": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "comment-word-disallowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "container-name-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "custom-media-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "custom-property-empty-line-before": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "custom-property-no-missing-var-function": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "custom-property-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-block-no-duplicate-custom-properties": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-block-no-duplicate-properties": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-block-no-redundant-longhand-properties": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-block-no-shorthand-property-overrides": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-block-single-line-max-declarations": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-empty-line-before": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-no-important": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-max-values": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-unit-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-unit-disallowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-value-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-value-disallowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-value-keyword-no-deprecated": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "declaration-property-value-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "font-family-name-quotes": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "font-family-no-duplicate-names": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "font-family-no-missing-generic-family-keyword": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "font-weight-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-allowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-calc-no-unspaced-operator": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-linear-gradient-no-nonstandard-direction": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-name-case": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-url-no-scheme-relative": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-url-quotes": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-url-scheme-allowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "function-url-scheme-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "hue-degree-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "import-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "keyframe-block-no-duplicate-selectors": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "keyframe-declaration-no-important": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "keyframe-selector-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "keyframes-name-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "layer-name-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "length-zero-no-unit": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "lightness-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "max-nesting-depth": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-disallowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-no-vendor-prefix": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-unit-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-value-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-name-value-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-feature-range-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "media-query-no-invalid": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "named-grid-areas-no-invalid": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-descending-specificity": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-duplicate-at-import-rules": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-duplicate-selectors": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-empty-source": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-invalid-double-slash-comments": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-invalid-position-at-import-rule": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-irregular-whitespace": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-unknown-animations": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-unknown-custom-media": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "no-unknown-custom-properties": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "number-max-precision": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "property-allowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "property-disallowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "property-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "property-no-vendor-prefix": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "rule-empty-line-before": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "rule-selector-property-disallowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-anb-no-unmatchable": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-attribute-name-disallowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-attribute-operator-allowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-attribute-operator-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-attribute-quotes": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-class-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-combinator-allowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-combinator-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-id-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-attribute": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-class": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-combinators": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-compound-selectors": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-id": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-pseudo-class": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-specificity": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-type": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-max-universal": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-nested-pattern": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-no-qualifying-type": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-no-vendor-prefix": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-not-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-class-allowed-list": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-class-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-class-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-element-allowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-element-colon-notation": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-element-disallowed-list": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.BEST_PRACTICES,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-pseudo-element-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-type-case": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "selector-type-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "shorthand-property-no-redundant-values": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "string-no-newline": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "syntax-string-no-invalid": {
        severity: SeverityLevel.High,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "time-min-milliseconds": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "unit-allowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "unit-disallowed-list": {
        severity: SeverityLevel.Info,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "unit-no-unknown": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.ERROR_PRONE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "value-keyword-case": {
        severity: SeverityLevel.Low,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
    "value-no-vendor-prefix": {
        severity: SeverityLevel.Moderate,
        tags: [
            /* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE,
            COMMON_TAGS.LANGUAGES.CSS,
            COMMON_TAGS.LANGUAGES.SCSS,
        ],
    },
};
