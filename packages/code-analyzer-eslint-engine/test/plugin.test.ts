import {
    ConfigObject, ConfigValueExtractor,
    Engine,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {ESLintEnginePlugin} from "../src";
import {ESLintEngine} from "../src/engine";
import {
    DEFAULT_CONFIG,
    ESLINT_ENGINE_CONFIG_DESCRIPTION,
    LEGACY_ESLINT_CONFIG_FILES,
    LEGACY_ESLINT_IGNORE_FILE
} from "../src/config";
import path from "node:path";

describe('Tests for the ESLintEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new ESLintEnginePlugin();
    });

    it('When the getAvailableEngineNames method is called then only eslint is returned', () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['eslint']);
    });

    it('When createEngineConfigDescription is called with an invalid engine name, then error is thrown', () => {
        expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName','oops'));
    });

    it('When createEngineConfigDescription is with a valid engine name, then return the correct ConfigDescription', async () => {
        expect(plugin.describeEngineConfig(ESLintEngine.NAME)).toEqual(ESLINT_ENGINE_CONFIG_DESCRIPTION);
    });

    it('When createEngineConfig is called with an invalid engine name, then error is thrown', async () => {
        await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}))).rejects.toThrow(
            getMessage('UnsupportedEngineName','oops'));
    });

    it('When createEngineConfig a valid engine name is empty overrides, then the default config is returned', async () => {
        expect(await callCreateEngineConfig(plugin, {})).toEqual(DEFAULT_CONFIG);
    });

    it('When createEngineConfig is called with an object containing an invalid key, then we error', async () => {
        const userProvidedOverrides: ConfigObject = {dummy: 3};
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.eslint', 'dummy',
                '["auto_discover_eslint_config","disable_javascript_base_config","disable_lwc_base_config",' +
                '"disable_typescript_base_config","eslint_config_file","eslint_ignore_file","file_extensions"]'));
    });

    it('When a valid eslint_config_file is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides: ConfigObject = {
            eslint_config_file: 'test-data/workspaceWithLegacyConfigJson/.eslintrc.json'
        };
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides, __dirname);
        expect(resolvedConfig['eslint_config_file']).toEqual(
            path.resolve(__dirname, 'test-data', 'workspaceWithLegacyConfigJson', '.eslintrc.json'));
    });

    it('When eslint_config_file value does not exist, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            eslint_config_file: 'test-data/doesNotExist'
        };
        const configRoot: string = __dirname;
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides, configRoot)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist',
                'engines.eslint.eslint_config_file', path.resolve(configRoot, 'test-data', 'doesNotExist')));
    });

    it('When eslint_config_file is not one of the supported legacy config file names, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            eslint_config_file: 'eslint.config.mjs' // TODO: This test will soon change so we support both
        };
        const configRoot: string = path.resolve(__dirname, '..');
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides, configRoot)).rejects.toThrow(
            getMessage('InvalidLegacyConfigFileName', 'engines.eslint.eslint_config_file', 'eslint.config.mjs',
                JSON.stringify(LEGACY_ESLINT_CONFIG_FILES)));
    });

    it('When eslint_ignore_file value does not exist, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            eslint_ignore_file: 'test-data/doesNotExist/.eslintignore'
        };
        const configRoot: string = __dirname;
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides, configRoot)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigPathValueDoesNotExist',
                'engines.eslint.eslint_ignore_file', path.resolve(configRoot, 'test-data', 'doesNotExist', '.eslintignore')));
    });

    it('When eslint_ignore_file does not have a file name of .eslintignore, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            eslint_ignore_file: path.join('test-data', 'rules_OnlyJavaScriptBaseConfig.goldfile.json')
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides, __dirname)).rejects.toThrow(
            getMessage('InvalidLegacyIgnoreFileName', 'engines.eslint.eslint_ignore_file',
                'rules_OnlyJavaScriptBaseConfig.goldfile.json', LEGACY_ESLINT_IGNORE_FILE));
    });

    it('When auto_discover_eslint_config is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides: ConfigObject = {
            auto_discover_eslint_config: true
        };
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides);
        expect(resolvedConfig['auto_discover_eslint_config']).toEqual(true);
    });

    it('When auto_discover_eslint_config is invalid, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            auto_discover_eslint_config: 3
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.auto_discover_eslint_config', 'boolean', 'number'));
    });

    it('When disable_javascript_base_config is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides: ConfigObject = {
            disable_javascript_base_config: true
        };
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides);
        expect(resolvedConfig['disable_javascript_base_config']).toEqual(true);
    });

    it('When disable_javascript_base_config is invalid, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            disable_javascript_base_config: 'abc'
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.disable_javascript_base_config', 'boolean', 'string'));
    });

    it('When disable_lwc_base_config is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides1: ConfigObject = {
            disable_lwc_base_config: true
        };
        const resolvedConfig1: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides1);
        expect(resolvedConfig1['disable_lwc_base_config']).toEqual(true);

        // Sanity check that false is handled correctly as well
        const userProvidedOverrides2: ConfigObject = {
            disable_lwc_base_config: false
        };
        const resolvedConfig2: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides2);
        expect(resolvedConfig2['disable_lwc_base_config']).toEqual(false);
    });

    it('When disable_lwc_base_config is invalid, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            disable_lwc_base_config: {}
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.disable_lwc_base_config', 'boolean', 'object'));
    });

    it('When disable_typescript_base_config is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides1: ConfigObject = {
            disable_typescript_base_config: true
        };
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides1);
        expect(resolvedConfig['disable_typescript_base_config']).toEqual(true);
    });

    it('When disable_typescript_base_config is invalid, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            disable_typescript_base_config: 'abc'
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.disable_typescript_base_config', 'boolean', 'string'));
    });

    it('When a file_extensions value contains an invalid language, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            file_extensions: {
                oops: ['.js', '.jsx']
            }
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.eslint.file_extensions',
                'oops', '["javascript","other","typescript"]'));
    });

    it('When a valid file_extensions.javascript value is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides: ConfigObject = {
            file_extensions: {
                javascript: ['.js', '.jsx', '.js']
            }
        };
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides);
        expect(resolvedConfig['file_extensions']).toEqual({
            ...DEFAULT_CONFIG.file_extensions,
            javascript: ['.js', '.jsx']}); // Also checks that duplicates are removed
    });

    it('When file_extensions.javascript is invalid, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            file_extensions: {
                javascript: [3, '.js']
            }
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.eslint.file_extensions.javascript[0]', 'string', 'number'));
    });

    it('When a valid file_extensions.typescript value is passed to createEngineConfig, then it is set on the config', async () => {
        const userProvidedOverrides: ConfigObject = {
            file_extensions: {
                typescript: ['.tS', '.tsX'] // Also confirm we normalize the extensions to lowercase
            }
        };
        const resolvedConfig: ConfigObject = await callCreateEngineConfig(plugin, userProvidedOverrides);
        expect(resolvedConfig['file_extensions']).toEqual({
            ... DEFAULT_CONFIG.file_extensions,
            typescript: ['.ts', '.tsx']
        });
    });

    it('When file_extensions.typescript is invalid, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            file_extensions: {
                typescript: ['.ts', 'missingDot']
            }
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp',
                'engines.eslint.file_extensions.typescript[1]', '/^[.][a-zA-Z0-9]+$/'));
    });

    it('When an extension is listed under more than one language within the file_extensions object, then createEngineConfig errors', async () => {
        const userProvidedOverrides: ConfigObject = {
            file_extensions: {
                typescript: ['.ts', '.js']
            }
        };
        await expect(callCreateEngineConfig(plugin, userProvidedOverrides)).rejects.toThrow(
            getMessage('InvalidFileExtensionDueToItBeingListedTwice',
                'engines.eslint.file_extensions', '.js', '["javascript","typescript"]'));
    });

    it('When createEngine is passed an invalid engine name, then an error is thrown', async () => {
        await expect(plugin.createEngine('oops', DEFAULT_CONFIG)).rejects.toThrow(
            getMessage('UnsupportedEngineName' ,'oops'));
    });

    it('When createEngine is passed eslint and a valid config, then an ESLintEngine instance is returned', async () => {
        const engine: Engine = await plugin.createEngine('eslint', DEFAULT_CONFIG);
        expect(engine).toBeInstanceOf(ESLintEngine);
    });
});

async function callCreateEngineConfig(plugin: EnginePluginV1, userProvidedOverrides: ConfigObject, configRoot?: string): Promise<ConfigObject> {
    const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(userProvidedOverrides, `engines.${ESLintEngine.NAME}`, configRoot);
    return await plugin.createEngineConfig(ESLintEngine.NAME, configValueExtractor);
}
