import { EnginePlugin } from '@salesforce/code-analyzer-engine-api';
import { FlowAnalyzerEnginePlugin } from './plugin';

function createEnginePlugin(): EnginePlugin {
    return new FlowAnalyzerEnginePlugin();
}

export { createEnginePlugin, FlowAnalyzerEnginePlugin };
