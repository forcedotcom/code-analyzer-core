import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import { SLDS } from './constants';

export const RULE_MAPPINGS_SLDS_HTML: Record<string, {severity: SeverityLevel, tags: string[]}> = {
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
};
