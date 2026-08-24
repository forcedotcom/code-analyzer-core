import {
    ConfigObject,
    Engine,
    EnginePluginV1,
} from "@salesforce/code-analyzer-engine-api";
import { getMessage } from "./messages";
import { UIBundleEngine } from "./engine";

export class UIBundleEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [UIBundleEngine.NAME];
    }

    async createEngine(engineName: string, _resolvedConfig: ConfigObject): Promise<Engine> {
        if (engineName !== UIBundleEngine.NAME) {
            throw new Error(getMessage('UnsupportedEngineName', engineName));
        }
        return new UIBundleEngine();
    }
}
