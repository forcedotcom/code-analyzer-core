import { EnginePlugin } from "@salesforce/code-analyzer-engine-api";
import { UIBundleEnginePlugin } from "./plugin";

function createEnginePlugin(): EnginePlugin {
    return new UIBundleEnginePlugin();
}

export { createEnginePlugin, UIBundleEnginePlugin };
