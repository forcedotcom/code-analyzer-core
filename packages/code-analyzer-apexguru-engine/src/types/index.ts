

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
 * SFAP ApexGuru API response statuses
 */
export enum ApexGuruResponseStatus {
    QUEUED = "QUEUED",
    RUNNING = "RUNNING",
    SUCCEEDED = "SUCCEEDED",
    FAILED = "FAILED"
}

/**
 * Response from POST https://dev.api.salesforce.com/platform/scale/v1-beta.1/apex-guru/scan
 */
export type ApexGuruSubmitResponse = {
    scanId: string;
    status: string;
    analysisMode: string;
    createdMs: number;
};

/**
 * Response from GET https://dev.api.salesforce.com/platform/scale/v1-beta.1/apex-guru/scan/{scanId}
 */
export type ApexGuruPollResponse = {
    scanId: string;
    status: string;
    analysisMode: string;
    createdMs: number;
    updatedMs: number;
    processingStartMs: number | null;
    processingEndMs: number | null;
    scanMetadata: ApexGuruScanMetadata | null;
    report: string | null;  // Base64 encoded JSON array of violations
    reportS3Key: string | null;
    message: string | null;
};

/**
 * ApexGuru violation structure from decoded report (matches SFAP API response)
 */
export type ApexGuruViolation = {
    rule: string;
    message: string;
    locations: ApexGuruLocation[];
    primaryLocationIndex: number;
    resources: string[];
    severity: number;
    suggestions?: ApexGuruSuggestion[];
    metadata?: {
        original_code: string;
        class_name: string;
        file: string;
    };
};

/**
 * Location in ApexGuru response (includes file field from SFAP)
 */
export type ApexGuruLocation = {
    startLine: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
    comment?: string;
    file?: string;  // File path from SFAP response
};

/**
 * Suggestion in ApexGuru response
 */
export type ApexGuruSuggestion = {
    location: ApexGuruLocation;
    message: string;  // Code suggestion
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
