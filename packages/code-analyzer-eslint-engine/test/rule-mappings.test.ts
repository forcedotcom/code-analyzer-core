import {Engine, RuleDescription} from "@salesforce/code-analyzer-engine-api";
import {RULE_MAPPINGS} from "../src/rule-mappings";
import {DEFAULT_CONFIG} from "../src/config";
import {ESLintEnginePlugin} from "../src";
import { createDescribeOptions } from "./test-helpers";

describe('Tests for the rule-mappings', () => {
    it('Test that the list of all bundled rules matches our RULE_MAPPINGS list', async () => {
        const enginePlugin: ESLintEnginePlugin = new ESLintEnginePlugin();
        // React is gated in production (default: true). For testing, enable it (eventual default: false)
        const engine: Engine = await enginePlugin.createEngine('eslint', {
            ...DEFAULT_CONFIG,
            disable_react_base_config: false
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        const actualRuleNames: Set<string> = new Set(ruleDescriptions.map(rd => rd.name));
        const ruleNamesInRuleMappings: Set<string> = new Set(Object.keys(RULE_MAPPINGS));

        const unusedRuleNamesFromRuleMappings: Set<string> = setDiff(ruleNamesInRuleMappings, actualRuleNames);
        if (unusedRuleNamesFromRuleMappings.size > 0) {
            throw new Error("The following rule names are found in RULE_MAPPINGS but do not associated to any bundled eslint rules that come with our base configs:\n    " +
                [...unusedRuleNamesFromRuleMappings].join(', '));

        }

        const missingRuleNamesFromRuleMappings: Set<string> = setDiff(actualRuleNames, ruleNamesInRuleMappings);
        if (missingRuleNamesFromRuleMappings.size > 0) {
            throw new Error("The following bundled rules are missing from the RULE_MAPPINGS list (Note: when adding them, make sure to add in the appropriate language tags):\n    " +
                [...missingRuleNamesFromRuleMappings].join(', ') + "\n\n" +
                "Calculated Rule Descriptions for the missing rules: \n" +
                JSON.stringify(ruleDescriptions.filter(rd => missingRuleNamesFromRuleMappings.has(rd.name)), null, 2)
            );
        }
    });
});

function setDiff(setA: Set<string>, setB: Set<string>): Set<string> {
    return new Set(
        [...setA].filter(value => !setB.has(value))
    );
}