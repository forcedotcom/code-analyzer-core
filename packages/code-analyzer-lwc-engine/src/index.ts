import { EnginePlugin } from "@salesforce/code-analyzer-engine-api";
import { LwcEnginePlugin } from "./plugin";

function createEnginePlugin(): EnginePlugin {
    return new LwcEnginePlugin();
}

export { createEnginePlugin, LwcEnginePlugin };
