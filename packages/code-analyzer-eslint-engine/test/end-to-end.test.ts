import {ESLintEnginePlugin} from "../src";
import {
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

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
        const engine: Engine = await plugin.createEngine(availableEngineNames[0], {});
        const workspace: Workspace = testTools.createWorkspace([
            path.resolve('test', 'test-data', 'legacyConfigCases', 'workspace_NoCustomConfig')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        const recommendedRuleNames: string[] = ruleDescriptions.filter(rd => rd.tags.includes('Recommended')).map(rd => rd.name);
        const engineRunResults: EngineRunResults = await engine.runRules(recommendedRuleNames, {workspace: workspace});

        const violationsFromJsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.js');
        expect(violationsFromJsFile).toHaveLength(3);
        expect(new Set(violationsFromJsFile.map(v => v.ruleName))).toEqual(new Set([
            'no-invalid-regexp',
            'no-unused-vars' // there are 2 of these
        ]));
        const violationsFromTsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.ts');
        expect(violationsFromTsFile).toHaveLength(6);
        expect(new Set(violationsFromTsFile.map(v => v.ruleName))).toEqual(new Set([
            '@typescript-eslint/ban-types',
            '@typescript-eslint/no-unused-vars', // there are 4 of these
            'no-invalid-regexp'
        ]));
    });
});