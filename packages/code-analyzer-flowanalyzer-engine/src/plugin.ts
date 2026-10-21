import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from '@salesforce/code-analyzer-engine-api';
import { FlowAnalyzerEngine } from './engine';
import { getMessage } from './messages';
import { ENGINE_NAME } from './constants';
import {
    FLOW_ANALYZER_ENGINE_CONFIG_DESCRIPTION,
    FlowAnalyzerEngineConfig,
    validateAndNormalizeConfig
} from './config';

export class FlowAnalyzerEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [ENGINE_NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return FLOW_ANALYZER_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        return await validateAndNormalizeConfig(configValueExtractor) as ConfigObject;
    }

    async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        return new FlowAnalyzerEngine(engineConfig as FlowAnalyzerEngineConfig);
    }
}

function validateEngineName(engineName: string): void {
    if (engineName !== ENGINE_NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}
