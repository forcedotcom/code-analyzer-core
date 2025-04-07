// *** Use the ConfigValueExtractor if user-configuration needs testing
//import { ConfigValueExtractor } from "@salesforce/code-analyzer-engine-api";
import { EnginePluginV1 } from "@salesforce/code-analyzer-engine-api";
import { TemplateEnginePlugin } from "../src";
import { TemplateEngine } from "../src/engine";
import { getMessage } from "../src/messages";

describe('Tests for the TemplateEnginePlugin', () => {
    let plugin: EnginePluginV1;
    // *** Update to your new name
    const engineName = 'template'
    beforeAll(() => {
        // *** Update to your new Engine
        plugin = new TemplateEnginePlugin();
    });

    describe('getAvailableEngineNames', () => {
        it(`When the getAvailableEngineNames method is called then 'template' is returned`, () => {
            expect(plugin.getAvailableEngineNames()).toEqual([engineName]);
        });
    });

    describe('createEngine', () => {
        it(`When the create engine is called with a invalid name then an error is thrown`, async() => {
            await expect(plugin.createEngine('error_engine', {})).rejects.toThrow(
                getMessage('UnsupportedEngineName', 'error_engine'));
        });

        it(`When createEngine is passed 'template', then the TemplateEngine is returned`, async() => {
            expect(await plugin.createEngine(engineName, {})).toBeInstanceOf(TemplateEngine);
        });

    });

});