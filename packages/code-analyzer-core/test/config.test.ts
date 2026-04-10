import {CodeAnalyzerConfig, Ignores, SeverityLevel} from "../src";
import * as os from "node:os";
import * as path from "node:path";
import {getMessageFromCatalog, LogLevel, SHARED_MESSAGE_CATALOG} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {ConfigDescription, DEFAULT_CONFIG} from "../src/config";

changeWorkingDirectoryToPackageRoot();

const DEFAULT_CONFIG_ROOT: string = process.cwd();
const TEST_DATA_DIR: string = path.resolve(__dirname, 'test-data');

describe("Tests for creating and accessing configuration values", () => {
    it("When constructing config withDefaults then default values are returned", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();

        expect(conf.getConfigRoot()).toEqual(DEFAULT_CONFIG_ROOT);
        expect(conf.getLogFolder()).toEqual(os.tmpdir());
        expect(conf.getLogLevel()).toEqual(LogLevel.Debug);
        expect(conf.getCustomEnginePluginModules()).toEqual([]);
        expect(conf.getPreserveAllWorkingFolders()).toEqual(false);
        expect(conf.getRootWorkingFolder()).toEqual(os.tmpdir());
        expect(conf.getRuleOverridesFor("stubEngine1")).toEqual({});
        expect(conf.getEngineOverridesFor("stubEngine1")).toEqual({});
        expect(conf.getRuleOverridesFor("stubEngine2")).toEqual({});
        expect(conf.getEngineOverridesFor("stubEngine2")).toEqual({});
        expect(conf.getIgnores()).toEqual({ files: [] });
    });

    it("When configuration file does not exist, then throw an error", () => {
        const nonExistingFile: string = path.resolve(__dirname, "doesNotExist");
        expect(() => CodeAnalyzerConfig.fromFile(nonExistingFile)).toThrow(
            getMessage('ConfigFileDoesNotExist', nonExistingFile));
    });

    it("When configuration file has unsupported extension, then throw an error", () => {
        const fileWithBadExtension: string = path.resolve(__dirname, "config.test.ts");
        expect(() => CodeAnalyzerConfig.fromFile(fileWithBadExtension)).toThrow(
            getMessage('ConfigFileExtensionUnsupported', fileWithBadExtension, 'json,yaml,yml'));
        const fileWithNoExtension: string = path.resolve(__dirname, "..", "LICENSE");
        expect(() => CodeAnalyzerConfig.fromFile(fileWithNoExtension)).toThrow(
            getMessage('ConfigFileExtensionUnsupported', fileWithNoExtension, 'json,yaml,yml'));
    });

    it("When constructing config from yaml file then values from file are parsed correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-01.yaml'));
        expect(conf.getConfigRoot()).toEqual(TEST_DATA_DIR);
        expect(conf.getLogFolder()).toEqual(path.join(TEST_DATA_DIR, 'sampleLogFolder'));
        expect(conf.getRuleOverridesFor('stubEngine1')).toEqual({
            stub1RuleB: {
                severity: SeverityLevel.Critical
            },
            stub1RuleD: {
                severity: SeverityLevel.Info,
                tags: ['Recommended', 'CodeStyle']
            }
        });
        expect(conf.getRuleOverridesFor('stubEngine2')).toEqual({
            stub2RuleA: {
                tags: ['Security', "SomeNewTag"]
            }
        });
        expect(conf.getRuleOverrideFor('STUBENGINE1','STUB1RULED')).toEqual(conf.getRuleOverrideFor('stubEngine1','stub1RuleD')); // Sanity test for case insensitivity
        expect(conf.getEngineOverridesFor('stubEngine1')).toEqual({});
        expect(conf.getEngineOverridesFor('stubEngine2')).toEqual({});
    });

    it("When case insensitive severity levels are provided, they get correctly mapped to SeverityLevel", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({rules: {eslint: {
            r1: {severity: "critical"},
            r2: {severity: "mOdEraTE"},
            r3: {severity: "LOW"}
        }}});
        expect(conf.getRuleOverridesFor('eslint')).toEqual({
            r1: {severity: SeverityLevel.Critical},
            r2: {severity: SeverityLevel.Moderate},
            r3: {severity: SeverityLevel.Low}
        });
    });

    it("When constructing config from file with yml extension then it is parsed as a yaml file", () => {
        // Also note that Yml should work just like yml. Case doesn't matter.
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-02.Yml'));
        expect(conf.getLogFolder()).toEqual(os.tmpdir());
        expect(conf.getCustomEnginePluginModules()).toEqual(['dummy_plugin_module_path']);
        expect(conf.getPreserveAllWorkingFolders()).toEqual(true);
        expect(conf.getRootWorkingFolder()).toEqual(os.tmpdir());
        expect(conf.getRuleOverridesFor('stubEngine1')).toEqual({});
        expect(conf.getRuleOverridesFor('stubEngine2')).toEqual({
            stub2RuleC: {
                severity: SeverityLevel.Moderate
            }
        });
        expect(conf.getRuleOverridesFor('STUbengine2')).toEqual(conf.getRuleOverridesFor('stubEngine2'));  // Also test case insensitivity
        expect(conf.getEngineOverridesFor('stubEngine1')).toEqual({
            miscSetting1: true,
            miscSetting2: {
                miscSetting2A: 3,
                miscSetting2B: ["hello", "world"]
            }
        });
        expect(conf.getEngineOverridesFor('stubENGINE1')).toEqual(conf.getEngineOverridesFor('stubEngine1')); // Also test case insensitivity
        expect(conf.getEngineOverridesFor('stubEngine2')).toEqual({});
    });

    it("When constructing config from json file then values from file are parsed correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-03.json'));
        expect(conf.getLogFolder()).toEqual(path.join(TEST_DATA_DIR, 'sampleLogFolder'));
        expect(conf.getCustomEnginePluginModules()).toEqual([]);
        expect(conf.getPreserveAllWorkingFolders()).toEqual(false);
        expect(conf.getRuleOverridesFor('stubEngine1')).toEqual({});
        expect(conf.getRuleOverridesFor('stubEngine2')).toEqual({});
        expect(conf.getEngineOverridesFor('stubEngine1')).toEqual({});
        expect(conf.getEngineOverridesFor('stubEngine2')).toEqual({miscSetting: "miscValue"});
    });

    it.each([
        {fileType: 'yaml'},
        {fileType: 'json'}
    ])("When constructing config from empty $fileType file, the default config is used", ({fileType}) => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, `sample-config-05.${fileType}`));

        // The config root should default to the config file's parent directory.
        const expectedConf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
            ...DEFAULT_CONFIG,
            config_root: TEST_DATA_DIR
        });
        expect(conf).toEqual(expectedConf);
    });

    it.each([
        {fileType: "yaml"},
        {fileType: "json"}
    ])("When constructing config from comment-only $fileType file, the default config is used", ({fileType}) => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, `sample-config-06.${fileType}`));

        // The config root should default to the config file's parent directory.
        const expectedConf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
            ...DEFAULT_CONFIG,
            config_root: TEST_DATA_DIR
        });
        expect(conf).toEqual(expectedConf);
    });

    it("When constructing config from invalid yaml string then we throw an error", () => {
        try {
            CodeAnalyzerConfig.fromYamlString('oops: this: should error');
            fail('Expected an exception to be thrown.')
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(getMessage('ConfigContentFailedToParse',''));
            expect(errMsg).toContain('bad indentation of a mapping entry');
        }
    });

    it("When constructing config from invalid json string then we throw an error", () => {
        try {
            CodeAnalyzerConfig.fromJsonString('this.Is{NotValidJson');
            fail('Expected an exception to be thrown.')
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(getMessage('ConfigContentFailedToParse',''));
            expect(errMsg).toContain('Unexpected token');
        }
    });

    it("When constructing config from yaml string that isn't an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromYamlString("3")).toThrow(
            getMessage('ConfigContentNotAnObject','number'));
    });

    it("When constructing config from json string that isn't an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromJsonString("[3,4]")).toThrow(
            getMessage('ConfigContentNotAnObject','array'));
    });

    it("When top level config has an unknown key, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({doesNotExist: 3})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigObjectContainsInvalidKey','<TopLevel>', 'doesNotExist',
                '["config_root","engines","ignores","log_folder","log_level","rules","suppressions"]'));
    });

    it("When engines value is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({engines: ['oops']})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','engines', 'object', 'array'));
    });

    it("When engines.someEngine is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({engines: {someEngine: 3.2}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','engines.someEngine', 'object', 'number'));
    });

    it("When rules is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: 3})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules', 'object', 'number'));
    });

    it("When rules.someEngine is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: null}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine', 'object', 'null'));
    });

    it("When rules.someEngine.someRule is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {someRule: [1,2]}}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine.someRule', 'object', 'array'));
    });

    it("When rules.someEngine.someRule contains an unknown key then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {someRule: {oops: 3, tags: []}}}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigObjectContainsInvalidKey','rules.someEngine.someRule', 'oops',
                '["disabled","severity","tags"]'));
    });

    it("When the severity of a rule not a valid value then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {
            goodSevRule1: {severity: 3},
            goodSevRule2: {severity: "High"},
            badSevRule: {severity: 0}
        }}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel',
                'rules.someEngine.badSevRule.severity',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', '0'));

        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {badSevRule: {severity: "oops"}}}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel',
                'rules.someEngine.badSevRule.severity',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', '"oops"'));
    });

    it("When the tags of a rule is not a string array then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {
                    goodTagsRule1: {tags: ['Recommended']},
                    badTagsRule: {tags: 'oops'},
                    goodTagsRule2: {tags: ['helloWorld', 'great']}
                }}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine.badTagsRule.tags', 'array', 'string'));
    });

    it("When tags is an empty array, then use the empty array as provided", () => {
        const someRuleOverrides: object = {
            someRule1: {tags: []}, // Should be accepted
            someRule2: {severity: 4, tags: ['Performance']}
        };
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({rules: {someEngine: someRuleOverrides}});
        expect(conf.getRuleOverridesFor('someEngine')).toEqual(someRuleOverrides);
    });

    it("When disabled is set to true for a rule, then we correctly store the disabled property", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({rules: {someEngine: {
            someRule1: {disabled: true},
            someRule2: {disabled: false},
            someRule3: {severity: 3} // No disabled property
        }}});
        expect(conf.getRuleOverrideFor('someEngine', 'someRule1')).toEqual({disabled: true});
        expect(conf.getRuleOverrideFor('someEngine', 'someRule2')).toEqual({disabled: false});
        expect(conf.getRuleOverrideFor('someEngine', 'someRule3')).toEqual({severity: SeverityLevel.Moderate});
    });

    it("When disabled is combined with other rule properties, then all properties are correctly stored", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({rules: {someEngine: {
            someRule: {
                disabled: true,
                severity: 2,
                tags: ['Security', 'Custom']
            }
        }}});
        expect(conf.getRuleOverrideFor('someEngine', 'someRule')).toEqual({
            disabled: true,
            severity: SeverityLevel.High,
            tags: ['Security', 'Custom']
        });
    });

    it("When disabled is not a boolean value, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {
            someRule: {disabled: 'yes'}
        }}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine.someRule.disabled', 'boolean', 'string'));

        expect(() => CodeAnalyzerConfig.fromObject({rules: {someEngine: {
            someRule: {disabled: 1}
        }}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType','rules.someEngine.someRule.disabled', 'boolean', 'number'));
    });

    it("When loading config from yaml file with disabled rules, then disabled property is parsed correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-with-disabled-rule.yaml'));
        expect(conf.getRuleOverrideFor('stubEngine1', 'stub1RuleC')).toEqual({disabled: true});
        expect(conf.getRuleOverrideFor('stubEngine2', 'stub2RuleA')).toEqual({
            disabled: true,
            tags: ['Security', 'SomeNewTag']
        });
    });

    it("When config has rule overrides, getEngineNamesWithRuleOverrides returns engine names that have at least one rule override", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-with-disabled-rule.yaml'));
        expect(conf.getEngineNamesWithRuleOverrides()).toEqual(['stubEngine1', 'stubEngine2']);
    });

    it("When config has no rule overrides, getEngineNamesWithRuleOverrides returns empty array", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
        expect(conf.getEngineNamesWithRuleOverrides()).toEqual([]);
    });

    it("When log_folder does not exist, then throw an error", () => {
        const nonExistingFolder: string = path.resolve(__dirname, "doesNotExist");
        expect(() => CodeAnalyzerConfig.fromObject({log_folder: nonExistingFolder})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist', 'log_folder', nonExistingFolder)
        );
    });

    it("When log_folder is a file and not a folder, then throw an error", () => {
        const notAFolder: string = path.resolve(__dirname, "config.test.ts");
        expect(() => CodeAnalyzerConfig.fromObject({log_folder: notAFolder})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigFolderValueMustNotBeFile', 'log_folder', notAFolder)
        );
    });

    it("When log_level is a valid number, then return set it on the config correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromYamlString("log_level: 3");
        expect(conf.getLogLevel()).toEqual(LogLevel.Info);
    });

    it("When log_level is a valid string, even with odd casing, then it is set on the config corrrectly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromYamlString("log_lEVel: wARn");
        expect(conf.getLogLevel()).toEqual(LogLevel.Warn);
    });

    it("When log_level is null, then default (Debug) is used", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromYamlString("log_level: null");
        expect(conf.getLogLevel()).toEqual(LogLevel.Debug);
    });

    it("When log_level is not a number or a string, then error", () => {
        expect(() => CodeAnalyzerConfig.fromYamlString("log_level: [1,2]")).toThrow(
            getMessage('ConfigValueNotAValidEnumValue', 'log_level', '["Error","Warn","Info","Debug","Fine",1,2,3,4,5]', '[1,2]'));
    });

    it("When log_level is not a valid string, then error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({log_level: "warning"})).toThrow(
            getMessage('ConfigValueNotAValidEnumValue', 'log_level', '["Error","Warn","Info","Debug","Fine",1,2,3,4,5]', '"warning"'));
    });

    it("When log_level is not a valid number, then error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({log_level: 0})).toThrow(
            getMessage('ConfigValueNotAValidEnumValue', 'log_level', '["Error","Warn","Info","Debug","Fine",1,2,3,4,5]', '0'));
    });

    it("When custom_engine_plugin_modules is not a string array, then throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({custom_engine_plugin_modules: 3})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType','custom_engine_plugin_modules', 'array', 'number'));

        expect(() => CodeAnalyzerConfig.fromObject({custom_engine_plugin_modules: 'oops'})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType','custom_engine_plugin_modules', 'array', 'string'));
    });

    it("When preserve_all_working_folders is not a boolean, then throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({preserve_all_working_folders: 3})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType','preserve_all_working_folders', 'boolean', 'number'));

        expect(() => CodeAnalyzerConfig.fromObject({preserve_all_working_folders: 'abcd'})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType','preserve_all_working_folders', 'boolean', 'string'));

        expect(() => CodeAnalyzerConfig.fromObject({preserve_all_working_folders: 'true'})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType','preserve_all_working_folders', 'boolean', 'string'));
    })

    it.each([
        {
            case: 'absolute',
            testPath: path.join(TEST_DATA_DIR, 'sampleWorkspace')
        },
        {
            case: 'relative',
            testPath: path.join('test', 'test-data', 'sampleWorkspace')
        }
    ])("When supplied root_working_folder is a valid $case path, then we use it", ({testPath}) => {
        const workingFoldersRootValue: string = path.join(TEST_DATA_DIR, 'sampleWorkspace');
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({root_working_folder: testPath});
        expect(conf.getRootWorkingFolder()).toEqual(workingFoldersRootValue);
    });

    it("When supplied root_working_folder does not exist, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({root_working_folder: path.resolve('doesNotExist')})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist', 'root_working_folder', path.resolve('doesNotExist')));
    });

    it("When supplied root_working_folder is a file instead of a folder, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({root_working_folder: path.resolve('package.json')})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigFolderValueMustNotBeFile', 'root_working_folder', path.resolve('package.json')));
    });

    it("When supplied config_root path is a valid absolute path, then we use it", () => {
        const configRootValue: string = path.join(TEST_DATA_DIR, 'sampleWorkspace');
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({config_root: configRootValue});
        expect(conf.getConfigRoot()).toEqual(configRootValue);
    });

    it("When supplied config_root path does not exist, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({config_root: path.resolve('doesNotExist')})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist','config_root', path.resolve('doesNotExist')));
    });

    it("When supplied config_root path is a file instead of a folder, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({config_root: path.resolve('package.json')})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigFolderValueMustNotBeFile','config_root', path.resolve('package.json')));
    });

    it("When supplied config_root path is a relative folder, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({config_root: 'test/test-data'})).toThrow(
            getMessage('ConfigPathValueMustBeAbsolute', 'config_root', 'test/test-data', path.resolve('test','test-data')));
    });

    it("When engines.stubEngine1.disable_engine is not a boolean, then we error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({engines: {stubEngine1: {disable_engine: 5}}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.stubEngine1.disable_engine', 'boolean', 'number'));
    });

    it("When getConfigDescription is called from default config, then it returns our expected description object", () => {
        const configDescription: ConfigDescription = CodeAnalyzerConfig.withDefaults().getConfigDescription();
        expect(configDescription.overview).toEqual(getMessage('ConfigOverview'));
        expect(configDescription.fieldDescriptions).toEqual({
            config_root: {
                descriptionText: getMessage('ConfigFieldDescription_config_root'),
                valueType: 'string',
                defaultValue: null,
                wasSuppliedByUser: false
            },
            log_folder: {
                descriptionText: getMessage('ConfigFieldDescription_log_folder'),
                valueType: 'string',
                defaultValue: null,
                wasSuppliedByUser: false
            },
            log_level: {
                descriptionText: getMessage('ConfigFieldDescription_log_level'),
                valueType: 'number',
                defaultValue: LogLevel.Debug,
                wasSuppliedByUser: false
            },
            rules: {
                descriptionText: getMessage('ConfigFieldDescription_rules'),
                valueType: 'object',
                defaultValue: {},
                wasSuppliedByUser: false
            },
            engines: {
                descriptionText: getMessage('ConfigFieldDescription_engines'),
                valueType: 'object',
                defaultValue: {},
                wasSuppliedByUser: false
            },
            ignores: {
                descriptionText: getMessage('ConfigFieldDescription_ignores'),
                valueType: 'object',
                defaultValue: { files: [] },
                wasSuppliedByUser: false
            },
            suppressions: {
                descriptionText: getMessage('ConfigFieldDescription_suppressions'),
                valueType: 'object',
                defaultValue: { disable_suppressions: false },
                wasSuppliedByUser: false
            }
        });
    });

    it("When getConfigDescription is called from modified config, then it correctly sets wasSuppliedByUser fields", () => {
        const configDescription: ConfigDescription = CodeAnalyzerConfig.fromObject(
            {config_root: __dirname, rules: {"someEngine": {"abc": {severity: SeverityLevel.High}}}}
        ).getConfigDescription();
        expect(configDescription.overview).toEqual(getMessage('ConfigOverview'));
        expect(configDescription.fieldDescriptions.config_root.wasSuppliedByUser).toEqual(true);
        expect(configDescription.fieldDescriptions.log_folder.wasSuppliedByUser).toEqual(false);
        expect(configDescription.fieldDescriptions.rules.wasSuppliedByUser).toEqual(true);
        expect(configDescription.fieldDescriptions.engines.wasSuppliedByUser).toEqual(false);
    });

    it ("When getConfigDescription is called from modified config that contains null, then null is treated as if the config field was not supplied", () => {
        const configDescription: ConfigDescription = CodeAnalyzerConfig.fromObject(
            {rules: null, engines: null}
        ).getConfigDescription();
        expect(configDescription.fieldDescriptions.rules.wasSuppliedByUser).toEqual(false);
        expect(configDescription.fieldDescriptions.engines.wasSuppliedByUser).toEqual(false);
    });
});

