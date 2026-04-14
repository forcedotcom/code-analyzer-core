

import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1
} from '@salesforce/code-analyzer-engine-api';
import { ApexGuruEngine } from './engine';
import { ENGINE_NAME } from './constants';
import {
    APEXGURU_ENGINE_CONFIG_DESCRIPTION,
    ApexGuruEngineConfig,
    validateAndNormalizeConfig
} from './config';

/**
 * Engine Plugin for ApexGuru
 * Provides factory methods to create and configure ApexGuru engine instances
 */
export class ApexGuruEnginePlugin extends EnginePluginV1 {
    /**
     * Returns the name of the engine this plugin provides
     */
    getAvailableEngineNames(): string[] {
        return [ENGINE_NAME];
    }

    /**
     * Describes the configuration schema for ApexGuru engine
     */
    describeEngineConfig(engineName: string): ConfigDescription {
        if (engineName !== ENGINE_NAME) {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }

        return APEXGURU_ENGINE_CONFIG_DESCRIPTION;
    }

    /**
     * Creates and validates engine configuration
     */
    async createEngineConfig(
        engineName: string,
        configValueExtractor: ConfigValueExtractor
    ): Promise<ConfigObject> {
        if (engineName !== ENGINE_NAME) {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }

        return await validateAndNormalizeConfig(configValueExtractor) as ConfigObject;
    }

    /**
     * Creates an instance of the ApexGuru engine
     */
    async createEngine(engineName: string, engineConfig: ConfigObject): Promise<Engine> {
        if (engineName !== ENGINE_NAME) {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }

        return new ApexGuruEngine(engineConfig as ApexGuruEngineConfig);
    }
}
