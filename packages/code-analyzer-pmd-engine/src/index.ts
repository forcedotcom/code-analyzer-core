import {PmdCpdEnginesPlugin} from "./plugin";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new PmdCpdEnginesPlugin();
}

// Each code analyzer engine plugin module should export its plugin (so that it can be constructed manually) and
// a createEnginePlugin function that creates the plugin (so that it can be dynamically loaded).
export { createEnginePlugin, PmdCpdEnginesPlugin }

// Export types for AST dump functionality
export type { PmdAstDumpResults, GenerateAstOptions, PmdProcessingError } from "./pmd-wrapper"

// Export PmdEngine for direct access to generateAst() API
// NOTE: For normal engine usage, prefer accessing through PmdCpdEnginesPlugin.
// Direct instantiation is primarily for specialized use cases like AST generation tools.
export { PmdEngine } from "./pmd-engine"