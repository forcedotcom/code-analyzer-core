

import { ConfigDescription, ConfigValueExtractor } from '@salesforce/code-analyzer-engine-api';

/**
 * Configuration for ApexGuru Engine
 * Currently minimal - authentication is handled via SF CLI
 */
export type ApexGuruEngineConfig = {
    /**
     * Maximum time to wait for ApexGuru API response (in milliseconds)
     * Default: 120000 (2 minutes)
     */
    api_timeout_ms: number;

    /**
     * Initial retry delay for polling (in milliseconds)
     * Default: 2000 (2 seconds)
     */
    api_initial_retry_ms: number;
};

/**
 * Default configuration values
 */
export const DEFAULT_APEXGURU_ENGINE_CONFIG: ApexGuruEngineConfig = {
    api_timeout_ms: 120000,      // 2 minutes
    api_initial_retry_ms: 2000   // 2 seconds
};

/**
 * Configuration schema description for ApexGuru Engine
 */
export const APEXGURU_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: 'Configuration for ApexGuru Engine. Authentication is handled via Salesforce CLI (sf org login web).',
    fieldDescriptions: {
        api_timeout_ms: {
            descriptionText: 'Maximum time to wait for ApexGuru API response (in milliseconds). Default: 120000 (2 minutes)',
            valueType: 'number',
            defaultValue: 120000
        },
        api_initial_retry_ms: {
            descriptionText: 'Initial retry delay for polling ApexGuru API (in milliseconds). Default: 2000 (2 seconds)',
            valueType: 'number',
            defaultValue: 2000
        }
    }
};

/**
 * Validates and normalizes ApexGuru engine configuration
 */
export async function validateAndNormalizeConfig(
    configValueExtractor: ConfigValueExtractor
): Promise<ApexGuruEngineConfig> {
    // Validate only expected keys are present
    configValueExtractor.validateContainsOnlySpecifiedKeys(['api_timeout_ms', 'api_initial_retry_ms']);

    // Extract and validate timeout
    const apiTimeoutMs: number = configValueExtractor.extractNumber(
        'api_timeout_ms',
        DEFAULT_APEXGURU_ENGINE_CONFIG.api_timeout_ms ?? 120000
    ) ?? 120000;

    if (apiTimeoutMs <= 0) {
        throw new Error('api_timeout_ms must be greater than 0');
    }

    // Extract and validate retry delay
    const apiInitialRetryMs: number = configValueExtractor.extractNumber(
        'api_initial_retry_ms',
        DEFAULT_APEXGURU_ENGINE_CONFIG.api_initial_retry_ms ?? 2000
    ) ?? 2000;

    if (apiInitialRetryMs <= 0) {
        throw new Error('api_initial_retry_ms must be greater than 0');
    }

    return {
        api_timeout_ms: apiTimeoutMs,
        api_initial_retry_ms: apiInitialRetryMs
    };
}
