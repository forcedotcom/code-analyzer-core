import { ConfigObject, ConfigValueExtractor, EnginePluginV1 } from '@salesforce/code-analyzer-engine-api';
import { FlowAnalyzerEnginePlugin } from '../src';
import { FlowAnalyzerEngine } from '../src/engine';
import { getMessage } from '../src/messages';
import { ENGINE_NAME } from '../src/constants';

describe('Tests for the FlowAnalyzerEnginePlugin', () => {
    let plugin: EnginePluginV1;

    beforeAll(() => {
        plugin = new FlowAnalyzerEnginePlugin();
    });

    it('returns flow-analyzer from getAvailableEngineNames', () => {
        expect(plugin.getAvailableEngineNames()).toEqual([ENGINE_NAME]);
    });

    it('throws when createEngine is called with an invalid name', async () => {
        await expect(plugin.createEngine('error_engine', {})).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'error_engine'));
    });

    it('throws when describeEngineConfig is called with an invalid name', () => {
        expect(() => plugin.describeEngineConfig('error_engine')).toThrow(
            getMessage('UnsupportedEngineName', 'error_engine'));
    });

    it('describes the flow-analyzer config schema', () => {
        const description = plugin.describeEngineConfig(ENGINE_NAME);
        expect(description.fieldDescriptions?.target_org.valueType).toEqual('string');
    });

    it('creates a FlowAnalyzerEngine when target_org is provided', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org'
        }, `engines.${ENGINE_NAME}`));
        expect(config.target_org).toEqual('my-org');
        expect(await plugin.createEngine(ENGINE_NAME, config as ConfigObject)).toBeInstanceOf(FlowAnalyzerEngine);
    });

    it('creates a FlowAnalyzerEngine without target_org so scans without --target-org are not broken', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({}, `engines.${ENGINE_NAME}`));
        expect(config.target_org).toBeUndefined();
        expect(await plugin.createEngine(ENGINE_NAME, config as ConfigObject)).toBeInstanceOf(FlowAnalyzerEngine);
    });

    it('rejects non-positive numeric config', async () => {
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_timeout_ms: 0
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('ConfigValueMustBePositive', `engines.${ENGINE_NAME}.api_timeout_ms`));
    });

    it('treats a blank target_org as not configured', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: '   '
        }, `engines.${ENGINE_NAME}`));
        expect(config.target_org).toBeUndefined();
    });

    it('leaves api_version unset by default so the org version can be used', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org'
        }, `engines.${ENGINE_NAME}`));
        expect(config.api_version).toBeUndefined();
    });

    it('accepts an explicit api_version', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_version: '69.0'
        }, `engines.${ENGINE_NAME}`));
        expect(config.api_version).toEqual('69.0');
    });

    it('rejects a malformed api_version', async () => {
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_version: 'v69'
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('InvalidApiVersion', `engines.${ENGINE_NAME}.api_version`, 'v69'));
    });

    it.each(['60.0', '67.0', '1.0'])('rejects api_version %s with the correct minimum', async apiVersion => {
        const rejection = plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_version: apiVersion
        }, `engines.${ENGINE_NAME}`));
        await expect(rejection).rejects.toThrow(
            `The value of 'engines.flow-analyzer.api_version' must be at least '68.0', but was '${apiVersion}'.`);
        await expect(rejection).rejects.toHaveProperty('stack', undefined);
    });

    it('accepts api_version exactly at the minimum (68.0)', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_version: '68.0'
        }, `engines.${ENGINE_NAME}`));
        expect(config.api_version).toEqual('68.0');
    });

    it('accepts api_version well above the minimum (100.0)', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_version: '100.0'
        }, `engines.${ENGINE_NAME}`));
        expect(config.api_version).toEqual('100.0');
    });

    it('trims target_org', async () => {
        const config = await plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: '  my-org  '
        }, `engines.${ENGINE_NAME}`));
        expect(config.target_org).toEqual('my-org');
    });

    it('rejects non-positive max_file_count, max_file_bytes, and max_payload_bytes', async () => {
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            max_file_count: 0
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('ConfigValueMustBePositive', `engines.${ENGINE_NAME}.max_file_count`));
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            max_file_bytes: -1
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('ConfigValueMustBePositive', `engines.${ENGINE_NAME}.max_file_bytes`));
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            max_payload_bytes: 0
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('ConfigValueMustBePositive', `engines.${ENGINE_NAME}.max_payload_bytes`));
    });

    it('throws when createEngineConfig is called with an invalid name', async () => {
        await expect(plugin.createEngineConfig('error_engine', new ConfigValueExtractor({
            target_org: 'my-org'
        }, 'engines.error_engine'))).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'error_engine'));
    });
});
