import {ESLintEnginePlugin} from "../src";
import {
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import * as os from "node:os";

changeWorkingDirectoryToPackageRoot();

jest.setTimeout(30_000);

/**
 * NOTE THAT WE WANT TO KEEP THE AMOUNT OF TESTS HERE TO A MINIMUM!
 * All functionality should be tested at the unit level. This file ideally should only contain 1 (maybe 2) tests
 * at most to simply confirm that things can wire up correctly without failure.
 */
describe('End to end test', () => {
    it('Test typical end to end workflow', async () => {
        const plugin: EnginePluginV1 = new ESLintEnginePlugin();
        const availableEngineNames: string[] = plugin.getAvailableEngineNames();
        expect(availableEngineNames).toHaveLength(1);
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.eslint');
        const defaultConfig: ConfigObject = await plugin.createEngineConfig('eslint', configValueExtractor);
        const engine: Engine = await plugin.createEngine(availableEngineNames[0], defaultConfig);
        const workspace: Workspace = new Workspace('id', [
            path.resolve('test', 'test-data', 'workspace_NoCustomConfig')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({logFolder: os.tmpdir(), workspace: workspace});
        const recommendedRuleNames: string[] = ruleDescriptions.filter(rd => rd.tags.includes('Recommended')).map(rd => rd.name);
        const engineRunResults: EngineRunResults = await engine.runRules(recommendedRuleNames, {logFolder: os.tmpdir(), workspace: workspace});

        const violationsFromJsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.js');
        expect(violationsFromJsFile).toHaveLength(3);
        expect(new Set(violationsFromJsFile.map(v => v.ruleName))).toEqual(new Set([
            'no-invalid-regexp',
            'no-unused-vars' // there are 2 of these
        ]));
        const violationsFromTsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.ts');
        expect(violationsFromTsFile).toHaveLength(6);
        expect(new Set(violationsFromTsFile.map(v => v.ruleName))).toEqual(new Set([
            '@typescript-eslint/no-wrapper-object-types',
            '@typescript-eslint/no-unused-vars', // there are 4 of these
            'no-invalid-regexp'
        ]));
    });
});
