import {
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RunRulesProgressEvent,
    RuleDescription,
    RunOptions,
    Violation,
    Workspace, DescribeOptions,
    ConfigObject,
    Engine
} from "@salesforce/code-analyzer-engine-api";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {ESLintEngine} from "../src/engine";
import {DEFAULT_CONFIG} from "../src/config";
import {getMessage} from "../src/messages";
import * as os from "node:os";
import {ESLintEnginePlugin} from "../src";

changeWorkingDirectoryToPackageRoot();

jest.setTimeout(30_000);

const testDataFolder: string = path.join(__dirname, 'test-data');
const workspaceWithNoCustomConfig: string = path.join(testDataFolder, 'workspace_NoCustomConfig');

describe('Tests for the getName method of ESLintEngine', () => {
    it('When getName is called, then eslint is returned', () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        expect(engine.getName()).toEqual('eslint');
    });
});

describe('Tests for the describeRules method of ESLintEngine', () => {
    const LWC_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyLwcBaseConfig.goldfile.json');
    const JS_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyJavaScriptBaseConfig.goldfile.json');
    const TS_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyTypeScriptBaseConfig.goldfile.json');
    const DEFAULT_RULES: RuleDescription[] = makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...TS_CONFIG_RULES]);

    type TEST_SCENARIO = {description: string, folder: string, expectationRuleDescriptions: RuleDescription[]};
    const testScenarios: TEST_SCENARIO[] = [
        {
            description: 'with no customizations',
            folder: workspaceWithNoCustomConfig,
            expectationRuleDescriptions: DEFAULT_RULES
        }
        // TODO: Add in tests for flat config that modifies existing rules
        // TODO: Add in tests for flat config that adds a new plugin and rules
    ]

    it.each(testScenarios)('When describing rules while cwd is folder $description and auto_discover_eslint_config=true, then return expected', async (caseObj: TEST_SCENARIO) => {
        const origWorkingDir: string = process.cwd();
        process.chdir(caseObj.folder);
        try {
            const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG,
                auto_discover_eslint_config: true
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({logFolder: os.tmpdir()});
            expect(ruleDescriptions).toEqual(caseObj.expectationRuleDescriptions);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it.each(testScenarios)('When describing rules while from a workspace $description and auto_discover_eslint_config=true, then return expected', async (caseObj: TEST_SCENARIO) => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id', [caseObj.folder])));
        expect(ruleDescriptions).toEqual(caseObj.expectationRuleDescriptions);
    });

    it.each(testScenarios)('When describing rules while config_root is folder $description and auto_discover_eslint_config=true, then return expected', async (caseObj: TEST_SCENARIO) => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            auto_discover_eslint_config: true,
            config_root: caseObj.folder
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(caseObj.expectationRuleDescriptions);
    });

    it('When describing rules from a workspace targeting no javascript files, then no javascript rules should return', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id',
            [testDataFolder],
            [
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt'),
                path.join(workspaceWithNoCustomConfig, 'dummy2.ts')
            ])));
        expect(ruleDescriptions).toEqual(TS_CONFIG_RULES);
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id', [
                path.join(workspaceWithNoCustomConfig, 'dummy1.js'),
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])));
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES]));
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])));
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When describing rules from an empty workspace, then no rules should return', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id', [])));
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When disable_javascript_base_config=true, then the base rules are removed for javascript only', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_javascript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...TS_CONFIG_RULES]));
    });

    it('When disable_lwc_base_config=true, then the lwc rules are removed but javascript rules remain', async() => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...JS_CONFIG_RULES, ...TS_CONFIG_RULES]));
    });

    it('When disable_typescript_base_config=true, then the typescript rules are removed', async() => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_typescript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES]));
    });

    it('When disable_lwc_base_config=true and disable_typescript_base_config=true, then only base javascript rules remain', async() => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(JS_CONFIG_RULES);
    });

    it('When disable_javascript_base_config=true and disable_lwc_base_config=true, then only base typescript rules remain', async() => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_lwc_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(TS_CONFIG_RULES);
    });

    it('When disable_javascript_base_config=true and disable_typescript_base_config=true, then only base lwc rules remain', async() => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(LWC_CONFIG_RULES);
    });

    it('When all *_javascript_base_config equal true and no custom config exists, then no rules should exist', async() => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toHaveLength(0);
    });
    it('When file_extensions.javascript is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            file_extensions: {
                ... DEFAULT_CONFIG.file_extensions,
                javascript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(TS_CONFIG_RULES);
    });

    it('When file_extensions.typescript is empty, then javascript rules do not get picked up', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            file_extensions: {
                ... DEFAULT_CONFIG.file_extensions,
                typescript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES]));
    });

    it('When file_extensions.javascript and file_extensions.typescript are both empty, then no rules are returned', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin({...DEFAULT_CONFIG,
            file_extensions: {
                ...DEFAULT_CONFIG.file_extensions,
                javascript: [],
                typescript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toHaveLength(0);
    });

    // TODO The following tests from v8 were removed. Once we add in flat config support with v9, we should add in
    //      equivalent tests if they are still applicable:
    //        * When eslint_config_file is provided, then it is applied
    //        * When auto_discover_eslint_config=false and eslint_config_file is not provided, then no user config should be applied
    //        * When auto_discover_eslint_config=false and eslint_config_file is provided, the supplied config file is used but others are not
    //        * When all base configs are off and custom config with new rules exists, when auto_discover_eslint_config=true then only custom config is applied
    //        * When all base configs are off and custom config that modifies eslint rules exists and auto_discover_eslint_config=true, then only custom config is applied
    //        * When workspace contains custom config that installs same plugin as one of our base plugins, we should make eslint conflict error helpful
    //        * When configuration file contains plugin that cannot be found, then error with helpful message
    //        * When workspace contains ignored file based on eslint config, then that file is ignored during rule calculation
    //        * When workspace contains .eslintignore that ignores a file but has not be applied, then that file not ignored and an info event is emitted
    //        * When workspace contains .eslintignore that ignores a file and auto_discover_eslint_config=true, then that file is ignored
    //        * When workspace contains .eslintignore that is set as the eslint_ignore_file value, then that file is ignored
    //        * When custom rules only apply to file extensions that are not javascript or typescript based, then without specifying file extensions, they are not picked up
    //        * When custom rules only apply to file extensions that are not javascript or typescript based, then when specifying file extensions, they are picked up
    // For now we just maintain a test that the v9 eslint engine errors until it has been implemented:
    it('When directly calling describeRules on the v9 ESLintEngine, then we error since it has not been implemented', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        await expect(engine.describeRules(createDescribeOptions())).rejects.toThrow(
            'Not implemented. Soon this will be implemented for ESLint v9.');
    });
});

