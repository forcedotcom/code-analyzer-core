import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {PmdEngine} from "./pmd-engine";
import {CpdEngine} from "./cpd-engine";
import {
    CPD_ENGINE_CONFIG_DESCRIPTION,
    CpdEngineConfig,
    PMD_ENGINE_CONFIG_DESCRIPTION,
    PmdEngineConfig,
    validateAndNormalizeCpdConfig,
    validateAndNormalizePmdConfig
} from "./config";
import {JavaVersionIdentifier, RuntimeJavaVersionIdentifier} from "./JavaVersionIdentifier";
import {CPD_ENGINE_NAME, PMD_ENGINE_NAME} from "./constants";

export class PmdCpdEnginesPlugin extends EnginePluginV1 {
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    constructor(javaVersionIdentifier: JavaVersionIdentifier = new RuntimeJavaVersionIdentifier()) {
        super();
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    getAvailableEngineNames(): string[] {
        return [PMD_ENGINE_NAME, CPD_ENGINE_NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        if (engineName === CPD_ENGINE_NAME) {
            return CPD_ENGINE_CONFIG_DESCRIPTION;
        } else if (engineName === PMD_ENGINE_NAME) {
            return PMD_ENGINE_CONFIG_DESCRIPTION;
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        if (engineName === CPD_ENGINE_NAME) {
            return await validateAndNormalizeCpdConfig(configValueExtractor, this.javaVersionIdentifier) as ConfigObject;
        } else if (engineName === PMD_ENGINE_NAME) {
            return await validateAndNormalizePmdConfig(configValueExtractor, this.javaVersionIdentifier) as ConfigObject;
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }

    async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName === CPD_ENGINE_NAME) {
            return new CpdEngine(engineConfig as CpdEngineConfig);
        } else if (engineName === PMD_ENGINE_NAME) {
            return new PmdEngine(engineConfig as PmdEngineConfig);
        }
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}
