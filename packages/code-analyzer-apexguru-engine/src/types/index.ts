

/**
 * Configuration for ApexGuru authentication
 */
export type AuthConfig = {
    /** SF org alias or username (e.g., 'myorg', 'user@example.com') */
    targetOrg?: string;

    /** Direct access token (for CI/CD environments) */
    accessToken?: string;

    /** Direct instance URL (for CI/CD environments) */
    instanceUrl?: string;
};

/**
 * ApexGuru API response statuses
 */
export enum ApexGuruResponseStatus {
    NEW = "new",
    PROCESSING = "processing",
    SUCCESS = "success",
    FAILED = "failed",
    ERROR = "error"
}

/**
 * Base ApexGuru API response
 */
export type ApexGuruResponse = {
    status: string;
    message?: string;
};

/**
 * Response from initial POST /apexguru/request
 */
export type ApexGuruInitialResponse = ApexGuruResponse & {
    requestId?: string;
};

/**
 * Response from GET /apexguru/request/{id}
 */
export type ApexGuruQueryResponse = ApexGuruResponse & {
    report?: string;  // Base64 encoded JSON array of violations
};

/**
 * ApexGuru violation structure (matches API response)
 */
export type ApexGuruViolation = {
    rule: string;
    message: string;
    locations: ApexGuruLocation[];
    primaryLocationIndex: number;
    resources: string[];
    severity: number;
    suggestions?: ApexGuruSuggestion[];
    fixes?: ApexGuruFix[];
    metadata?: {
        original_code: string;
        class_name: string;
        category: string;
    };
};

/**
 * Location in ApexGuru response (no file field)
 */
export type ApexGuruLocation = {
    startLine: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
    comment?: string;
};

/**
 * Suggestion in ApexGuru response
 */
export type ApexGuruSuggestion = {
    location: ApexGuruLocation;
    message: string;  // Contains "// explanation\ncode"
};

/**
 * Fix in ApexGuru response
 */
export type ApexGuruFix = {
    location: ApexGuruLocation;
    fixedCode: string;
};

/**
 * Request body for POST /apexguru/request
 */
export type ApexGuruRequestBody = {
    classContent: string;  // Base64 encoded Apex class
};

export type OrgJwtResponse = {
    jwt: string;
    message?: string | null;
};

/**
 * Scan metadata from SFAP ApexGuru API response
 * Provides insights about the analysis run
 */
export type ApexGuruScanMetadata = {
    /** Analysis mode used: 'full' or 'static' */
    analysis_mode: 'full' | 'static';

    /** Number of files scanned in this analysis */
    files_scanned: number;

    /** Breakdown of violation counts by rule name */
    violation_breakdown: { [ruleName: string]: number };

    /** Total number of violations found */
    violation_count: number;

    /** Timestamp when report was generated (milliseconds since epoch) */
    report_generated_ms: number;
};
