import { EnginePluginV1 } from "@salesforce/code-analyzer-engine-api";
import { UIBundleEnginePlugin } from "../src";
import { UIBundleEngine } from "../src/engine";
import { getMessage } from "../src/messages";

describe('Tests for the UIBundleEnginePlugin', () => {
    let plugin: EnginePluginV1;
    const engineName = 'uibundle';
    beforeAll(() => {
        plugin = new UIBundleEnginePlugin();
    });

    describe('getAvailableEngineNames', () => {
        it(`When the getAvailableEngineNames method is called then '${engineName}' is returned`, () => {
            expect(plugin.getAvailableEngineNames()).toEqual([engineName]);
        });
    });

    describe('createEngine', () => {
        it(`When createEngine is called with an invalid name then an error is thrown`, async () => {
            await expect(plugin.createEngine('error_engine', {})).rejects.toThrow(
                getMessage('UnsupportedEngineName', 'error_engine'));
        });

        it(`When createEngine is passed '${engineName}', then the UIBundleEngine is returned`, async () => {
            const engine = await plugin.createEngine(engineName, {});
            expect(engine).toBeInstanceOf(UIBundleEngine);
            expect(engine.getName()).toEqual(engineName);
        });
    });
});
