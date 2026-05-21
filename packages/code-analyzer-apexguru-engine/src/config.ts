import { ConfigDescription, ConfigValueExtractor } from '@salesforce/code-analyzer-engine-api';

/**
 * Configuration for ApexGuru Engine
 * Currently minimal - authentication is handled via SF CLI
 */
export type ApexGuruEngineConfig = {
    /**
     * Target Salesforce org username or alias
     * If not specified, uses the default SF CLI org
     */
    target_org?: string;

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

    /**
     * Maximum retry delay for polling (in milliseconds)
     * Exponential backoff will not exceed this value
     * Default: 60000 (60 seconds)
     */
    api_max_retry_ms: number;

    /**
     * Backoff multiplier for exponential backoff polling
     * Each retry delay is multiplied by this value (e.g., 2x = 2s, 4s, 8s, 16s...)
     * Default: 2
     */
    api_backoff_multiplier: number;
};

/**
 * Default configuration values
 */
export const DEFAULT_APEXGURU_ENGINE_CONFIG: ApexGuruEngineConfig = {
    api_timeout_ms: 120000,         // 2 minutes
    api_initial_retry_ms: 2000,     // 2 seconds
    api_max_retry_ms: 60000,        // 60 seconds
    api_backoff_multiplier: 2       // 2x exponential backoff
};

/**
 * Configuration schema description for ApexGuru Engine
 */
export const APEXGURU_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: 'Configuration for ApexGuru Engine. Authentication is handled via Salesforce CLI (sf org login web). Use --target-org flag to specify the org.',
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
        },
        api_max_retry_ms: {
            descriptionText: 'Maximum retry delay for polling (in milliseconds). Exponential backoff will not exceed this value. Default: 60000 (60 seconds)',
            valueType: 'number',
            defaultValue: 60000
        },
        api_backoff_multiplier: {
            descriptionText: 'Backoff multiplier for exponential backoff polling. Each retry delay is multiplied by this value. Default: 2',
            valueType: 'number',
            defaultValue: 2
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
    configValueExtractor.validateContainsOnlySpecifiedKeys([
        'api_timeout_ms',
        'api_initial_retry_ms',
        'api_max_retry_ms',
        'api_backoff_multiplier'
    ]);

    // Extract target org from CLI flag only
    // - If user passes --target-org: use that org
    // - If user doesn't pass --target-org: undefined (auth service uses default SF CLI org)
    const targetOrg: string | undefined = process.env.CODE_ANALYZER_TARGET_ORG;

    // Extract and validate timeout
    const apiTimeoutMs: number = configValueExtractor.extractNumber(
        'api_timeout_ms',
        DEFAULT_APEXGURU_ENGINE_CONFIG.api_timeout_ms
    ) ?? DEFAULT_APEXGURU_ENGINE_CONFIG.api_timeout_ms;

    if (apiTimeoutMs <= 0) {
        throw new Error('api_timeout_ms must be greater than 0');
    }

    // Extract and validate initial retry delay
    const apiInitialRetryMs: number = configValueExtractor.extractNumber(
        'api_initial_retry_ms',
        DEFAULT_APEXGURU_ENGINE_CONFIG.api_initial_retry_ms
    ) ?? DEFAULT_APEXGURU_ENGINE_CONFIG.api_initial_retry_ms;

    if (apiInitialRetryMs <= 0) {
        throw new Error('api_initial_retry_ms must be greater than 0');
    }

    // Extract and validate max retry delay
    const apiMaxRetryMs: number = configValueExtractor.extractNumber(
        'api_max_retry_ms',
        DEFAULT_APEXGURU_ENGINE_CONFIG.api_max_retry_ms
    ) ?? DEFAULT_APEXGURU_ENGINE_CONFIG.api_max_retry_ms;

    if (apiMaxRetryMs <= 0) {
        throw new Error('api_max_retry_ms must be greater than 0');
    }

    if (apiMaxRetryMs < apiInitialRetryMs) {
        throw new Error('api_max_retry_ms must be greater than or equal to api_initial_retry_ms');
    }

    // Extract and validate backoff multiplier
    const apiBackoffMultiplier: number = configValueExtractor.extractNumber(
        'api_backoff_multiplier',
        DEFAULT_APEXGURU_ENGINE_CONFIG.api_backoff_multiplier
    ) ?? DEFAULT_APEXGURU_ENGINE_CONFIG.api_backoff_multiplier;

    if (apiBackoffMultiplier < 1) {
        throw new Error('api_backoff_multiplier must be greater than or equal to 1');
    }

    return {
        target_org: targetOrg,
        api_timeout_ms: apiTimeoutMs,
        api_initial_retry_ms: apiInitialRetryMs,
        api_max_retry_ms: apiMaxRetryMs,
        api_backoff_multiplier: apiBackoffMultiplier
    };
}
