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
    TelemetryEvent,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";
import {ESLint8EnginePlugin} from "@salesforce/code-analyzer-eslint8-engine";
import { createDescribeOptions, createRunOptions } from "./test-helpers";
import {getMessage} from "../src/messages";

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
        const telemetryEvents: TelemetryEvent[] = [];
        engine.onEvent(EventType.TelemetryEvent, (e: TelemetryEvent) => telemetryEvents.push(e));
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
        const workspace: Workspace = new Workspace('id', [path.resolve('.')]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));
        const recommendedRuleNames: string[] = ruleDescriptions.filter(rd => rd.tags.includes('Recommended')).map(rd => rd.name);
        const engineRunResults: EngineRunResults = await engine.runRules(recommendedRuleNames, createRunOptions(workspace));

        // JS violations
        const violationsFromJsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.js');
        expect(violationsFromJsFile).toHaveLength(3);
        expect(new Set(violationsFromJsFile.map(v => v.ruleName))).toEqual(new Set([
            'no-invalid-regexp',
            'no-unused-vars' // there are 2 of these
        ]));
        // TS violations
        const violationsFromTsFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.ts');
        expect(violationsFromTsFile).toHaveLength(6);
        expect(new Set(violationsFromTsFile.map(v => v.ruleName))).toEqual(new Set([
            '@typescript-eslint/no-wrapper-object-types',
            '@typescript-eslint/no-unused-vars', // there are 4 of these
            'no-invalid-regexp'
        ]));
        // HTML violations
        const violationsFromHTMLFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.html');
        expect(violationsFromHTMLFile).toHaveLength(1);
        expect(violationsFromHTMLFile[0].ruleName).toEqual('@salesforce-ux/slds/enforce-bem-usage');
        // CSS violations
        const violationsFromCSSFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.css');
        expect(violationsFromCSSFile).toHaveLength(6);
        expect(violationsFromCSSFile.some(v => v.ruleName === '@salesforce-ux/slds/no-slds-namespace-for-custom-hooks')).toBe(true);

        const warnLogs: LogEvent[] = logEvents.filter(e => e.logLevel == LogLevel.Warn);
        expect(warnLogs).toHaveLength(0);

        expect(telemetryEvents).toHaveLength(0);
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
        const telemetryEvents: TelemetryEvent[] = [];
        engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
        engine.onEvent(EventType.TelemetryEvent, (e: TelemetryEvent) => telemetryEvents.push(e));
        const workspace: Workspace = new Workspace('id', [path.resolve('.')]);
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
        expect(violationsFromTsFile).toHaveLength(10);
        expect(new Set(violationsFromTsFile.map(v => v.ruleName))).toEqual(new Set([
            '@typescript-eslint/no-wrapper-object-types',
            '@typescript-eslint/no-unused-vars', // there are 4 of these
            'no-unused-vars', // There are 4 of these. Typically, these rules are turned off by typescript-eslint but the supplied '.eslintrc.json' turns them back on
            'no-invalid-regexp'
        ]));

        // SLDS violations are only relevant for v9+
        const violationsFromHTMLFile: Violation[] = engineRunResults.violations.filter(v => path.extname(v.codeLocations[0].file) === '.html');
        expect(violationsFromHTMLFile).toHaveLength(0);

        const warnLogs: LogEvent[] = logEvents.filter(e => e.logLevel == LogLevel.Warn);
        expect(warnLogs).toHaveLength(1);
        expect(warnLogs[0].message).toContain('Using ESLint v8 instead of ESLint v9');

        expect(telemetryEvents).toHaveLength(1);
        expect(telemetryEvents[0]).toEqual({
            "type": "TelemetryEvent",
            "eventName": "eslintLegacyConfigDetected",
            "data": {
                "eslint_engine_version": await engine.getEngineVersion(),
                "eslint8_engine_version": await (await new ESLint8EnginePlugin().createEngine("eslint", {})).getEngineVersion()
            }
        });
    });

    describe('Security regression: RCE via auto-discovered executable ESLint config', () => {
        const maliciousWorkspace: string = path.resolve(__dirname, 'test-data', 'workspaceWithMaliciousFlatConfig');
        const maliciousConfigFile: string = path.join(maliciousWorkspace, 'eslint.config.cjs');
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
            const plugin: EnginePluginV1 = new ESLintEnginePlugin();
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
            const plugin: EnginePluginV1 = new ESLintEnginePlugin();
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