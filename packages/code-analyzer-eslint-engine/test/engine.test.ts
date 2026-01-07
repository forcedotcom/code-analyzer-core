import {
    ConfigObject,
    DescribeRulesProgressEvent,
    Engine,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunOptions,
    RunRulesProgressEvent,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {getMessage} from "../src/messages";
import * as os from "node:os";
import {ESLintEnginePlugin} from "../src";
import {ESLintEngine} from "../src/engine";
import {createDescribeOptions, createRunOptions, unzipToFolder} from "./test-helpers";

jest.setTimeout(60_000);

const DEFAULT_CONFIG_FOR_TESTING: ESLintEngineConfig = {
    ...DEFAULT_CONFIG,
    config_root: __dirname,
    // React is gated in production (default: true). For testing, enable it (eventual default: false)
    disable_react_base_config: false
}

const testDataFolder: string = path.join(__dirname, 'test-data');
const workspaceWithNoCustomConfig: string = path.join(testDataFolder, 'workspace_NoCustomConfig');
const workspaceThatHasCustomConfigModifyingExistingRules: string = path.join(testDataFolder, 'workspaceWithFlatConfigCjs');
const workspaceThatHasCustomConfigWithNewRules: string = path.join(testDataFolder, 'workspaceWithFlatConfigWithNewRules');
const workspaceWithReactFiles: string = path.join(testDataFolder, 'workspaceWithReactFiles');

let original_working_directory: string;
beforeAll(() => {
    // Since eslint auto discovers based on workspace dir, then config root, and then process.cwd()...
    // we need to make sure that we don't accidentally sit inside our package root folder which contains our
    // eslint.config.mjs file. Otherwise, we'll never hit the NO_USER_CONFIG cases. So we CD to test directory.
    original_working_directory = process.cwd();
    process.chdir(__dirname);
});
afterAll(() => {
    process.chdir(original_working_directory);
});


describe('Tests for the getName method of ESLintEngine', () => {
    it('When getName is called, then eslint is returned', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        expect(engine.getName()).toEqual('eslint');
    });
});

