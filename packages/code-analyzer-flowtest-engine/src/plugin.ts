import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "./engine";
import {getMessage} from './messages';
import {FLOWTEST_ENGINE_CONFIG_DESCRIPTION, FlowTestConfig, validateAndNormalizeConfig} from "./config";
import {PythonVersionIdentifier, RuntimePythonVersionIdentifier} from "./PythonVersionIdentifier";


export class FlowTestEnginePlugin extends EnginePluginV1 {
    private readonly pythonVersionIdentifier: PythonVersionIdentifier;

    public constructor(pythonVersionIdentifier: PythonVersionIdentifier = new RuntimePythonVersionIdentifier()) {
        super();
        this.pythonVersionIdentifier = pythonVersionIdentifier;
    }

    public getAvailableEngineNames(): string[] {
        return [FlowTestEngine.NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return FLOWTEST_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        return await validateAndNormalizeConfig(configValueExtractor, this.pythonVersionIdentifier) as ConfigObject;
    }

    public async createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new FlowTestEngine(resolvedConfig as FlowTestConfig);
    }
}

function validateEngineName(engineName: string) {
    if (engineName !== FlowTestEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}