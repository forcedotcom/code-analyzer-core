import {ESLintEnginePlugin} from "../src";
import {
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import * as os from "node:os";
import process from "node:process";

jest.setTimeout(30_000);

/**
 * NOTE THAT WE WANT TO KEEP THE AMOUNT OF TESTS HERE TO A MINIMUM!
 * All functionality should be tested at the unit level. This file ideally should only contain 1 (maybe 2) tests
 * at most to simply confirm that things can wire up correctly without failure.
 *
 * IMPORTANT: This test uses the runtime RunESLintWorkerTask in a background thread which requires the
 * src/run-eslint-worker-task.ts file to be compiled down to a dist/run-eslint-worker-task.js file. So you'll need to
 * run the build to have the latest code in javascript before running these end-to-end tests.
 */
describe('End to end test', () => {
    let original_working_directory: string;
    beforeEach(() => {
        original_working_directory = process.cwd();
    });
    afterEach(() => {
        process.chdir(original_working_directory);
    });

    it('Test typical end to end workflow', async () => {
        process.chdir(path.resolve(__dirname, 'test-data', 'workspace_NoCustomConfig'));

        const plugin: EnginePluginV1 = new ESLintEnginePlugin();
        const availableEngineNames: string[] = plugin.getAvailableEngineNames();
        expect(availableEngineNames).toHaveLength(1);
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.eslint');
        const defaultConfig: ConfigObject = await plugin.createEngineConfig(availableEngineNames[0], configValueExtractor);
        const engine: Engine = await plugin.createEngine(availableEngineNames[0], defaultConfig);
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
        const workspace: Workspace = new Workspace('id', [path.resolve('.')]);
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

        const warnLogs: LogEvent[] = logEvents.filter(e => e.logLevel == LogLevel.Warn);
        expect(warnLogs).toHaveLength(0);
    });

    it('Test that we delegate to eslint v8 engine when user has specified legacy eslint config file', async () => {
        process.chdir(path.resolve(__dirname, 'test-data', 'workspaceWithLegacyConfigJson'));

        const plugin: EnginePluginV1 = new ESLintEnginePlugin();
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({
            eslint_config_file: path.resolve('.', '.eslintrc.json')
        }, 'engines.eslint');
        const defaultConfig: ConfigObject = await plugin.createEngineConfig('eslint', configValueExtractor);
        const engine: Engine = await plugin.createEngine('eslint', defaultConfig);
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
        const workspace: Workspace = new Workspace('id', [path.resolve('.')]);
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
        expect(violationsFromTsFile).toHaveLength(10);
        expect(new Set(violationsFromTsFile.map(v => v.ruleName))).toEqual(new Set([
            '@typescript-eslint/no-wrapper-object-types',
            '@typescript-eslint/no-unused-vars', // there are 4 of these
            'no-unused-vars', // There are 4 of these. Typically, these rules are turned off by typescript-eslint but the supplied '.eslintrc.json' turns them back on
            'no-invalid-regexp'
        ]));

        const warnLogs: LogEvent[] = logEvents.filter(e => e.logLevel == LogLevel.Warn);
        expect(warnLogs).toHaveLength(1);
        expect(warnLogs[0].message).toContain('Using ESLint v8 instead of ESLint v9');
    });
});
