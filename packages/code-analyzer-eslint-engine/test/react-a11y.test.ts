import {Engine, RuleDescription} from "@salesforce/code-analyzer-engine-api";
import {ESLintEnginePlugin} from "../src";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {createDescribeOptions} from "./test-helpers";
import {RULE_MAPPINGS} from "../src/rule-mappings";

describe('jsx-a11y plugin integration', () => {
    it('exposes core jsx-a11y rules with React tagging', async () => {
        const config: ESLintEngineConfig = {
            ...DEFAULT_CONFIG,
            config_root: __dirname
        };
        const enginePlugin: ESLintEnginePlugin = new ESLintEnginePlugin();
        const engine: Engine = await enginePlugin.createEngine('eslint', config);
        const rules: RuleDescription[] = await engine.describeRules(createDescribeOptions());

        const byName = (n: string) => rules.find(r => r.name === n);
        const a11yRulesToCheck = [
            'jsx-a11y/alt-text',
            'jsx-a11y/anchor-has-content',
            'jsx-a11y/anchor-is-valid',
            'jsx-a11y/tabindex-no-positive'
        ];

        for (const ruleName of a11yRulesToCheck) {
            const rule = byName(ruleName);
            expect(rule).toBeDefined();
            expect(rule!.tags).toContain('React');
        }
    });

    it('includes all A11y-tagged rules from rule-mappings', async () => {
        const config: ESLintEngineConfig = {
            ...DEFAULT_CONFIG,
            config_root: __dirname
        };
        const engine: Engine = await new ESLintEnginePlugin().createEngine('eslint', config);
        const rules: RuleDescription[] = await engine.describeRules(createDescribeOptions());

        const actualA11yRuleNames: string[] = rules
            .filter(r => r.tags.includes('A11y'))
            .map(r => r.name)
            .sort();

        const expectedA11yRuleNames: string[] = Object.entries(RULE_MAPPINGS)
            .filter(([, v]) => v.tags.includes('A11y'))
            .map(([k]) => k)
            .sort();

        expect(actualA11yRuleNames).toEqual(expectedA11yRuleNames);
    });
});

