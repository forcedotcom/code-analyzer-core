import {
    ConfigObject,
    Engine,
    EnginePluginV1,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import { StylelintEngine } from "./engine";

export class StylelintEnginePlugin extends EnginePluginV1 {

    // *** If your plugin provides multiple engines, we accept that here
    getAvailableEngineNames(): string[] {
        return [StylelintEngine.NAME];
    }

    async createEngine(engineName: string, _resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        // *** Update to use _resolvedConfig, if user-configuration is desired
        return new StylelintEngine();
    }

    // *** Methods available for use if user-configuration is desired
    //describeEngineConfig(engineName: string): ConfigDescription;
    //createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject>;

}

// *** Best Practice - validate the engine name in every public method
// since this library is public
function validateEngineName(engineName: string) {
    if (engineName !== StylelintEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}