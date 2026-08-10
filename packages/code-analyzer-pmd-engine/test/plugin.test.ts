import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    ConfigObject,
    ConfigValueExtractor,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {PmdCpdEnginesPlugin} from "../src";
import {getMessage} from "../src/messages";
import {CpdEngine} from "../src/cpd-engine";
import {PmdEngine} from "../src/pmd-engine";
import {
    CPD_ENGINE_CONFIG_DESCRIPTION,
    DEFAULT_CPD_ENGINE_CONFIG,
    DEFAULT_PMD_ENGINE_CONFIG,
    PMD_ENGINE_CONFIG_DESCRIPTION,
    PmdEngineConfig
} from "../src/config";
import {JavaVersionIdentifier} from "../src/JavaVersionIdentifier";
import { SemVer } from "semver";
import path from "node:path";
import {DEFAULT_FILE_EXTENSIONS} from "../src/constants";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the PmdCpdEnginesPlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new PmdCpdEnginesPlugin();
    });

    it(`When the getAvailableEngineNames method is called then both 'pmd' and 'cpd' are returned`, () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['pmd', 'cpd']);
    });

    it(`When describeEngineConfig is passed 'cpd' then the correct config description is returned`, async () => {
        expect(plugin.describeEngineConfig('cpd')).toEqual(CPD_ENGINE_CONFIG_DESCRIPTION);
    });

    it(`When describeEngineConfig is passed 'pmd' then the correct config description is returned`, async () => {
        expect(plugin.describeEngineConfig('pmd')).toEqual(PMD_ENGINE_CONFIG_DESCRIPTION);
    });

    it('When describeEngineConfig is passed an unsupported engine name, then an error is thrown', async () => {
        expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName', 'oops'));
    });

    it(`When createEngineConfig for 'cpd' is given an object with an unknown field, then error`, async () => {
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({unknownField: 3}, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.cpd', 'unknownField',
                '["file_extensions","java_command","minimum_tokens","skip_duplicate_files"]'));
    });

    it(`When createEngineConfig for 'cpd' is given an empty raw config, then the correct defaults are returned (assuming java version is correct on machine)`, async () => {
        // This test assumes that all environments that run this test will have JAVA v11+ installed and either has
        // * the JAVA_HOME environment variable points to the home folder of this java command
        // * or has the java command is already on the top of the PATH
        const resolvedConfig: PmdEngineConfig = await plugin.createEngineConfig('cpd', new ConfigValueExtractor({}, 'engines.cpd')) as PmdEngineConfig;
        expect(resolvedConfig.java_command.endsWith('java')).toEqual(true);
        expect(resolvedConfig).toEqual({
            java_command: resolvedConfig.java_command, // Already checked that it ends with 'java'
            rule_languages: ['apex', 'html', 'javascript', 'typescript', 'visualforce', 'xml'],
            file_extensions: DEFAULT_FILE_EXTENSIONS,
            minimum_tokens: {
                apex: 100,
                html: 100,
                javascript: 100,
                typescript: 100,
                visualforce: 100,
                xml: 100
            },
            skip_duplicate_files: false
        });
    });

    it(`When createEngineConfig for 'pmd' is given an object with an unknown field, then error`, async () => {
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor({unknownField: 3}, 'engines.pmd');
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.pmd', 'unknownField',
                '["custom_rulesets","file_extensions","java_classpath_entries","java_command"]'));
    });

    it(`When createEngineConfig for 'pmd' is given an empty raw config, then the correct defaults are returned (assuming java version is correct on machine)`, async () => {
        // This test assumes that all environments that run this test will have JAVA v11+ installed and either has
        // * the JAVA_HOME environment variable points to the home folder of this java command
        // * or has the java command is already on the top of the PATH
        const resolvedConfig: PmdEngineConfig = await plugin.createEngineConfig('pmd', new ConfigValueExtractor({}, 'engines.pmd')) as PmdEngineConfig;
        expect(resolvedConfig.java_command.endsWith('java')).toEqual(true);
        expect(resolvedConfig).toEqual({
            java_command: resolvedConfig.java_command, // Already checked that it ends with 'java'
            rule_languages: ['apex', 'html', 'javascript', 'visualforce', 'xml'],
            file_extensions: DEFAULT_FILE_EXTENSIONS,
            java_classpath_entries: [],
            custom_rulesets: []
        });
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an empty raw config and if our attempt to look-up java on the users machine fails, then error`, async (engineName) => {
        const pluginWithStub: PmdCpdEnginesPlugin =  new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(null));
        try {
            await pluginWithStub.createEngineConfig(engineName, new ConfigValueExtractor({}, `engines.${engineName}`));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain('Could not locate Java v11.0.0+');
            expect(errMsg).toContain(getMessage('UnrecognizableJavaVersion', 'java'));
        }
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an empty raw config and if our attempt to look-up java on the users machine produces old java version, then error`, async (engineName) => {
        const pluginWithStub: PmdCpdEnginesPlugin = new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('1.8.0')));
        try {
            await pluginWithStub.createEngineConfig(engineName, new ConfigValueExtractor({}, `engines.${engineName}`));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain('Could not locate Java v11.0.0+');
            expect(errMsg).toContain(getMessage('JavaBelowMinimumVersion', 'java', '1.8.0', '11.0.0'));
        }
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an invalid java_command, then error`, async (engineName) => {
        try {
            await plugin.createEngineConfig(engineName, new ConfigValueExtractor({java_command: '/does/not/exist/java'}, `engines.${engineName}`));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(`The 'engines.${engineName}.java_command' configuration value is invalid.`);
            expect(errMsg).toContain(`When attempting to find the version of command '/does/not/exist/java', an error was thrown:`);
        }
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given a java_command that version less than minimum required, then error`, async (engineName) => {
        const pluginWithStub: PmdCpdEnginesPlugin =  new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('1.9.0')));
        await expect(pluginWithStub.createEngineConfig(engineName, new ConfigValueExtractor({java_command: '/some/java'}, `engines.${engineName}`))).rejects.toThrow(
            getMessage('InvalidUserSpecifiedJavaCommand', `engines.${engineName}.java_command`,
                getMessage('JavaBelowMinimumVersion', '/some/java', '1.9.0', '11.0.0')));
    });

    it.each([
        {engineName: 'cpd', javaCommand: './scripts/afv-pmd-java'},
        {engineName: 'pmd', javaCommand: './scripts/afv-pmd-java'},
        {engineName: 'cpd', javaCommand: 'scripts/foo'},
        {engineName: 'pmd', javaCommand: 'scripts/foo'},
        {engineName: 'cpd', javaCommand: '../foo'},
        {engineName: 'pmd', javaCommand: '../foo'}
    ])(`When createEngineConfig for '$engineName' is given a relative java_command '$javaCommand', then reject it without ever spawning the command`, async ({engineName, javaCommand}) => {
        const throwingStub: ThrowIfCalledJavaVersionIdentifier = new ThrowIfCalledJavaVersionIdentifier();
        const pluginWithStub: PmdCpdEnginesPlugin = new PmdCpdEnginesPlugin(throwingStub);
        try {
            await pluginWithStub.createEngineConfig(engineName, new ConfigValueExtractor({java_command: javaCommand}, `engines.${engineName}`));
            fail('Expected error to be thrown');
        } catch (err) {
            const errMsg: string = (err as Error).message;
            expect(errMsg).toContain(`The 'engines.${engineName}.java_command' configuration value is invalid.`);
            expect(errMsg).toContain('relative file paths are not allowed');
        }
        expect(throwingStub.wasCalled).toEqual(false);
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an absolute path java_command, then it still resolves (no spawn regression)`, async (engineName) => {
        const pluginWithStub: PmdCpdEnginesPlugin = new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('21.4.0')));
        const normalizedConfig: PmdEngineConfig = await pluginWithStub.createEngineConfig(engineName,
            new ConfigValueExtractor({java_command: '/some/java'}, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.java_command).toEqual('/some/java');
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given a bare command name java_command, then it still resolves`, async (engineName) => {
        const pluginWithStub: PmdCpdEnginesPlugin = new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('21.4.0')));
        const normalizedConfig: PmdEngineConfig = await pluginWithStub.createEngineConfig(engineName,
            new ConfigValueExtractor({java_command: 'java'}, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.java_command).toEqual('java');
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given a java_command that is greater than the minimum required, then use it`, async (engineName) => {
        const pluginWithStub: PmdCpdEnginesPlugin =  new PmdCpdEnginesPlugin(new StubJavaVersionIdentifier(new SemVer('21.4.0')));
        const rawConfig: ConfigObject = {java_command: '/some/java'};
        const normalizedConfig: PmdEngineConfig = await pluginWithStub.createEngineConfig(engineName,
            new ConfigValueExtractor(rawConfig, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.java_command).toEqual('/some/java');
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an valid list of rule languages, then normalize it`, async (engineName) => {
        const rawConfig: ConfigObject = {rule_languages: ['APEX', 'xml', 'VisualForce']};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig(engineName,
            new ConfigValueExtractor(rawConfig, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual(['apex', 'visualforce', 'xml']);
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given ecmascript among the list of rule languages, then normalize it to equal javascript`, async (engineName) => {
        const rawConfig: ConfigObject = {rule_languages: ['apex', 'ecmascript']};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig(engineName,
            new ConfigValueExtractor(rawConfig, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual(['apex', 'javascript']);
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given both javascript and ecmascript among the list of rule languages, then remove duplicate`, async (engineName) => {
        const rawConfig: ConfigObject = {rule_languages: ['xml', 'javaScript', 'EcmaScript']};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig(engineName,
            new ConfigValueExtractor(rawConfig, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual(['javascript', 'xml']);
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an empty list of rule languages, then use it`, async (engineName) => {
        const rawConfig: ConfigObject = {rule_languages: []};
        const normalizedConfig: PmdEngineConfig = await plugin.createEngineConfig(engineName,
            new ConfigValueExtractor(rawConfig, `engines.${engineName}`)) as PmdEngineConfig;
        expect(normalizedConfig.rule_languages).toEqual([]);
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an rule_languages value that is not a string array, then error`, async (engineName) => {
        const rawConfig1: ConfigObject = {rule_languages: 'apex'}; // String is not a string array
        await expect(plugin.createEngineConfig(engineName, new ConfigValueExtractor(rawConfig1, `engines.${engineName}`)))
            .rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                `engines.${engineName}.rule_languages`, 'array', 'string'));
        const rawConfig2: ConfigObject = {rule_languages: ['apex', 5]}; // 5 is not a string
        await expect(plugin.createEngineConfig(engineName, new ConfigValueExtractor(rawConfig2, `engines.${engineName}`)))
            .rejects.toThrow(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                `engines.${engineName}.rule_languages[1]`, 'string', 'number'));
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given a file_extensions value contains an invalid language, then errors`, async (engineName) => {
        const rawConfig: ConfigObject = {
            file_extensions: {
                oops: ['.js', '.jsx']
            }
        };
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.${engineName}`);
        await expect(plugin.createEngineConfig(engineName, configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey',
                `engines.${engineName}.file_extensions`, 'oops',
                '["apex","html","javascript","typescript","visualforce","xml"]'));
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given a valid file_extensions value is passed to createEngineConfig, then it is set on the config`, async (engineName) => {
        const rawConfig: ConfigObject = {
            file_extensions: {
                javaScriPT: ['.js', '.jsX', '.JS'] // And check we do uniqueness with case insensitivity
            }
        };
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.${engineName}`);
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig(engineName, configValueExtractor);
        expect(resolvedConfig['file_extensions']).toEqual({
            ...DEFAULT_FILE_EXTENSIONS,
            javascript: ['.js', '.jsX']}); // Also checks that duplicates are removed
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an invalid file extension value type, then error`, async (engineName) => {
        const rawConfig: ConfigObject = {
            file_extensions: {
                apex: ['.cls','.trigger',3]
            }
        };
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.${engineName}`);
        await expect(plugin.createEngineConfig(engineName, configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                `engines.${engineName}.file_extensions.apex[2]`, 'string', 'number'));
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given an invalid file extension value format, then error`, async (engineName) => {
        const rawConfig: ConfigObject = {
            file_extensions: {
                xml: ['.xml','missingDot']
            }
        };
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.${engineName}`)
        await expect(plugin.createEngineConfig(engineName, configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp',
                `engines.${engineName}.file_extensions.xml[1]`, '/^[.][a-zA-Z0-9]+$/'));
    });

    it.each(['cpd','pmd'])(`When createEngineConfig for '%s' is given a file extension that is listed under more than one language, then error`, async (engineName) => {
        const rawConfig: ConfigObject = {
            file_extensions: {
                apex: ['.xml'] // Already listed in the xml language by default
            }
        };
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.${engineName}`)
        await expect(plugin.createEngineConfig(engineName, configValueExtractor)).rejects.toThrow(
            getMessage('InvalidFileExtensionDueToItBeingListedTwice',
                `engines.${engineName}.file_extensions`, '.xml', '["apex","xml"]'));
    });

    it(`When createEngineConfig for 'pmd' is given an unsupported rule language, then error`, async () => {
        const rawConfig: ConfigObject = {rule_languages: ['apex', 'typescript', 'xml']}; // We don't support cpp
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd');
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessage('InvalidRuleLanguage', 'engines.pmd.rule_languages', 'typescript',
                `'apex', 'html', 'javascript' (or 'ecmascript'), 'visualforce', 'xml'`));
    });

    it(`When createEngineConfig for 'cpd' is given an unsupported rule language, then error`, async () => {
        const rawConfig: ConfigObject = {rule_languages: ['apex', 'cpp', 'xml']}; // We don't support cpp
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessage('InvalidRuleLanguage', 'engines.cpd.rule_languages', 'cpp',
                `'apex', 'html', 'javascript' (or 'ecmascript'), 'typescript', 'visualforce', 'xml'`));
    });

    it(`When createEngineConfig for 'pmd' is given a non-array value for java_classpath_entries, then error`, async () => {
        const rawConfig: ConfigObject = {
            java_classpath_entries: path.join('test-data','custom rules','category_joshapex_somecat2.jar'), // Not in an array
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.pmd.java_classpath_entries', 'array', 'string'));
    });

    it(`When createEngineConfig for 'pmd' is given a java classpath entry that is not a string, then error`, async () => {
        const rawConfig: ConfigObject = {
            java_classpath_entries: [
                path.join('test-data','custom rules','category_joshapex_somecat2.jar'),
                3 // should throw error
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.pmd.java_classpath_entries[1]', 'string', 'number'));
    });

    it(`When createEngineConfig for 'pmd' is given a java classpath entry that is not a folder or a jar file, then error`, async () => {
        const rawConfig: ConfigObject = {
            java_classpath_entries: [
                path.join('test-data','custom rules','category_joshapex_somecat2.jar'),
                path.join('test-data','custom rules','somecat3.xml') // not allowed
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessage('InvalidJavaClasspathEntry', 'engines.pmd.java_classpath_entries[1]'));
    });

    it(`When createEngineConfig for 'pmd' is given a java classpath entry that does not exist, then error`, async () => {
        const rawConfig: ConfigObject = {
            java_classpath_entries: [
                path.join('test-data','custom rules','does_not_exist.jar'),
                path.join('test-data','custom rules','category_joshapex_somecat2.jar')
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist', 'engines.pmd.java_classpath_entries[0]',
                path.join(__dirname, 'test-data','custom rules','does_not_exist.jar')));
    });

    it(`When createEngineConfig for 'pmd' is given a relative path java classpath entry, then we resolve to absolute path`, async () => {
        const rawConfig: ConfigObject = {
            java_classpath_entries: [
                path.join('test-data','custom rules','category_joshapex_somecat2.jar'),
                path.join(__dirname, 'test-data','custom rules','category_joshapex_somecat2.jar'), // duplicates should also be removed
                path.join('test-data','custom rules','subfolder')
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('pmd', configValueExtractor);
        expect(resolvedConfig['java_classpath_entries']).toEqual([
            path.join(__dirname, 'test-data','custom rules','category_joshapex_somecat2.jar'),
            path.join(__dirname, 'test-data','custom rules','subfolder')
        ]);
    });

    it(`When createEngineConfig for 'pmd' is given a non-array value for custom_rulesets, then error`, async () => {
        const rawConfig: ConfigObject = {
            custom_rulesets: path.join('test-data','custom rules','somecat3.xml'), // Not in an array
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.pmd.custom_rulesets', 'array', 'string'));
    });

    it(`When createEngineConfig for 'pmd' is given a custom ruleset array containing a non-string value, then error`, async () => {
        const rawConfig: ConfigObject = {
            custom_rulesets: [
                path.join('test-data','custom rules','somecat3.xml'),
                path.join('test-data','custom rules','subfolder', 'somecat4.xml'),
                { oops: 3 } // should throw error
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        await expect(plugin.createEngineConfig('pmd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.pmd.custom_rulesets[2]', 'string', 'object'));
    });

    it(`When createEngineConfig for 'pmd' is given valid custom ruleset values, then make sure they are in resolved config`, async () => {
        const rawConfig: ConfigObject = {
            java_classpath_entries: [
                path.join('test-data','custom rules','category_joshapex_somecat2.jar'),
                path.join('test-data','custom rules','subfolder')
            ],
            custom_rulesets: [
                path.join('test-data','custom rules','somecat3.xml'),
                path.join('test-data','custom rules','somecat3.xml'), // Also confirm duplicates are removed
                'somecat4.xml',
                'category/joshapex/somecat2.xml'
            ]
        };
        const configRoot: string = __dirname;
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.pmd', configRoot);
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('pmd', configValueExtractor);
        expect(resolvedConfig['custom_rulesets']).toEqual([
            path.join(__dirname, 'test-data','custom rules','somecat3.xml'), // resolved to absolute (from config root)
            path.join(__dirname, 'test-data','custom rules','subfolder', 'somecat4.xml'), // resolved to absolute (from folder added to java classpath)
            'category/joshapex/somecat2.xml' // not on disk so left as is since it might be inside a jar that is on the java classpath
        ]);
    });

    it(`When createEngineConfig for 'cpd' is given a minimum_tokens value that is not an object, then error`, async () => {
        const rawConfig: ConfigObject = {minimum_tokens: 'oops'};
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.cpd.minimum_tokens', 'object', 'string'));
    });

    it(`When createEngineConfig for 'cpd' is given a minimum_tokens.apex value that is not a number, then error`, async () => {
        const rawConfig: ConfigObject = {minimum_tokens: {apex: 'oops'}};
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.cpd.minimum_tokens.apex', 'number', 'string'));
    });

    it(`When createEngineConfig for 'cpd' is given a minimum_tokens with an invalid language, then error`, async () => {
        const rawConfig: ConfigObject = {minimum_tokens: {apex: 100, oops: 100}};
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.cpd.minimum_tokens',
                'oops', '["apex","html","javascript","typescript","visualforce","xml"]'));
    });

    it.each([-5,0,2.5])(`When createEngineConfig for 'cpd' is given a minumum_tokens.xml number %s that is not a positive integer, then error`, async (invalidValue) => {
        const rawConfig: ConfigObject = {minimum_tokens: {apex: 10, xml: invalidValue}};
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessage('InvalidPositiveInteger', 'engines.cpd.minimum_tokens.xml'));
    });

    it(`When createEngineConfig for 'cpd' is given a valid minimum_tokens value, then it is used`, async() => {
        const rawConfig: ConfigObject = {minimum_toKens: {aPEx: 18, xml: 30, javaSCRipt: 25}}; // Also test that the names are case-insensitive
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('cpd', configValueExtractor);
        expect(resolvedConfig['minimum_tokens']).toEqual({
            apex: 18,
            html: 100,
            javascript: 25,
            typescript: 100,
            visualforce: 100,
            xml: 30
        });
    });

    it(`When createEngineConfig for 'cpd' is given a skip_duplicate_files value that is not a boolean, then error`, async () => {
        const rawConfig: ConfigObject = {skip_duplicate_files: 3};
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        await expect(plugin.createEngineConfig('cpd', configValueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.cpd.skip_duplicate_files', 'boolean', 'number'));
    });

    it(`When createEngineConfig for 'cpd' is given a valid skip_duplicate_files value, then it is used`, async() => {
        const rawConfig: ConfigObject = {skip_duplicate_files: true};
        const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.cpd');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('cpd', configValueExtractor);
        expect(resolvedConfig['skip_duplicate_files']).toEqual(true);
    });

    it('When createEngineConfig is called with an unsupported engine name, then an error is thrown', async () => {
        await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}))).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'oops'));
    });

    it(`When createEngine is passed 'cpd' then the CpdEngine is returned`, async () => {
        expect(await plugin.createEngine('cpd', DEFAULT_CPD_ENGINE_CONFIG)).toBeInstanceOf(CpdEngine);
    });

    it(`When createEngine is passed 'pmd' then the PmdEngine is returned`, async () => {
        expect(await plugin.createEngine('pmd', DEFAULT_PMD_ENGINE_CONFIG)).toBeInstanceOf(PmdEngine);
    });

    it('When createEngine is passed an unsupported engine name, then an error is thrown', async () => {
        await expect(plugin.createEngine('oops', {})).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'oops'));
    });
});

class StubJavaVersionIdentifier implements JavaVersionIdentifier {
    private readonly version: SemVer|null;

    constructor(version: SemVer|null) {
        this.version = version;
    }

    async identifyJavaVersion(_javaCommand: string): Promise<SemVer|null> {
        return this.version;
    }
}

// Fails the test if identifyJavaVersion is ever called (i.e. if the java_command binary would ever be spawned).
class ThrowIfCalledJavaVersionIdentifier implements JavaVersionIdentifier {
    wasCalled: boolean = false;

    async identifyJavaVersion(_javaCommand: string): Promise<SemVer|null> {
        this.wasCalled = true;
        throw new Error('spawn must not be called for a relative java_command');
    }
}