import { RuleSelectionFormatter } from "../../output-format";
import { Rule, RuleSelection } from "../../rules";

export type JsonRuleSelectionOutput = {
    rules: JsonRuleOutput[];
}

export type JsonRuleOutput = {
    // The name of the rule
    name: string

    // The description of the rule
    description: string

    // The engine associated with the rule
    engine: string
    
    // The severity level associated with the rule
    severity: number

    // The tags associated associated with the rule that can be used in rule selection
    tags: string[]

    // An array of urls for resources associated with the rule (optional)
    resources?: string[]
} 

/**
 * Formatter for Rules JSON Output Format
 */
export class JsonRulesFormatter implements RuleSelectionFormatter {
    format(ruleSelection: RuleSelection): string {
        const rulesOutput: JsonRuleSelectionOutput = toJsonRuleSelectionOutput(ruleSelection);
        return JSON.stringify(rulesOutput, undefined, 2);
    }
}

function toJsonRuleSelectionOutput(ruleSelection: RuleSelection): JsonRuleSelectionOutput {
    return {
        rules: toJsonRuleOutputArray(ruleSelection)
    }
}

function toJsonRuleOutputArray(ruleSelection: RuleSelection): JsonRuleOutput[] {
    const selectedRules: Rule[] = ruleSelection.getEngineNames().flatMap(name => ruleSelection.getRulesFor(name));
    return selectedRules.map((rule) => toJsonRuleOutput(rule));
}

function toJsonRuleOutput(rule: Rule): JsonRuleOutput {
    return {
        name: rule.getName(),
        description: rule.getDescription(),
        engine: rule.getEngineName(),
        severity: rule.getSeverityLevel(),
        tags: rule.getTags(),
        resources: rule.getResourceUrls()
    }
}