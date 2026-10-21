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

    it('returns flowAnalyzer from getAvailableEngineNames', () => {
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

    it('describes the flowAnalyzer config schema', () => {
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

    it('rejects missing target_org', async () => {
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({}, `engines.${ENGINE_NAME}`)))
            .rejects.toThrow(getMessage('MissingTargetOrg', `engines.${ENGINE_NAME}.target_org`));
    });

    it('rejects non-positive numeric config', async () => {
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: 'my-org',
            api_timeout_ms: 0
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('ConfigValueMustBePositive', `engines.${ENGINE_NAME}.api_timeout_ms`));
    });

    it('rejects empty target_org', async () => {
        await expect(plugin.createEngineConfig(ENGINE_NAME, new ConfigValueExtractor({
            target_org: '   '
        }, `engines.${ENGINE_NAME}`))).rejects.toThrow(
            getMessage('MissingTargetOrg', `engines.${ENGINE_NAME}.target_org`));
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
