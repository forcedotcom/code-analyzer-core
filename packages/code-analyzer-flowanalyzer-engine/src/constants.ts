export const ENGINE_NAME = 'flowAnalyzer';

// Opt-in tag: Core excludes rules carrying it from 'Recommended', 'all' and severity selectors.
export const FLOW_ANALYZER_OPT_IN_TAG = 'flow-analyzer';

export const FLOW_FILE_EXTENSIONS = ['.flow', '.flow-meta.xml'];

// Lowest REST API version exposing the Flow Analyzer Connect endpoints.
// Unless api_version is configured, requests use the org's version, but never anything lower than this.
export const MIN_API_VERSION = '68.0';

export const DEFAULT_RULES_PATH = '/flowbuilder/flow-analyzer/rules';

export const DEFAULT_ANALYZE_PATH = '/flowbuilder/flow-analyzer/analysis/metadata-archive';

export const DEFAULT_API_TIMEOUT_MS = 300000;

export const DEFAULT_MAX_FILE_COUNT = 100;

export const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

export const DEFAULT_MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
