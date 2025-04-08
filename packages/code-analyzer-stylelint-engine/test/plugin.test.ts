// *** Use the ConfigValueExtractor if user-configuration needs testing
//import { ConfigValueExtractor } from "@salesforce/code-analyzer-engine-api";
import { EnginePluginV1 } from "@salesforce/code-analyzer-engine-api";
import { StylelintEngine } from "../src/engine";
import { getMessage } from "../src/messages";
import { StylelintEnginePlugin } from "../src/plugin";

describe('Tests for the StylelintEnginePlugin', () => {
    let plugin: EnginePluginV1;
    // *** Update to your new name
    const engineName = 'stylelint'
    beforeAll(() => {
        plugin = new StylelintEnginePlugin();
    });

    describe('getAvailableEngineNames', () => {
        it(`When the getAvailableEngineNames method is called then 'stylelint' is returned`, () => {
            expect(plugin.getAvailableEngineNames()).toEqual([engineName]);
        });
    });

    describe('createEngine', () => {
        it(`When the create engine is called with a invalid name then an error is thrown`, async() => {
            await expect(plugin.createEngine('error_engine', {})).rejects.toThrow(
                getMessage('UnsupportedEngineName', 'error_engine'));
        });

        it(`When createEngine is passed 'stylelint', then the StylelintEngine is returned`, async() => {
            expect(await plugin.createEngine(engineName, {})).toBeInstanceOf(StylelintEngine);
        });

    });

});