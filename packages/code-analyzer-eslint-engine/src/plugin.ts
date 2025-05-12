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
    private readonly forceV9: boolean; // Temporary switch to help us start testing the engine for v9 while it is still in development

    constructor(forceV9: boolean = false) {
        super();
        this.forceV9 = forceV9;
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
        if (this.shouldUseV8(resolvedConfig)) {
            return this.delegateV8EnginePlugin.createEngine(engineName, resolvedConfig);
        }
        return new ESLintEngine(resolvedConfig as ESLintEngineConfig);
    }

    private shouldUseV8(_configObj: ConfigObject): boolean {
        // Coming soon we will start using V9 with the no-user-config and flat-user-config cases, but for now
        // we just use the forceV9 switch.
        return !this.forceV9;
    }

}

function validateEngineName(engineName: string) {
    if (engineName !== ESLintEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}
