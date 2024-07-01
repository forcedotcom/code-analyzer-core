import {ESLintEnginePlugin} from "./engine";
import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new ESLintEnginePlugin();
}

// Each code analyzer engine plugin module should export its plugin (so that it can be constructed manually) and
// a createEnginePlugin function that creates the plugin (so that it can be dynamically loaded).
export { createEnginePlugin, ESLintEnginePlugin }