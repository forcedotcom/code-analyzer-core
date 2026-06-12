import { Connection, Org } from '@salesforce/core';
import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { AuthConfig, OrgJwtResponse } from '../types';

/**
 * Handles authentication to Salesforce orgs for ApexGuru API access.
 */
export class ApexGuruAuthService {
    // Configuration constants
    private static readonly DEFAULT_FEATURE_ID = 'CodeAnalyzer';
    private static readonly ORG_JWT_ENDPOINT_PATH = '/ide/auth';

    private connection?: Connection;
    private orgJwt?: string;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(emitLogEvent: (logLevel: LogLevel, message: string) => void = () => {}) {
        this.emitLogEvent = emitLogEvent;
    }

    /**
     * Initialize connection to Salesforce org using one of two methods:
     *
     * Method 1: SF CLI org with --target-org flag
     *   config.targetOrg = 'myorg' or 'user@example.com'
     *
     * Method 2: SF CLI default org (fallback)
     *   No config provided - uses SF CLI default org
     *
     * @param config - Auth configuration
     */
    async initialize(config: AuthConfig): Promise<void> {
        // Method 1: SF CLI org (alias or username) via --target-org flag
        if (config.targetOrg) {
            this.emitLogEvent(LogLevel.Fine, `Authenticating with org: ${config.targetOrg}`);
            try {
                const org = await Org.create({ aliasOrUsername: config.targetOrg });
                this.connection = org.getConnection();
                this.emitLogEvent(LogLevel.Fine, `Successfully authenticated to org`);
                return;
            } catch {
                this.emitLogEvent(LogLevel.Error, `Failed to authenticate with org: ${config.targetOrg}`);
                throw new Error(
                    `Failed to authenticate with org '${config.targetOrg}'. ` +
                    'Please verify the org alias/username and ensure you are authenticated:\n' +
                    '  sf org list\n' +
                    '  sf org login web'
                );
            }
        }

        // Method 2: SF CLI default org (fallback)
        this.emitLogEvent(LogLevel.Fine, 'No target org specified, using default org');
        try {
            const org = await Org.create({});
            this.connection = org.getConnection();
            this.emitLogEvent(LogLevel.Fine, 'Successfully authenticated to default org');
        } catch {
            this.emitLogEvent(LogLevel.Error, 'Failed to authenticate: No default org found');
            throw new Error(
                'No default org found. Please either:\n' +
                '  1. Set a default org: sf config set target-org <org-alias>\n' +
                '  2. Pass --target-org flag: sf code-analyzer run --target-org <org-alias> ...\n' +
                '  3. Authenticate to an org: sf org login web'
            );
        }
    }

    /**
     * Get the connection object (has access token and instance URL built-in)
     */
    getConnection(): Connection {
        if (!this.connection) {
            throw new Error('Auth service not initialized. Call initialize() first.');
        }
        return this.connection;
    }

    /**
     * Get access token directly (for debugging or direct API calls)
     */
    getAccessToken(): string {
        const token = this.getConnection().accessToken;
        if (!token) {
            throw new Error('Access token not available');
        }
        return token;
    }

    /**
     * Get instance URL (for debugging or direct API calls)
     */
    getInstanceUrl(): string {
        return this.getConnection().instanceUrl;
    }

    /**
     * Get API version from connection
     */
    getApiVersion(): string {
        return this.getConnection().version || '64.0';
    }

    /**
     * Helper method to perform fetch with logging
     * @param endpoint - The endpoint URL
     * @param logMessage - Log message to emit before fetch
     * @param options - Fetch options
     * @returns Promise<Response> - The fetch response
     */
    private async fetchWithLogging(
        endpoint: string,
        logMessage: string,
        options: RequestInit
    ): Promise<Response> {
        this.emitLogEvent(LogLevel.Fine, logMessage);
        return await fetch(endpoint, options);
    }

    /**
     * Mint an Org JWT token for SFAP API access
     *
     * @param featureId - Feature ID for tracking (default: CodeAnalyzer)
     * @returns Promise<string> - The Org JWT token
     * @throws Error if minting fails
     */
    async mintOrgJwt(featureId: string = ApexGuruAuthService.DEFAULT_FEATURE_ID): Promise<string> {
        const accessToken = this.getAccessToken();
        const instanceUrl = this.getInstanceUrl();
        const endpoint = `${instanceUrl}${ApexGuruAuthService.ORG_JWT_ENDPOINT_PATH}`;

        const response = await this.fetchWithLogging(
            endpoint,
            'Minting Org JWT for SFAP API access',
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Feature-Id': featureId,
                    'Content-Type': 'application/json'
                }
            }
        );

        try {

            if (!response.ok) {
                const errorText = await response.text();
                this.emitLogEvent(LogLevel.Error, `Failed to mint Org JWT: HTTP ${response.status}`);
                throw new Error(
                    `Failed to mint Org JWT: ${response.status} ${response.statusText}. ` +
                    `Response: ${errorText}`
                );
            }

            const data = await response.json() as OrgJwtResponse;

            if (!data.jwt) {
                this.emitLogEvent(LogLevel.Error, 'Org JWT response missing jwt field');
                throw new Error('Org JWT response missing jwt field');
            }

            this.orgJwt = data.jwt;
            this.emitLogEvent(LogLevel.Fine, 'Successfully minted Org JWT');
            return data.jwt;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emitLogEvent(LogLevel.Error, 'Org JWT minting failed');
            throw new Error(`Org JWT minting failed: ${errorMessage}`);
        }
    }

    /**
     * Get the cached Org JWT token
     * @returns The Org JWT if available, undefined otherwise
     */
    getOrgJwt(): string | undefined {
        return this.orgJwt;
    }

    /**
     * Get or mint the Org JWT token
     * If already minted, returns the cached token. Otherwise, mints a new one.
     * @returns Promise<string> - The Org JWT token
     */
    async getOrMintOrgJwt(): Promise<string> {
        if (this.orgJwt) {
            return this.orgJwt;
        }
        return await this.mintOrgJwt();
    }

    /**
     * Perform HTTP request using fetch with Authorization Bearer token
     * @param method - HTTP method (GET, POST, etc.)
     * @param path - API path (e.g., '/services/data/v64.0/apexguru/validate')
     * @param body - Optional request body
     * @returns Promise<T> - Parsed JSON response
     * @throws Error if request fails or returns non-200 status
     */
    private async curlRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
        try {
            const url = `${this.getInstanceUrl()}${path}`;
            const accessToken = this.getAccessToken();

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `HTTP ${response.status} ${response.statusText} at ${path}: ${errorText}`
                );
            }

            return await response.json() as T;
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('HTTP ')) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Request failed for ${path}: ${errorMessage}`);
        }
    }
}
