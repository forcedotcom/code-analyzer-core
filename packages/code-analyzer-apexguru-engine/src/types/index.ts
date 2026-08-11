

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
 * Response from the SFAP ApexGuru scan-submit endpoint.
 */
export type ApexGuruSubmitResponse = {
    scanId: string;
    status: string;
    analysisMode: string;
    createdMs: number;
};

/**
 * Response from the SFAP ApexGuru scan-status polling endpoint.
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

/**
 * Response from the ApexGuru org-resolve endpoint
 * (POST /services/data/v{version}/apexguru/org/resolve).
 * Resolves the caller's org to its production org, whose id is
 * forwarded as the `productionOrgId` multipart form field on the SFAP scan submit call.
 */
export type ApexGuruOrgResolveResponse = {
    fullCopySandboxOrgIds: string[];
    inputOrgId: string;
    message: string | null;
    productionOrgId: string;
    status: string;
};

/**
 * Response from the Org JWT minting endpoint (POST /ide/auth)
 * Used to authenticate against the SFAP ApexGuru API
 */
export type OrgJwtResponse = {
    /** The minted Org JWT token */
    jwt: string;

    /** Optional message from the auth endpoint (e.g., error details) */
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
