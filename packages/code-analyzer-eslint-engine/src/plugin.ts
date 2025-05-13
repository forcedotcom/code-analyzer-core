import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {ESLINT_ENGINE_CONFIG_DESCRIPTION, ESLintEngineConfig, validateAndNormalizeConfig} from "./config";
import {ESLintEngine} from "./engine";
import {ESLint8EnginePlugin} from "@salesforce/code-analyzer-eslint8-engine"

export class ESLintEnginePlugin extends EnginePluginV1 {
    private readonly delegateV8EnginePlugin: ESLint8EnginePlugin = new ESLint8EnginePlugin();

    constructor() {
        super();
    }

    getAvailableEngineNames(): string[] {
        return [ESLintEngine.NAME];
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
        const delegateV8Engine: Engine = await this.delegateV8EnginePlugin.createEngine(engineName, resolvedConfig);
        return new ESLintEngine(resolvedConfig as ESLintEngineConfig, delegateV8Engine);
    }
}

function validateEngineName(engineName: string) {
    if (engineName !== ESLintEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}
