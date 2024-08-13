import {RegexEnginePlugin} from "../src";
import {
    ConfigObject,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

describe('End to end test', () => {
    it('Test typical end to end workflow', async () => {
        const plugin: EnginePluginV1 = new RegexEnginePlugin();
        const availableEngineNames: string[] = plugin.getAvailableEngineNames();
        expect(availableEngineNames).toHaveLength(1);
        const customConfig: ConfigObject = {
            custom_rules: {
                "NoTodos": {
                    description: "Detects TODO comments in code",
                    regex: String.raw`/TODO/gi`
                }
            }
        }
        const engine: Engine = await plugin.createEngine(availableEngineNames[0], customConfig);
        const workspace: Workspace = new Workspace([path.resolve(__dirname, 'test-data', 'workspaceWithPythonFile')]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: workspace});
        const recommendedRuleNames: string[] = ruleDescriptions.filter(rd => rd.tags.includes('Recommended')).map(rd => rd.name);
        const engineRunResults: EngineRunResults = await engine.runRules(recommendedRuleNames, {workspace: workspace});
        const violationsFromPyFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.py');

        expect(violationsFromPyFile).toHaveLength(1);
        expect(violationsFromPyFile.map(v => v.ruleName)).toEqual(['NoTodos']);

        const violationsFromClsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.cls');

        expect(violationsFromClsFile).toHaveLength(1);
        expect(violationsFromClsFile.map(v => v.ruleName)).toEqual(['NoTrailingWhitespace']);
    });
});