describe('Typical tests for the runRules method of ESLintEngine', () => {
    const expectedJsViolation_noInvalidRegexp: Violation = {
        "codeLocations": [{
            "endColumn": 30,
            "endLine": 2,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy1.js'),
            "startColumn": 15,
            "startLine": 2
        }],
        "message": "Invalid regular expression: /[/: Unterminated character class.",
        "primaryLocationIndex": 0,
        "ruleName": "no-invalid-regexp"
    };
    const expectedTsViolation_noInvalidRegexp: Violation = {
        "codeLocations": [{
            "endColumn": 38,
            "endLine": 6,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy2.ts'),
            "startColumn": 23,
            "startLine": 6
        }],
        "message": "Invalid regular expression: /[/: Unterminated character class.",
        "primaryLocationIndex": 0,
        "ruleName": "no-invalid-regexp"
    };
    const expectedTsViolation_noWrapperObjectTypes: Violation = {
        "codeLocations": [{
            "endColumn": 20,
            "endLine": 2,
            "file": path.join(workspaceWithNoCustomConfig, 'dummy2.ts'),
            "startColumn": 14,
            "startLine": 2
        }],
        "message": "Prefer using the primitive `string` as a type name, rather than the upper-cased `String`.",
        "primaryLocationIndex": 0,
        "ruleName": "@typescript-eslint/no-wrapper-object-types"
    };

    it('When running with defaults and no customizations, then violations for javascript and typescript are found correctly', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types'], runOptions);

        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expectedJsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noWrapperObjectTypes);
    });

    it('When workspace only targets javascript files, then only javascript violations are returned', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig],
            [path.join(workspaceWithNoCustomConfig, 'dummy1.js')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedJsViolation_noInvalidRegexp]);
    });

    it('When workspace only contains typescript files, then only typescript violations are returned', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy2.ts')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedTsViolation_noInvalidRegexp]);
    });

    it('When workspace does not contains javascript or typescript files, then zero violations are returned', async () => {
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy3.txt')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toHaveLength(0);
    });

    it('When runRules is called on a workspace that has a babel configuration file, then the file is ignored and no error events are thrown', async () => {
        const folderContainingBabelConfigFile: string = path.join(testDataFolder,'workspaceWithBabelConfigFile');
        const logEvents: LogEvent[] = [];
        const engine: ESLintEngine = await createEngineFromPlugin(DEFAULT_CONFIG);
        const origWorkingDir: string = process.cwd();
        process.chdir(folderContainingBabelConfigFile);
        try {
            const runOptions: RunOptions = createRunOptions(new Workspace('id', [folderContainingBabelConfigFile]));
            engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
            await engine.runRules(['@lwc/lwc/no-unexpected-wire-adapter-usages'], runOptions);
            expect(logEvents.filter(ev => ev.logLevel === LogLevel.Error)).toHaveLength(0);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    // TODO The following tests from v8 were removed. Once we add in flat config support with v9, we should add in
    //      equivalent tests if they are still applicable:
    //        * When using custom plugin rules, then violations from custom rules are returned
    //        * When custom rules only apply to file extensions that are not javascript or typescript based, then when specifying file extensions, the rules run
    //        * When custom eslint config exists but is not applied, then runRules emits info message
    //        * When runRules is called on workspace with a config that ignores files and auto discover is true, then those files are ignored
    //        * When runRules is called and a ".eslintignore" file is provided that ignores files, then those files are ignored
    // For now we just maintain a test that the v9 eslint engine errors until it has been implemented:
    it('When directly calling describeRules on the v9 ESLintEngine, then we error since it has not been implemented', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig]));
        await expect(engine.runRules(['no-invalid-regexp'], runOptions)).rejects.toThrow(
            'Not implemented. Soon this will be implemented for ESLint v9.');
    });

});

