import {ESLint8EnginePlugin} from "../src";
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
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {changeWorkingDirectoryToPackageRoot, createDescribeOptions, createRunOptions} from "./test-helpers";
import {getMessage} from "../src/messages";

changeWorkingDirectoryToPackageRoot();

jest.setTimeout(30_000);

/**
 * NOTE THAT WE WANT TO KEEP THE AMOUNT OF TESTS HERE TO A MINIMUM!
 * All functionality should be tested at the unit level. This file ideally should only contain 1 (maybe 2) tests
 * at most to simply confirm that things can wire up correctly without failure.
 */
describe('End to end test', () => {
    it('Test typical end to end workflow', async () => {
        const plugin: EnginePluginV1 = new ESLint8EnginePlugin();
        const availableEngineNames: string[] = plugin.getAvailableEngineNames();
        expect(availableEngineNames).toHaveLength(1);
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.eslint');
        const defaultConfig: ConfigObject = await plugin.createEngineConfig('eslint', configValueExtractor);
        const engine: Engine = await plugin.createEngine(availableEngineNames[0], defaultConfig);
        const workspace: Workspace = new Workspace('id', [
            path.resolve('test', 'test-data', 'legacyConfigCases', 'workspace_NoCustomConfig')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));
        const recommendedRuleNames: string[] = ruleDescriptions.filter(rd => rd.tags.includes('Recommended')).map(rd => rd.name);
        const engineRunResults: EngineRunResults = await engine.runRules(recommendedRuleNames, createRunOptions(workspace));

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

    describe('Security regression: RCE via auto-discovered executable ESLint config', () => {
        const maliciousWorkspace: string = path.resolve('test', 'test-data', 'workspaceWithMaliciousLegacyConfig');
        const maliciousConfigFile: string = path.join(maliciousWorkspace, '.eslintrc.js');
        let sentinelPath: string;

        beforeEach(() => {
            sentinelPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rce-sentinel-')), 'sentinel.txt');
            process.env.SENTINEL_PATH = sentinelPath;
        });
        afterEach(() => {
            delete process.env.SENTINEL_PATH;
            if (fs.existsSync(sentinelPath)) {
                fs.rmSync(sentinelPath);
            }
        });

        it('When auto_discover_eslint_config=true and workspace contains a malicious executable config, then it is NOT executed and a skip warning is emitted', async () => {
            const plugin: EnginePluginV1 = new ESLint8EnginePlugin();
            const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({
                auto_discover_eslint_config: true
            }, 'engines.eslint');
            const engineConfig: ConfigObject = await plugin.createEngineConfig('eslint', configValueExtractor);
            const engine: Engine = await plugin.createEngine('eslint', engineConfig);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));

            const workspace: Workspace = new Workspace('id', [maliciousWorkspace]);
            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));
            const recommendedRuleNames: string[] = ruleDescriptions.filter(rd => rd.tags.includes('Recommended')).map(rd => rd.name);
            await engine.runRules(recommendedRuleNames, createRunOptions(workspace));

            // The malicious top-level code must NEVER have run during auto-discovery.
            expect(fs.existsSync(sentinelPath)).toEqual(false);

            const warnMessages: string[] = logEvents.filter(e => e.logLevel === LogLevel.Warn).map(e => e.message);
            expect(warnMessages).toContainEqual(getMessage('SkippedAutoDiscoveredExecutableConfigFile', maliciousConfigFile));
        });

        it('When the same config is explicitly opted into via eslint_config_file, then it executes and an execution warning is emitted', async () => {
            const plugin: EnginePluginV1 = new ESLint8EnginePlugin();
            const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({
                eslint_config_file: maliciousConfigFile
            }, 'engines.eslint');
            const engineConfig: ConfigObject = await plugin.createEngineConfig('eslint', configValueExtractor);
            const engine: Engine = await plugin.createEngine('eslint', engineConfig);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));

            const workspace: Workspace = new Workspace('id', [maliciousWorkspace]);
            await engine.describeRules(createDescribeOptions(workspace));

            // Explicit opt-in preserves the ability to apply (and therefore execute) a trusted config file.
            expect(fs.existsSync(sentinelPath)).toEqual(true);

            const warnMessages: string[] = logEvents.filter(e => e.logLevel === LogLevel.Warn).map(e => e.message);
            expect(warnMessages).toContainEqual(getMessage('ExplicitExecutableConfigFileWillExecute', maliciousConfigFile));
        });
    });
});