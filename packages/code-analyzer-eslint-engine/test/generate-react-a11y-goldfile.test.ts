import * as fs from "node:fs";
import * as path from "node:path";
import {Engine, RuleDescription} from "@salesforce/code-analyzer-engine-api";
import {ESLintEnginePlugin} from "../src";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {createDescribeOptions} from "./test-helpers";

/**
 * One-off generator to refresh the goldfile for jsx-a11y rules derived from the engine.
 * Run:
 *   npm run test-typescript -- packages/code-analyzer-eslint-engine/test/generate-react-a11y-goldfile.test.ts
 */
describe('GENERATE React A11y goldfile (one-off)', () => {
    it('writes test/test-data/rules_ReactA11yConfig.goldfile.json', async () => {
        const config: ESLintEngineConfig = {
            ...DEFAULT_CONFIG,
            config_root: __dirname,
            // Ensure React stack is enabled during generation
            disable_react_base_config: false
        };
        const enginePlugin = new ESLintEnginePlugin();
        const engine: Engine = await enginePlugin.createEngine('eslint', config);
        const allRules: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        const a11yRules: RuleDescription[] = allRules
            .filter(r => r.name.startsWith('jsx-a11y/'))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(r => ({
                description: r.description,
                name: r.name,
                resourceUrls: r.resourceUrls,
                severityLevel: r.severityLevel,
                tags: r.tags
            }));

        const outPath = path.join(__dirname, 'test-data', 'rules_ReactA11yConfig.goldfile.json');
        fs.writeFileSync(outPath, JSON.stringify(a11yRules, null, 2) + "\n", {encoding: 'utf8'});
        expect(fs.existsSync(outPath)).toBe(true);
    });
});