describe("Tests for ignores configuration", () => {
    it("When constructing config withDefaults then ignores has empty files array", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults();
        const ignores: Ignores = conf.getIgnores();
        expect(ignores).toEqual({ files: [] });
    });

    it("When constructing config with ignores.files array, then values are parsed correctly", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromYamlString(`
ignores:
  files:
    - "src/*.cls"
    - "**/*.test.js"
    - "**/node_modules/**"
`);
        const ignores: Ignores = conf.getIgnores();
        expect(ignores.files).toEqual([
            "src/*.cls",
            "**/*.test.js",
            "**/node_modules/**"
        ]);
    });

    it("When constructing config with empty ignores object, then files defaults to empty array", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromYamlString(`
ignores: {}
`);
        const ignores: Ignores = conf.getIgnores();
        expect(ignores).toEqual({ files: [] });
    });

    it("When constructing config with ignores.files as null, then files defaults to empty array", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromYamlString(`
ignores:
  files: null
`);
        const ignores: Ignores = conf.getIgnores();
        expect(ignores).toEqual({ files: [] });
    });

    it("When ignores is not an object then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: "invalid"})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'ignores', 'object', 'string'));
    });

    it("When ignores.files is not an array then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: "invalid"}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'ignores.files', 'array', 'string'));
    });

    it("When ignores.files contains non-string values then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["valid", 123]}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'ignores.files[1]', 'string', 'number'));
    });

    it("When ignores.files contains null value, then we throw an error", () => {
        // In YAML, a bare dash (- ) becomes null
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: [null, "valid.js"]}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'ignores.files[0]', 'string', 'null'));
    });

    it("When ignores contains unknown keys then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: [], unknownKey: "value"}})).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'ignores', 'unknownKey', '["files"]'));
    });

    it("When getConfigDescription is called, then ignores field is included", () => {
        const configDescription: ConfigDescription = CodeAnalyzerConfig.withDefaults().getConfigDescription();
        expect(configDescription.fieldDescriptions.ignores).toBeDefined();
        expect(configDescription.fieldDescriptions.ignores.valueType).toEqual('object');
        expect(configDescription.fieldDescriptions.ignores.defaultValue).toEqual({ files: [] });
        expect(configDescription.fieldDescriptions.ignores.wasSuppliedByUser).toEqual(false);
    });

    it("When getConfigDescription is called with ignores supplied, then wasSuppliedByUser is true", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
            ignores: { files: ["**/*.test.js"] }
        });
        const configDescription: ConfigDescription = conf.getConfigDescription();
        expect(configDescription.fieldDescriptions.ignores.wasSuppliedByUser).toEqual(true);
    });
});

