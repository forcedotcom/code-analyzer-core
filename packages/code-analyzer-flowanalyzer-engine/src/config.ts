import { ConfigDescription, ConfigValueExtractor } from '@salesforce/code-analyzer-engine-api';
import { getMessage } from './messages';
import {
    DEFAULT_ANALYZE_PATH,
    DEFAULT_API_TIMEOUT_MS,
    DEFAULT_API_VERSION,
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_MAX_FILE_COUNT,
    DEFAULT_MAX_PAYLOAD_BYTES,
    DEFAULT_RULES_PATH
} from './constants';

export type FlowAnalyzerEngineConfig = {
    target_org: string;
    api_timeout_ms: number;
    api_version: string;
    rules_path: string;
    analyze_path: string;
    max_file_count: number;
    max_file_bytes: number;
    max_payload_bytes: number;
};

export const DEFAULT_FLOW_ANALYZER_ENGINE_CONFIG: FlowAnalyzerEngineConfig = {
    target_org: '',
    api_timeout_ms: DEFAULT_API_TIMEOUT_MS,
    api_version: DEFAULT_API_VERSION,
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
            defaultValue: DEFAULT_API_VERSION
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

    const targetOrg: string | undefined = configValueExtractor.extractString('target_org');
    if (!targetOrg || targetOrg.trim().length === 0) {
        throw new Error(getMessage('MissingTargetOrg', configValueExtractor.getFieldPath('target_org')));
    }

    const apiTimeoutMs: number = configValueExtractor.extractNumber(
        'api_timeout_ms',
        DEFAULT_API_TIMEOUT_MS
    ) ?? DEFAULT_API_TIMEOUT_MS;
    if (apiTimeoutMs <= 0) {
        throw new Error(getMessage('ConfigValueMustBePositive', configValueExtractor.getFieldPath('api_timeout_ms')));
    }

    const apiVersion: string = configValueExtractor.extractString('api_version', DEFAULT_API_VERSION)
        ?? DEFAULT_API_VERSION;
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
        target_org: targetOrg.trim(),
        api_timeout_ms: apiTimeoutMs,
        api_version: apiVersion,
        rules_path: rulesPath,
        analyze_path: analyzePath,
        max_file_count: maxFileCount,
        max_file_bytes: maxFileBytes,
        max_payload_bytes: maxPayloadBytes
    };
}
