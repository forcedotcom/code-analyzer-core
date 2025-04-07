// This file should only contain the main exports for the package

// *** Change the Plugin Name to match your plugin's name
import { TemplateEnginePlugin } from "./plugin";
import { EnginePlugin } from "@salesforce/code-analyzer-engine-api";

function createEnginePlugin(): EnginePlugin {
    return new TemplateEnginePlugin();
}

export { createEnginePlugin, TemplateEnginePlugin }