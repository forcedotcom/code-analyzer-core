import {
    ConfigObject,
    Engine,
    EnginePluginV1,
} from "@salesforce/code-analyzer-engine-api";
import { getMessage } from "./messages";
import { LwcEngine } from "./engine";

export class LwcEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [LwcEngine.NAME];
    }

    async createEngine(engineName: string, _resolvedConfig: ConfigObject): Promise<Engine> {
        if (engineName !== LwcEngine.NAME) {
            throw new Error(getMessage('UnsupportedEngineName', engineName));
        }
        return new LwcEngine();
    }
}
