

import { EnginePlugin } from '@salesforce/code-analyzer-engine-api';
import { ApexGuruEnginePlugin } from './plugin';

/**
 * Factory function to create the ApexGuru engine plugin
 * This is the entry point for dynamic loading by Code Analyzer
 */
function createEnginePlugin(): EnginePlugin {
    return new ApexGuruEnginePlugin();
}

// Export plugin factory and plugin class
export { createEnginePlugin, ApexGuruEnginePlugin };

// Export engine and supporting classes for direct usage
export { ApexGuruEngine } from './engine';
export { ApexGuruService } from './services/ApexGuruService';
export * from './types';