describe('Tests for the describeRules method of ESLintEngine', () => {
    const LWC_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyLwcBaseConfig.goldfile.json');
    const JS_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyJavaScriptBaseConfig.goldfile.json');
    const TS_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyTypeScriptBaseConfig.goldfile.json');
    const CSS_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlySldsCssBaseConfig.goldfile.json');
    const HTML_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlySldsHtmlBaseConfig.goldfile.json');
    const REACT_CONFIG_RULES: RuleDescription[] = loadRuleDescriptions('rules_ReactConfig.goldfile.json');
    const SLDS_CONFIG_RULES: RuleDescription[] = makeUniqueAndSorted([...CSS_CONFIG_RULES, ...HTML_CONFIG_RULES]);
    // React rules apply to all JS files (not just .jsx) - if no React code, rules simply don't report violations
    const DEFAULT_RULES: RuleDescription[] = makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...TS_CONFIG_RULES, ...SLDS_CONFIG_RULES, ...REACT_CONFIG_RULES]);
    const CUSTOM_RULES: RuleDescription[] = loadRuleDescriptions('rules_OnlyCustomConfigWithNewRules.goldfile.json');

    // The config for workspaceThatHasCustomConfigModifyingExistingRules modifies some rule properties. This does not
    // impact the rule descriptions. If error is modified to warn then it doesn't impact the severity since we still
    // fetch from rule mappings. If a rule is turned off, then it is indeed removed. So no-useless-escape is removed.
    const EXPECTED_RULES_FOR_BASE_PLUS_CONFIG_THAT_MODIFIES_EXISTING_RULES: RuleDescription[] = DEFAULT_RULES.filter(
        r => r.name !== 'no-useless-escape')
    const EXPECTED_RULES_FOR_ONLY_CONFIG_THAT_MODIFIES_EXISTING_RULES: RuleDescription[] = DEFAULT_RULES.filter(
        r => ["array-callback-return", "no-unused-vars", "no-useless-backreference"].includes(r.name));


    // React rules now apply to all JS files, so all tests with JS files get React rules
    type TEST_SCENARIO = {description: string, folder: string, expectationRuleDescriptions: RuleDescription[]};
    const testScenarios: TEST_SCENARIO[] = [
        {
            description: 'with no customizations',
            folder: workspaceWithNoCustomConfig,
            expectationRuleDescriptions: DEFAULT_RULES
        },
        {
            description: 'with config that modifies existing rules',
            folder: workspaceThatHasCustomConfigModifyingExistingRules,
            // The config modifies some rule properties. This does not impact the rule descriptions. If error is
            // modified to warn then it doesn't impact the severity since we still grab it from our rule mappings.
            // But if a rule is turned off, then it is indeed removed, this no-useless-escape is removed.
            expectationRuleDescriptions: EXPECTED_RULES_FOR_BASE_PLUS_CONFIG_THAT_MODIFIES_EXISTING_RULES
        },
        {
            description: 'with config that adds a new plugin and rules',
            folder: workspaceThatHasCustomConfigWithNewRules,
            expectationRuleDescriptions: makeUniqueAndSorted([...DEFAULT_RULES, ...CUSTOM_RULES])
        }
    ]

    it.each(testScenarios)('When describing rules while cwd is folder $description and auto_discover_eslint_config=true, then return expected', async (caseObj: TEST_SCENARIO) => {
        const origWorkingDir: string = process.cwd();
        process.chdir(caseObj.folder);
        try {
            const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
                config_root: __dirname,
                auto_discover_eslint_config: true,
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
            expect(ruleDescriptions).toEqual(caseObj.expectationRuleDescriptions);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it.each(testScenarios)('When describing rules while from a workspace $description and auto_discover_eslint_config=true, then return expected', async (caseObj: TEST_SCENARIO) => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id', [caseObj.folder])));
        expect(ruleDescriptions).toEqual(caseObj.expectationRuleDescriptions);
    });

    it.each(testScenarios)('When describing rules while config_root is folder $description and auto_discover_eslint_config=true, then return expected', async (caseObj: TEST_SCENARIO) => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true,
            config_root: caseObj.folder
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(caseObj.expectationRuleDescriptions);
    });

    it('When describing rules from a workspace targeting no javascript files, then no javascript rules should return', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id',
            [testDataFolder],
            [
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt'),
                path.join(workspaceWithNoCustomConfig, 'dummy2.ts')
            ])));
        // No JS files means no JS rules and no React rules (React applies to JS files for now, we will add TS support in next iteration)
        expect(ruleDescriptions).toEqual(TS_CONFIG_RULES);
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id', [
                path.join(workspaceWithNoCustomConfig, 'dummy1.js'),
                path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])));
        // React rules included - applies to .js files
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy3.txt')])));
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When describing rules from an empty workspace, then no rules should return', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(new Workspace('id', [])));
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When disable_javascript_base_config=true, then the base rules are removed for javascript only', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_javascript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...TS_CONFIG_RULES, ...SLDS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_lwc_base_config=true, then the lwc rules are removed but javascript rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...JS_CONFIG_RULES, ...TS_CONFIG_RULES, ...SLDS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_slds_base_config=true, then the slds rules are removed but other rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_slds_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...TS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_typescript_base_config=true, then the typescript rules are removed', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_typescript_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...SLDS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_lwc_base_config=true, disable_typescript_base_config=true, and disable_slds_base_config=true, then only base javascript and react rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
            disable_slds_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...JS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_javascript_base_config=true, disable_lwc_base_config=true, and disable_slds_base_config=true, then typescript and react rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_javascript_base_config: true,
            disable_lwc_base_config: true,
            disable_slds_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - React is independently controlled, not dependent on JS/LWC config
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...TS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_javascript_base_config=true, disable_typescript_base_config=true, and and disable_slds_base_config=true, then only base lwc and react rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_slds_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When disable_react_base_config=true, then the react rules are removed but other rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_react_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...TS_CONFIG_RULES, ...SLDS_CONFIG_RULES]));
    });

    it('When describing rules from a workspace with .jsx files, then React rules are included', async() => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [workspaceWithReactFiles])));
        // Should include LWC, JS, and React rules (for .js and .jsx files)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When all base configs except react are disabled, then only react rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_javascript_base_config: true,
            disable_lwc_base_config: true,
            disable_typescript_base_config: true,
            disable_slds_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - React is independently controlled
        expect(ruleDescriptions).toEqual(REACT_CONFIG_RULES);
    });

    it('When disable_javascript_base_config=true, disable_typescript_base_config=true, and and disable_lwc_base_config=true, then only slds and react rules remain', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - React is independently controlled
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...SLDS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When all *_base_config equal true and no custom config exists, then no rules should exist', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
            disable_slds_base_config: true,
            disable_react_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When file_extensions.javascript is empty, then javascript rules do not get picked up', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            file_extensions: {
                ... DEFAULT_CONFIG_FOR_TESTING.file_extensions,
                javascript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules NOT included - React only applies to .jsx which is a JS extension
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...TS_CONFIG_RULES, ...SLDS_CONFIG_RULES]));
    });

    it('When file_extensions.typescript is empty, then typescript rules do not get picked up', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            file_extensions: {
                ... DEFAULT_CONFIG_FOR_TESTING.file_extensions,
                typescript: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...SLDS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When file_extensions.html is empty, then html rules do not get picked up', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            file_extensions: {
                ... DEFAULT_CONFIG_FOR_TESTING.file_extensions,
                html: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...TS_CONFIG_RULES, ...CSS_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When file_extensions.css is empty, then css rules do not get picked up', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            file_extensions: {
                ... DEFAULT_CONFIG_FOR_TESTING.file_extensions,
                css: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        // React rules included - no workspace provided means placeholder files used (includes .jsx)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...LWC_CONFIG_RULES, ...JS_CONFIG_RULES, ...TS_CONFIG_RULES, ...HTML_CONFIG_RULES, ...REACT_CONFIG_RULES]));
    });

    it('When file_extensions are all empty, then no rules are returned', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            file_extensions: {
                ...DEFAULT_CONFIG_FOR_TESTING.file_extensions,
                javascript: [],
                typescript: [],
                html: [],
                css: [],
                other: []
            }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When eslint_config_file is provided as a invalid flat config file, then error appropriately', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            eslint_config_file: path.join(testDataFolder, 'workspaceWithInvalidFlatConfig', 'eslint.invalid.config.js')
        });
        await expect(engine.describeRules(createDescribeOptions())).rejects.toThrow(
            `The eslint engine encountered an unexpected error thrown from 'ESLint.calculateConfigForFile':\n` +
            `  | TypeError: Config (unnamed): Unexpected non-object config at user-defined index 0.`);
    });


    it('When eslint_config_file is provided as a valid flat config file, then it is applied', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            eslint_config_file: path.join(testDataFolder, 'workspaceWithFlatConfigMjs', 'eslint.config.mjs')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [path.join(testDataFolder, 'workspaceWithFlatConfigMjs')])
        ));
        expect(ruleDescriptions).toEqual(EXPECTED_RULES_FOR_BASE_PLUS_CONFIG_THAT_MODIFIES_EXISTING_RULES);
    });

    it('When auto_discover_eslint_config=false and eslint_config_file is not provided, then no user config should be applied', async () => {
        // While sitting in workspaceThatHasCustomConfigModifyingExistingRules, we turn off customization
        const origWorkingDir: string = process.cwd();
        process.chdir(workspaceThatHasCustomConfigModifyingExistingRules); // We will cd into it ...
        try {
            const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
                config_root: workspaceThatHasCustomConfigModifyingExistingRules // ... make it config root ...
            });
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
                new Workspace('id', [workspaceThatHasCustomConfigModifyingExistingRules]))); // ... and include it in the workspace

            expect(ruleDescriptions).toEqual(DEFAULT_RULES);

            // Sanity check that we emit an info log event letting the user know that their custom eslint config isn't being used
            const relPathFromConfigRoot: string = path.join(workspaceThatHasCustomConfigModifyingExistingRules.slice((process.cwd() + path.sep).length), 'eslint.config.cjs');
            const relPathFromCwd: string = path.join(workspaceThatHasCustomConfigModifyingExistingRules.slice((process.cwd() + path.sep).length), 'eslint.config.cjs');
            expect(logEvents).toContainEqual({
                type: EventType.LogEvent,
                logLevel: LogLevel.Info,
                message: getMessage('UnusedESLintConfigFile', relPathFromCwd, relPathFromConfigRoot)
            });
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When auto_discover_eslint_config=false and eslint_config_file is provided, the supplied config file is used but others are not', async () => {
        // While sitting in workspaceThatHasCustomConfigWithNewRules, we use the eslint config file from workspaceThatHasCustomConfigModifyingExistingRules
        const origWorkingDir: string = process.cwd();
        process.chdir(workspaceThatHasCustomConfigWithNewRules); // We will cd into it ...
        try {
            const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
                config_root: workspaceThatHasCustomConfigWithNewRules, // ... make it config root ...
                auto_discover_eslint_config: false, // This should trump environment info but not the eslint_config_file
                eslint_config_file: path.join(workspaceThatHasCustomConfigModifyingExistingRules, 'eslint.config.cjs')
            });
            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
                new Workspace('id', [workspaceThatHasCustomConfigWithNewRules]))); // ... and include it in the workspace

            expect(ruleDescriptions).toEqual(EXPECTED_RULES_FOR_BASE_PLUS_CONFIG_THAT_MODIFIES_EXISTING_RULES);
        } finally {
            process.chdir(origWorkingDir);
        }
    });

    it('When all base configs are off and custom config with new rules exists, when auto_discover_eslint_config=true then only custom config is applied', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            config_root: workspaceThatHasCustomConfigWithNewRules,
            auto_discover_eslint_config: true, // Sanity test that we can auto discover in config root
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
            disable_slds_base_config: true,
            disable_react_base_config: true
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
        expect(ruleDescriptions).toEqual(CUSTOM_RULES);
    });

    it('When all base configs are off and custom config that modifies eslint rules exists and auto_discover_eslint_config=true, then only custom config is applied', async() => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_lwc_base_config: true,
            disable_slds_base_config: true,
            disable_react_base_config: true
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [path.join(testDataFolder, 'workspaceWithFlatConfigJs', 'dummy1.js')])));
        expect(ruleDescriptions).toEqual(EXPECTED_RULES_FOR_ONLY_CONFIG_THAT_MODIFIES_EXISTING_RULES);
    });

    it('When workspace contains a config that globally ignores js files, then those files are ignored during rule calculation', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            eslint_config_file: path.join(testDataFolder, 'workspaceWithFlatConfigJs', 'a-config-file-that-uses-ignores.js')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [path.join(testDataFolder, 'workspaceWithFlatConfigJs')])));
        // No JS files after ignores means no JS rules and no React rules (React applies to JS files)
        expect(ruleDescriptions).toEqual(makeUniqueAndSorted([...TS_CONFIG_RULES, ...SLDS_CONFIG_RULES]));
    });

    it('When a .eslintignore file is auto discovered and a flat eslint config file is specified, then we warn that we ignore it', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true,
            eslint_config_file: path.join(workspaceThatHasCustomConfigModifyingExistingRules, 'eslint.config.cjs')
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [path.join(testDataFolder, 'workspaceWithLegacyIgnoreFile')])));
        expect(ruleDescriptions).toEqual(EXPECTED_RULES_FOR_BASE_PLUS_CONFIG_THAT_MODIFIES_EXISTING_RULES);

        const warnLogs: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Warn);
        expect(warnLogs).toHaveLength(1);
        expect(warnLogs[0].message).toEqual(getMessage('IgnoringLegacyIgnoreFile',
            path.join(testDataFolder, 'workspaceWithLegacyIgnoreFile', '.eslintignore')));
    });

   it('When custom rules only apply to other file extensions, then without specifying file extensions in custom config, they are not picked up', async () => {
       const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            disable_lwc_base_config: true,
            disable_javascript_base_config: true,
            disable_typescript_base_config: true,
            disable_slds_base_config: true,
            disable_react_base_config: true,
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, 'eslint-config-only-for-other-files.js')
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [workspaceThatHasCustomConfigWithNewRules])));

        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When custom rules only apply to other file extensions, then when specifying file extensions in custom config, they are picked up', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
         disable_lwc_base_config: true,
         disable_javascript_base_config: true,
         disable_typescript_base_config: true,
         disable_slds_base_config: true,
         disable_react_base_config: true,
         eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, 'eslint-config-only-for-other-files.js'),
         file_extensions:{
             ... DEFAULT_CONFIG.file_extensions,
             other: ['.other']
         }
        });
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(
            new Workspace('id', [workspaceThatHasCustomConfigWithNewRules])));

        expect(ruleDescriptions).toEqual(CUSTOM_RULES);
    });

    it('When calling describeRules with auto discovery on and a legacy config file available, then we warn and defer to v8', async () => {
        const engine: Engine = await createEngineFromPlugin({
            ... DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true,
            config_root: path.join(testDataFolder, 'workspaceWithLegacyConfigJson')
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());

        const warnLogs: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Warn);
        expect(warnLogs).toHaveLength(1);
        expect(warnLogs[0].message).toEqual(getMessage('DetectedLegacyConfig',
            path.join(testDataFolder, 'workspaceWithLegacyConfigJson', '.eslintrc.json')));

        expect(ruleDescriptions).toHaveLength(390); // Sanity check size of rule descriptions to confirm using v8. The eslint8-engine tests cover the details.
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
    const expectedHTMLViolation_enforceBemUsage: Violation = {
        "codeLocations": [
            {
                "endColumn": 27,
                "endLine": 1,
                "file": path.join(workspaceWithNoCustomConfig, 'dummy1.html'),
                "startColumn": 11,
                "startLine": 1
            }
        ],
        "message": "slds-m-top--none has been retired. Update it to the new name slds-m-top_none.",
        "primaryLocationIndex": 0,
        "ruleName": "@salesforce-ux/slds/enforce-bem-usage"
    };

    it('When running with defaults and no customizations, then violations for javascript, typescript and html are found correctly', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types', '@salesforce-ux/slds/enforce-bem-usage'], runOptions);

        expect(results.violations).toHaveLength(4);
        expect(results.violations).toContainEqual(expectedJsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noWrapperObjectTypes);
        expect(results.violations).toContainEqual(expectedHTMLViolation_enforceBemUsage);
    });

    it('When workspace only targets javascript files, then only javascript violations are returned', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig],
            [path.join(workspaceWithNoCustomConfig, 'dummy1.js')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedJsViolation_noInvalidRegexp]);
    });

    it('When workspace only contains typescript files, then only typescript violations are returned', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy2.ts')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toEqual([expectedTsViolation_noInvalidRegexp]);
    });

    it('When workspace only contains html files, then only html violations are returned', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy1.html')]));
        const results: EngineRunResults = await engine.runRules(['@salesforce-ux/slds/enforce-bem-usage'], runOptions);

        expect(results.violations).toEqual([expectedHTMLViolation_enforceBemUsage]);
    });

    it('When workspace does not contains javascript, typescript or html files, then zero violations are returned', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceWithNoCustomConfig, 'dummy3.txt')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp'], runOptions);

        expect(results.violations).toHaveLength(0);
    });

    it('When runRules is called on a workspace that has a babel configuration file, then the file is ignored and no error events are thrown', async () => {
        const folderContainingBabelConfigFile: string = path.join(testDataFolder,'workspaceWithBabelConfigFile');
        const logEvents: LogEvent[] = [];
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
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

    it('When using custom plugin rules, then violations from custom rules are returned', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true
        });
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js')]));
        const results: EngineRunResults = await engine.runRules(['dummy/my-rule-1', 'dummy/my-rule-2'], runOptions);

        expect(results.violations).toHaveLength(2);
        expect(results.violations).toContainEqual({
            "codeLocations": [{
                "endColumn": 14,
                "endLine": 1,
                "file": path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js'),
                "startColumn": 5,
                "startLine": 1
            }],
            "message": "Avoid using variables named 'forbidden'",
            "primaryLocationIndex": 0,
            "ruleName": "dummy/my-rule-1"
        });
        expect(results.violations).toContainEqual({
            "codeLocations": [{
                "endColumn": 9,
                "endLine": 3,
                "file":  path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy1.js'),
                "startColumn": 5,
                "startLine": 3
            }],
            "message": "Avoid using variables named 'oops'",
            "primaryLocationIndex": 0,
            "ruleName": "dummy/my-rule-1"
        });
    });


    it('When custom rules only apply to file extensions that are not javascript, typescript, or html based, then when specifying file extensions, the rules run', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            eslint_config_file: path.join(workspaceThatHasCustomConfigWithNewRules, 'eslint-config-only-for-other-files.js'),
            file_extensions:{
                ... DEFAULT_CONFIG.file_extensions,
                other: ['.other']
            }
        });

        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(workspaceThatHasCustomConfigWithNewRules)]));
        const results: EngineRunResults = await engine.runRules(['dummy/my-rule-1'], runOptions);

        expect(results.violations).toHaveLength(1);
        expect(results.violations[0]).toEqual({
            ruleName: "dummy/my-rule-1",
            primaryLocationIndex: 0,
            message: "Avoid using variables named 'forbidden'",
            codeLocations: [{
                file: path.join(workspaceThatHasCustomConfigWithNewRules, 'dummy3.other'),
                startLine: 2,
                startColumn: 5,
                endLine: 2,
                endColumn: 14
            }]
        });
    });

    it('When runRules is called on workspace with a config that ignores files, then those files are ignored', async () => {
        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            eslint_config_file: path.join(testDataFolder,'workspaceWithFlatConfigJs', 'a-config-file-that-uses-ignores.js')
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const runOptions: RunOptions = createRunOptions(new Workspace('id', [path.join(testDataFolder,'workspaceWithFlatConfigJs')]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types', '@salesforce-ux/slds/enforce-bem-usage'], runOptions);

        expect(results.violations).toHaveLength(2); // Should not contain js violations but should contain ts violations
        expect(path.extname(results.violations[0].codeLocations[0].file)).toEqual('.ts');
        expect(path.extname(results.violations[1].codeLocations[0].file)).toEqual('.ts');
    });

    it('When calling runRules and only a legacy ignore file is provided, then we defer to v8', async () => {
        const engine: Engine = await createEngineFromPlugin({
            ... DEFAULT_CONFIG_FOR_TESTING,
            eslint_ignore_file: path.join(testDataFolder, 'workspaceWithLegacyIgnoreFile', '.eslintignore')
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig]));
        const results: EngineRunResults = await engine.runRules(['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types'], runOptions);

        expect(results.violations).toHaveLength(2); // Only TS Violations show up because ignore file ignores js files
        expect(results.violations).toContainEqual(expectedTsViolation_noInvalidRegexp);
        expect(results.violations).toContainEqual(expectedTsViolation_noWrapperObjectTypes);
    });

    it('When workspace contains custom config that installs same plugin as one of our base plugins, we resolve plugins, describe and run rules properly', async () => {
        if (os.platform().startsWith('win')) {
            // Sadly this test takes like 30 to 60 seconds on windows because it requires unzipping a workspace.
            // I wish there was an alternative way to write this test, but we need a workspace that as various
            // plugins (typescript and lwc plugins) installed that are different version than our current version.
            // Unzipping the workspace is the best thing I could come up with. For now, we skip this test only on windows.
            return;
        }
        const workspaceZip: string = path.join(testDataFolder, 'workspaceWithConflictingConfig.zip');
        const tempFolder: string = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test'));
        await unzipToFolder(workspaceZip, tempFolder);
        const workspaceFolder: string = path.join(tempFolder, 'workspaceWithConflictingConfig');

        const engine: Engine = await createEngineFromPlugin({...DEFAULT_CONFIG_FOR_TESTING,
            auto_discover_eslint_config: true,
            config_root: workspaceFolder
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const workspace: Workspace = new Workspace('id', [workspaceFolder]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));

        // Sanity check a few rules
        const ruleNames: string[] = ruleDescriptions.map(r => r.name);
        expect(ruleNames).toContain('no-invalid-regexp');
        expect(ruleNames).toContain('@typescript-eslint/no-wrapper-object-types');
        expect(ruleNames).toContain('@lwc/lwc-platform/no-aura');

        const results: EngineRunResults = await engine.runRules(
            ['no-invalid-regexp', '@typescript-eslint/no-wrapper-object-types'],
            createRunOptions(workspace));

        // Verify the violations look good
        expect(results.violations).toHaveLength(3);
        const violatedRules: string[] =  results.violations.map(v => v.ruleName);
        expect(violatedRules).toContain('no-invalid-regexp'); // 2 of these
        expect(violatedRules).toContain('@typescript-eslint/no-wrapper-object-types'); // 1 of these
        const fileNamesWithViolations: string[] = results.violations.map(v => path.basename(v.codeLocations[0].file));
        expect(fileNamesWithViolations).toContain('dummy.js');
        expect(fileNamesWithViolations).toContain('dummy.ts');

        // Confirm we push relevant message to debug log
        const relevantDebugEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Debug && e.message.includes("has been replaced with"));
        expect(relevantDebugEvents.length).toBeGreaterThan(0);
    });

    it('When scanning a file that has a directive for a unknown rule, we should not error but issue debug log for it', async () => {
        const engine: Engine = await createEngineFromPlugin({
            ...DEFAULT_CONFIG_FOR_TESTING
        });
        const logEvents: LogEvent[] = [];
        engine.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        const runOptions: RunOptions = createRunOptions(new Workspace('id', [
            path.join(testDataFolder, 'workspaceWithDirectiveAboutUnknownRule')]));

        const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

        expect(results.violations).toHaveLength(1);
        expect(results.violations[0].ruleName).toEqual('no-unused-vars');

        const filteredViolation: Violation = {
            ruleName: "oops-rule",
            message: "Definition for rule 'oops-rule' was not found.",
            codeLocations: [{
                file: path.join(testDataFolder, 'workspaceWithDirectiveAboutUnknownRule', 'containsDirectiveForUnknownRule.js'),
                startLine: 4,
                startColumn: 1,
                endLine: 4,
                endColumn: 31
            }],
            primaryLocationIndex: 0
        };

        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('ViolationFoundFromUnregisteredRule', 'oops-rule', JSON.stringify(filteredViolation, null, 2))
        });
    });

    it('When runRules is called on workspace with React .jsx files, then React rules report violations', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithReactFiles]));
        const results: EngineRunResults = await engine.runRules(['react/prop-types'], runOptions);

        // The Button.jsx and App.jsx files should have prop-types violations
        expect(results.violations.length).toBeGreaterThan(0);
        expect(results.violations.every(v => v.ruleName === 'react/prop-types')).toBe(true);
        // Violations should be in .jsx files
        const jsxViolations = results.violations.filter(v => 
            v.codeLocations[0].file.endsWith('.jsx'));
        expect(jsxViolations.length).toBeGreaterThan(0);
    });
});

