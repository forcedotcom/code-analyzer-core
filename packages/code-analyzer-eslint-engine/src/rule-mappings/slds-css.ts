import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import { SLDS } from './constants';

export const RULE_MAPPINGS_SLDS_CSS: Record<string, {severity: SeverityLevel, tags: string[]}> = {
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
    "@salesforce-ux/slds/no-deprecated-classes-slds2": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, SLDS, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.HTML]
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

    // =================================================================================================================
};
