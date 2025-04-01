import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";
import {FlowEnginePlugin} from "./plugin";

function createEnginePlugin(): EnginePlugin {
    return new FlowEnginePlugin();
}

export {createEnginePlugin, FlowEnginePlugin};