describe('Tests for the getEngineVersion method of ESLint Engine', () => {
    it('getEngineVersion() outputs something resembling a Semantic Version', async () => {
        const engine: Engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
        const version: string = await engine.getEngineVersion();

        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });
});

describe('Tests for emitting events', () => {
    let engine: Engine;
    let logEvents: LogEvent[];
    let runRulesProgressEvents: RunRulesProgressEvent[];
    let describeRulesProgressEvents: DescribeRulesProgressEvent[];
    beforeEach(async () => {
        engine = await createEngineFromPlugin(DEFAULT_CONFIG_FOR_TESTING);
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
        // TODO: We should make our DescribeRulesProgressEvents more refined while calculating the eslint context information
        // Note: These percentages depend on the number of file extensions configured (includes .jsx)
        expect(describeRulesProgressEvents.map(e => e.percentComplete)).toEqual(
            [0, 10, 14, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 82, 86, 90, 95, 100]);
    });

    it('When runRules is called, then it emits correct progress events', async () => {
        const runOptions: RunOptions = createRunOptions(new Workspace('id', [workspaceWithNoCustomConfig]));
        await engine.runRules(['no-unused-vars'], runOptions);
        expect(runRulesProgressEvents.map(e => e.percentComplete)).toEqual(
            [0, 1.5, 3, 8.63, 14.25, 19.88, 25.5, 27, 28.5, 30, 46.25, 62.5, 78.75, 95, 100]);
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

async function createEngineFromPlugin(configObject: ConfigObject): Promise<Engine> {
    const plugin: ESLintEnginePlugin = new ESLintEnginePlugin();
    const engine: ESLintEngine = await plugin.createEngine('eslint', configObject);
    engine._runESLintWorkerTask._runInCurrentThreadInsteadofNewThread = true;
    return engine;
}
