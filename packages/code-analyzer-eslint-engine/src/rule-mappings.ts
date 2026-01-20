import {SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import {RULE_MAPPINGS_ESLINT_BASE} from "./rule-mappings/eslint-base";
import {RULE_MAPPINGS_LWC} from "./rule-mappings/lwc";
import {RULE_MAPPINGS_TYPESCRIPT_ESLINT} from "./rule-mappings/typescript-eslint";
import {RULE_MAPPINGS_SLDS_HTML} from "./rule-mappings/slds-html";
import {RULE_MAPPINGS_SLDS_CSS} from "./rule-mappings/slds-css";
import {RULE_MAPPINGS_REACT} from "./rule-mappings/react";
import {RULE_MAPPINGS_REACT_A11Y} from "./rule-mappings/react-jsx-a11y";

export const RULE_MAPPINGS: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    ...RULE_MAPPINGS_ESLINT_BASE,
    ...RULE_MAPPINGS_LWC,
    ...RULE_MAPPINGS_TYPESCRIPT_ESLINT,
    ...RULE_MAPPINGS_SLDS_HTML,
    ...RULE_MAPPINGS_SLDS_CSS,
    ...RULE_MAPPINGS_REACT,
    ...RULE_MAPPINGS_REACT_A11Y,
};
