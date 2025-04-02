import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from "@salesforce/code-analyzer-engine-api";
import {FlowScannerEngine} from "./engine";
import {getMessage} from './messages';
import {FLOW_SCANNER_ENGINE_CONFIG_DESCRIPTION, FlowScannerConfig, validateAndNormalizeConfig} from "./config";
import {RunTimeFlowScannerCommandWrapper} from "./python/FlowCommandWrapper";
import {PythonVersionIdentifier, RuntimePythonVersionIdentifier} from "./python/PythonVersionIdentifier";


export class FlowScannerEnginePlugin extends EnginePluginV1 {
    private readonly pythonVersionIdentifier: PythonVersionIdentifier;

    public constructor(pythonVersionIdentifier: PythonVersionIdentifier = new RuntimePythonVersionIdentifier()) {
        super();
        this.pythonVersionIdentifier = pythonVersionIdentifier;
    }

    public getAvailableEngineNames(): string[] {
        return [FlowScannerEngine.NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return FLOW_SCANNER_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        return await validateAndNormalizeConfig(configValueExtractor, this.pythonVersionIdentifier) as ConfigObject;
    }

    public async createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        const wrapper: RunTimeFlowScannerCommandWrapper = new RunTimeFlowScannerCommandWrapper((resolvedConfig as FlowScannerConfig).python_command);
        return new FlowScannerEngine(wrapper);
    }
}

function validateEngineName(engineName: string) {
    if (engineName !== FlowScannerEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}