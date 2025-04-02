import {EnginePlugin} from "@salesforce/code-analyzer-engine-api";
import {FlowScannerEnginePlugin} from "./plugin";

function createEnginePlugin(): EnginePlugin {
    return new FlowScannerEnginePlugin();
}

export {createEnginePlugin, FlowScannerEnginePlugin};