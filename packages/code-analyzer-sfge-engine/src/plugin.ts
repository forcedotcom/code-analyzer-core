import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {
    SFGE_ENGINE_CONFIG_DESCRIPTION,
    SfgeEngineConfig,
    validateAndNormalizeConfig
} from "./config";
import {getMessage} from './messages';
import {SfgeEngine} from "./engine";
import {JavaVersionIdentifier, RuntimeJavaVersionIdentifier} from "./java-version-identifier";

export class SfgeEnginePlugin extends EnginePluginV1 {
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    public constructor(javaVersionIdentifier: JavaVersionIdentifier = new RuntimeJavaVersionIdentifier()) {
        super();
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    public override getAvailableEngineNames(): string[] {
        return [SfgeEngine.NAME];
    }

    public override describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return SFGE_ENGINE_CONFIG_DESCRIPTION;
    }

    public override async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        return await validateAndNormalizeConfig(configValueExtractor, this.javaVersionIdentifier) as ConfigObject;
    }

    public override async createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new SfgeEngine(resolvedConfig as SfgeEngineConfig);
    }
}

function validateEngineName(engineName: string): void {
    if (engineName !== SfgeEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}
