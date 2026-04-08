

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
    report?: string | null;
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
