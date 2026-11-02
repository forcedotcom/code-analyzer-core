import { ConfigDescription, ConfigValueExtractor } from '@salesforce/code-analyzer-engine-api';
import { getMessage } from './messages';
import {
    DEFAULT_ANALYZE_PATH,
    DEFAULT_API_TIMEOUT_MS,
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_MAX_FILE_COUNT,
    DEFAULT_MAX_PAYLOAD_BYTES,
    DEFAULT_RULES_PATH
} from './constants';

export type FlowAnalyzerEngineConfig = {
    // Optional: when absent the engine is inactive (offers no rules) so scans without --target-org are unaffected.
    target_org?: string;
    api_timeout_ms: number;
    // Optional: when absent, requests use the org's API version (but at least MIN_API_VERSION).
    api_version?: string;
    rules_path: string;
    analyze_path: string;
    max_file_count: number;
    max_file_bytes: number;
    max_payload_bytes: number;
};

export const DEFAULT_FLOW_ANALYZER_ENGINE_CONFIG: FlowAnalyzerEngineConfig = {
    api_timeout_ms: DEFAULT_API_TIMEOUT_MS,
    rules_path: DEFAULT_RULES_PATH,
    analyze_path: DEFAULT_ANALYZE_PATH,
    max_file_count: DEFAULT_MAX_FILE_COUNT,
    max_file_bytes: DEFAULT_MAX_FILE_BYTES,
    max_payload_bytes: DEFAULT_MAX_PAYLOAD_BYTES
};

export const FLOW_ANALYZER_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        target_org: {
            descriptionText: getMessage('ConfigFieldDescription_target_org'),
            valueType: 'string',
            defaultValue: null
        },
        api_timeout_ms: {
            descriptionText: getMessage('ConfigFieldDescription_api_timeout_ms'),
            valueType: 'number',
            defaultValue: DEFAULT_API_TIMEOUT_MS
        },
        api_version: {
            descriptionText: getMessage('ConfigFieldDescription_api_version'),
            valueType: 'string',
            defaultValue: null
        },
        rules_path: {
            descriptionText: getMessage('ConfigFieldDescription_rules_path'),
            valueType: 'string',
            defaultValue: DEFAULT_RULES_PATH
        },
        analyze_path: {
            descriptionText: getMessage('ConfigFieldDescription_analyze_path'),
            valueType: 'string',
            defaultValue: DEFAULT_ANALYZE_PATH
        },
        max_file_count: {
            descriptionText: getMessage('ConfigFieldDescription_max_file_count'),
            valueType: 'number',
            defaultValue: DEFAULT_MAX_FILE_COUNT
        },
        max_file_bytes: {
            descriptionText: getMessage('ConfigFieldDescription_max_file_bytes'),
            valueType: 'number',
            defaultValue: DEFAULT_MAX_FILE_BYTES
        },
        max_payload_bytes: {
            descriptionText: getMessage('ConfigFieldDescription_max_payload_bytes'),
            valueType: 'number',
            defaultValue: DEFAULT_MAX_PAYLOAD_BYTES
        }
    }
};

export async function validateAndNormalizeConfig(
    configValueExtractor: ConfigValueExtractor
): Promise<FlowAnalyzerEngineConfig> {
    configValueExtractor.validateContainsOnlySpecifiedKeys([
        'target_org',
        'api_timeout_ms',
        'api_version',
        'rules_path',
        'analyze_path',
        'max_file_count',
        'max_file_bytes',
        'max_payload_bytes'
    ]);

    const targetOrg: string | undefined = configValueExtractor.extractString('target_org')?.trim() || undefined;

    const apiTimeoutMs: number = configValueExtractor.extractNumber(
        'api_timeout_ms',
        DEFAULT_API_TIMEOUT_MS
    ) ?? DEFAULT_API_TIMEOUT_MS;
    if (apiTimeoutMs <= 0) {
        throw new Error(getMessage('ConfigValueMustBePositive', configValueExtractor.getFieldPath('api_timeout_ms')));
    }

    const apiVersion: string | undefined = configValueExtractor.extractString('api_version')?.trim() || undefined;
    if (apiVersion !== undefined && !/^\d+\.0$/.test(apiVersion)) {
        throw new Error(getMessage('InvalidApiVersion', configValueExtractor.getFieldPath('api_version'), apiVersion));
    }
    const rulesPath: string = configValueExtractor.extractString('rules_path', DEFAULT_RULES_PATH)
        ?? DEFAULT_RULES_PATH;
    const analyzePath: string = configValueExtractor.extractString('analyze_path', DEFAULT_ANALYZE_PATH)
        ?? DEFAULT_ANALYZE_PATH;

    const maxFileCount: number = configValueExtractor.extractNumber(
        'max_file_count',
        DEFAULT_MAX_FILE_COUNT
    ) ?? DEFAULT_MAX_FILE_COUNT;
    if (maxFileCount <= 0) {
        throw new Error(getMessage('ConfigValueMustBePositive', configValueExtractor.getFieldPath('max_file_count')));
    }

    const maxFileBytes: number = configValueExtractor.extractNumber(
        'max_file_bytes',
        DEFAULT_MAX_FILE_BYTES
    ) ?? DEFAULT_MAX_FILE_BYTES;
    if (maxFileBytes <= 0) {
        throw new Error(getMessage('ConfigValueMustBePositive', configValueExtractor.getFieldPath('max_file_bytes')));
    }

    const maxPayloadBytes: number = configValueExtractor.extractNumber(
        'max_payload_bytes',
        DEFAULT_MAX_PAYLOAD_BYTES
    ) ?? DEFAULT_MAX_PAYLOAD_BYTES;
    if (maxPayloadBytes <= 0) {
        throw new Error(getMessage('ConfigValueMustBePositive', configValueExtractor.getFieldPath('max_payload_bytes')));
    }

    return {
        target_org: targetOrg,
        api_timeout_ms: apiTimeoutMs,
        api_version: apiVersion,
        rules_path: rulesPath,
        analyze_path: analyzePath,
        max_file_count: maxFileCount,
        max_file_bytes: maxFileBytes,
        max_payload_bytes: maxPayloadBytes
    };
}
