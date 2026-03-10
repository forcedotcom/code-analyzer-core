import {PmdCpdEnginesPlugin} from "./plugin";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new PmdCpdEnginesPlugin();
}

// Each code analyzer engine plugin module should export its plugin (so that it can be constructed manually) and
// a createEnginePlugin function that creates the plugin (so that it can be dynamically loaded).
export { createEnginePlugin, PmdCpdEnginesPlugin }

// Export types for AST dump functionality (types only, engines remain internal)
export type { PmdAstDumpResults, GenerateAstOptions, PmdProcessingError } from "./pmd-wrapper"