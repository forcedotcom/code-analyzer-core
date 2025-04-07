// This file should only contain the main exports for the package

import { StylelintEnginePlugin } from "./plugin";
import { EnginePlugin } from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new StylelintEnginePlugin();
}

export { createEnginePlugin, StylelintEnginePlugin }