describe('Tests for the getEngineVersion method of ESLint Engine', () => {
    it('getEngineVersion() outputs something resembling a Semantic Version', async () => {
        const engine: ESLintEngine = new ESLintEngine(DEFAULT_CONFIG);
        const version: string = await engine.getEngineVersion();

        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });
});

describe('Tests for emitting events', () => {
    let engine: ESLintEngine;
    let logEvents: LogEvent[];
    let runRulesProgressEvents: RunRulesProgressEvent[];
    let describeRulesProgressEvents: DescribeRulesProgressEvent[];
    beforeEach(async () => {
        engine = await createEngineFromPlugin(DEFAULT_CONFIG);
        logEvents = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        runRulesProgressEvents = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (event: RunRulesProgressEvent) => runRulesProgressEvents.push(event));
        describeRulesProgressEvents = [];
        engine.onEvent(EventType.DescribeRulesProgressEvent, (event: DescribeRulesProgressEvent) => describeRulesProgressEvents.push(event));
    })

    it('When workspace contains an unparsable javascript file, then we emit an error log event and continue to next file', async () => {
        const workspaceFolder: string = path.join(testDataFolder, 'workspaceWithUnparsableCode');
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceFolder]));
        const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

        const errorEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Error);
        expect(errorEvents).toHaveLength(1);
        expect(errorEvents[0].logLevel).toEqual(LogLevel.Error);
        expect(errorEvents[0].message).toEqual(
            getMessage('ESLintErroredWhenScanningFile', path.join(workspaceFolder, 'unparsableFile.js'),
                '    Parsing error: Unterminated string constant. (2:4)'));

        // Sanity check that we still get violations from files that could be parsed
        expect(results.violations).toHaveLength(1);
        expect(results.violations[0].codeLocations[0].file).toEqual(
            path.join(workspaceFolder, 'parsableFileWithViolation.js'));
    });

    it('When describeRules is called, then it emits correct progress events', async () => {
        await engine.describeRules(createDescribeOptions());
        expect(describeRulesProgressEvents.map(e => e.percentComplete)).toEqual([0, 10, 40, 80, 100]);
    });

    it('When runRules is called, then it emits correct progress events', async () => {
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig]));
        await engine.runRules(['no-unused-vars'], runOptions);
        expect(runRulesProgressEvents.map(e => e.percentComplete)).toEqual([0, 30, 95, 100]);
    });
});

function loadRuleDescriptions(fileNameFromTestDataFolder: string): RuleDescription[] {
    return JSON.parse(fs.readFileSync(path.join(testDataFolder,
        fileNameFromTestDataFolder), 'utf8')) as RuleDescription[];
}

function makeUniqueAndSorted(ruleDescriptions: RuleDescription[]): RuleDescription[] {
    return Array.from(new Map(ruleDescriptions.map(rule => [rule.name, rule])).values())
        .sort((r1, r2) => r1.name.localeCompare((r2.name)));
}

function createDescribeOptions(workspace?: Workspace): DescribeOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace
    }
}

function createRunOptions(workspace: Workspace): RunOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace
    }
}

// To be used temporarily while we are still migrating tests from using v8 to v9.
// The goal is to eventually get rid of this and use the ESLint constructor again soon to turn the tests back on for v9.
async function createEngineFromPlugin(configObject: ConfigObject): Promise<Engine> {
    const plugin: ESLintEnginePlugin = new ESLintEnginePlugin();
    return await plugin.createEngine('eslint', configObject);
}
