import {
    ConfigValueExtractor,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {SfgeEnginePlugin} from "../src";
import {
    DEFAULT_SFGE_ENGINE_CONFIG,
    SFGE_ENGINE_CONFIG_DESCRIPTION,
    SfgeEngineConfig
} from "../src/config";
import {SfgeEngine} from "../src/engine";
import {getMessage} from '../src/messages';

describe('SfgeEnginePlugin', () => {
    let plugin: EnginePluginV1;

    beforeAll(() => {
        plugin = new SfgeEnginePlugin();
    });

    it(`#getAvailableEngineNames() returns 'sfge'`, () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['sfge']);
    });

    describe('#describeEngineConfig', () => {
        it(`When passed 'sfge', the correct config description is returned.`, () => {
            expect(plugin.describeEngineConfig('sfge')).toEqual(SFGE_ENGINE_CONFIG_DESCRIPTION);
        });

        it('When passed an unsupported engine name, an appropriate error is thrown', () => {
            expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName', 'oops'));
        });
    });

    describe('#createEngineConfig', () => {
        it('When passed an unsupported engine name, an appropriate error is thrown', async () => {
           await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}, 'engines.oops')))
               .rejects.toThrow(getMessage('UnsupportedEngineName', 'oops'));
        });

        it('When given an object with an unknown field, an appropriate error is thrown', async () => {
            const cve: ConfigValueExtractor = new ConfigValueExtractor({invalidField: 2}, 'engines.sfge');
            await expect(plugin.createEngineConfig('sfge', cve)).rejects.toThrow(
                getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.sfge', 'invalidField',
                    '[]'));
        });

        // SFGE currently has no configuration properties. When it adds some, this test will need to be replaced with
        // tests that actually validate the config.
        it('When given an empty raw config, the config is accepted without change', async () => {
            const resolvedConfig: SfgeEngineConfig = await plugin.createEngineConfig('sfge', new ConfigValueExtractor({}, 'engines.sfge')) as SfgeEngineConfig;
            expect(resolvedConfig).toEqual({});
        });
    });

    describe('#createEngine', () => {
        it(`When passed 'sfge', returns an SfgeEngine instance`, async () => {
            expect(await plugin.createEngine('sfge', DEFAULT_SFGE_ENGINE_CONFIG)).toBeInstanceOf(SfgeEngine);
        });

        it('When passed an unsupported engine name, throws an appropriate error', async () => {
            await expect(plugin.createEngine('oops', {})).rejects.toThrow(
                getMessage('UnsupportedEngineName', 'oops'));
        });
    });
});