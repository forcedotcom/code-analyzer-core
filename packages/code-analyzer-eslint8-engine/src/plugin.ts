import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {ESLINT_ENGINE_CONFIG_DESCRIPTION, ESLint8EngineConfig, validateAndNormalizeConfig} from "./config";
import {ESLint8Engine} from "./engine";

export class ESLint8EnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [ESLint8Engine.NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return ESLINT_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        return validateAndNormalizeConfig(configValueExtractor) as ConfigObject;
    }

    async createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new ESLint8Engine(resolvedConfig as ESLint8EngineConfig);
    }
}

function validateEngineName(engineName: string) {
    if (engineName !== ESLint8Engine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}
