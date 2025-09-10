import {PmdEngine} from "../src/pmd-engine";
import {DEFAULT_PMD_ENGINE_CONFIG} from "../src/config";
import {RuleDescription} from "@salesforce/code-analyzer-engine-api";
import {RULE_MAPPINGS} from "../src/pmd-rule-mappings";
import { createDescribeOptions } from "./test-helpers";

describe('Tests for the rule-mappings', () => {
    it('Test that the list of all bundled PMD rules (from all languages) matches the list of languages in our RULE_MAPPINGS list', async () => {
        const engine: PmdEngine = new PmdEngine(DEFAULT_PMD_ENGINE_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        const actualRuleNames: Set<string> = new Set(ruleDescriptions.map(rd => rd.name));
        const ruleNamesInRuleMappings: Set<string> = new Set(Object.keys(RULE_MAPPINGS));

        const unusedRuleNamesFromRuleMappings: Set<string> = setDiff(ruleNamesInRuleMappings, actualRuleNames);
        if (unusedRuleNamesFromRuleMappings.size > 0) {
            throw new Error("The following rule names are found in RULE_MAPPINGS but do not associated to any bundled PMD rules (maybe PMD deprecated the rule):\n    " +
                [...unusedRuleNamesFromRuleMappings].join(', '));

        }

        const missingRuleNamesFromRuleMappings: Set<string> = setDiff(actualRuleNames, ruleNamesInRuleMappings);
        if (missingRuleNamesFromRuleMappings.size > 0) {
            throw new Error("The following bundled PMD rules are missing from the RULE_MAPPINGS list:\n    " +
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