import { EngineRunResults, RuleDescription, RunOptions, Workspace } from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import * as os from "node:os";
import path from "path";
import { TemplateEngine } from "../src/engine";
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

// *** Update to your new name
describe('Template Engine Tests', () => {

    let ALL_EXPECTED_RULES: RuleDescription[];

    beforeAll(async() => {
        ALL_EXPECTED_RULES = await getExpectedRulesFromGoldFile('temp-goldfile.json');
    });

    describe('getName', () => {
        // *** Update to your new name + engine
        it('When getName is called, then name is returned', () => {
            const engine: TemplateEngine = new TemplateEngine();
            expect(engine.getName()).toEqual('template');
        });
    });

    describe('getVersion', () => {
        // *** Update to your new engine
        it('Outputs something resembling a semantic version', async () => {
            const engine: TemplateEngine = new TemplateEngine();
            const version: string = await engine.getEngineVersion();
    
            expect(version).toMatch(/\d+\.\d+\.\d+.*/);
        });
    });

    describe('describeRules', () => {
        // *** Update to your new engine;
        // add more checks for specific rules, describe options, and logging events
        it('Returns all rules', async () => {
            const engine: TemplateEngine = new TemplateEngine();
            const rules: RuleDescription[] = await engine.describeRules({logFolder: os.tmpdir()});
    
            expect(rules).toEqual(ALL_EXPECTED_RULES);
        });
    });

    describe('runRules', () => {
        // *** Update to your new engine;
        // add more checks for specific rules, describe options, and logging events
        it('When zero rule names are provided then return zero violations', async () => {
            const engine: TemplateEngine = new TemplateEngine();
            const results: EngineRunResults = await engine.runRules([], createRunOptions(new Workspace('id', [TEST_DATA_FOLDER])));
            expect(results.violations).toHaveLength(0);
        });

        // *** Update to your new engine;
        // Test violations
    });

    async function getExpectedRulesFromGoldFile(relativeExpectedFile: string): Promise<RuleDescription[]> {
        const expectedRulesJsonStr: string =  (await fs.promises.readFile(path.join(TEST_DATA_FOLDER, relativeExpectedFile), 'utf-8'));
        return JSON.parse(expectedRulesJsonStr) as RuleDescription[];
    }

    function createRunOptions(workspace: Workspace): RunOptions {
        return {
            logFolder: os.tmpdir(),
            workspace: workspace
        }
    }
});