describe("Tests for glob pattern validation in ignores", () => {
    it("When ignores.files contains an empty string, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: [""]}})).toThrow(
            getMessage('InvalidGlobPatternEmpty', 'ignores.files[0]'));
    });

    it("When ignores.files contains a pattern with unclosed bracket, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["**/[abc"]}})).toThrow(
            getMessage('InvalidGlobPattern', 'ignores.files[0]', '**/[abc', 'unclosed bracket ['));
    });

    it("When ignores.files contains a pattern with unmatched closing bracket, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["**/*.js]"]}})).toThrow(
            getMessage('InvalidGlobPattern', 'ignores.files[0]', '**/*.js]', 'unmatched closing bracket ]'));
    });

    it("When ignores.files contains a pattern with unclosed brace, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["**/*.{js,ts"]}})).toThrow(
            getMessage('InvalidGlobPattern', 'ignores.files[0]', '**/*.{js,ts', 'unclosed brace {'));
    });

    it("When ignores.files contains a pattern with unmatched closing brace, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["**/*.js}"]}})).toThrow(
            getMessage('InvalidGlobPattern', 'ignores.files[0]', '**/*.js}', 'unmatched closing brace }'));
    });

    it("When ignores.files contains a pattern with unclosed parenthesis, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["**/!(test"]}})).toThrow(
            getMessage('InvalidGlobPattern', 'ignores.files[0]', '**/!(test', 'unclosed parenthesis ('));
    });

    it("When ignores.files contains a pattern with unmatched closing parenthesis, then we throw an error", () => {
        expect(() => CodeAnalyzerConfig.fromObject({ignores: {files: ["**/*.js)"]}})).toThrow(
            getMessage('InvalidGlobPattern', 'ignores.files[0]', '**/*.js)', 'unmatched closing parenthesis )'));
    });

    it("When ignores.files contains escaped brackets, they are not counted as unbalanced", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
            ignores: { files: ["**/\\[special\\].js"] }
        });
        expect(conf.getIgnores().files).toEqual(["**/\\[special\\].js"]);
    });

    it("When ignores.files contains valid nested braces, they are accepted", () => {
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
            ignores: { files: ["**/*.{js,{ts,tsx}}"] }
        });
        expect(conf.getIgnores().files).toEqual(["**/*.{js,{ts,tsx}}"]);
    });

    it("When ignores.files contains valid glob patterns, no error is thrown", () => {
        const validPatterns = [
            "src/*.cls",
            "**/*.test.js",
            "**/node_modules/**",
            "packages/*/dist/**",
            "**/*.{js,ts}",
            "**/[abc]*.js",
            "!(test)/**"
        ];
        const conf: CodeAnalyzerConfig = CodeAnalyzerConfig.fromObject({
            ignores: { files: validPatterns }
        });
        expect(conf.getIgnores().files).toEqual(validPatterns);
    });

    it("When the invalid pattern is in the middle of the array, the error reports correct index", () => {
        expect(() => CodeAnalyzerConfig.fromObject({
            ignores: { files: ["valid/*.js", "also-valid/**", "**/invalid{pattern"] }
        })).toThrow(getMessage('InvalidGlobPattern', 'ignores.files[2]', '**/invalid{pattern', 'unclosed brace {'));
    });
});
