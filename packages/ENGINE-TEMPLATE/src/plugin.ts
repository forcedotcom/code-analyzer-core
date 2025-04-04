import {
    ConfigObject,
    Engine,
    EnginePluginV1,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import { TemplateEngine } from "./engine";

// *** Change the Class Name to match your engine's name
export class TemplateEnginePlugin extends EnginePluginV1 {

    // *** Change to match your engine's name
    // *** If your plugin provides multiple engines, we accept that here
    getAvailableEngineNames(): string[] {
        return [TemplateEngine.NAME];
    }

    async createEngine(engineName: string, _resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        // *** Update to use _resolvedConfig, if user-configuration is desired
        return new TemplateEngine();
    }

}

// *** Best Practice - validate the engine name in every public method
// since this library is public
function validateEngineName(engineName: string) {
    if (engineName !== TemplateEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}