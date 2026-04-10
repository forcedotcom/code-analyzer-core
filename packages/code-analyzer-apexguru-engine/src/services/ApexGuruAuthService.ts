

import { AuthInfo, Connection, Org } from '@salesforce/core';
import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { AuthConfig } from '../types';

/**
 * TEMPORARY: Hardcoded credentials for testing
 * Set these values and set USE_HARDCODED_AUTH = true
 * NEVER commit real credentials - use 'YOUR_ACCESS_TOKEN_HERE' as placeholder
 */
const USE_HARDCODED_AUTH = false;  // Set to true for local testing only
const HARDCODED_ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE';  // Get from: sf org display --verbose
const HARDCODED_INSTANCE_URL = 'https://yourorg.my.salesforce.com';  // e.g., https://yourorg.my.salesforce.com

/**
 * Handles authentication to Salesforce orgs for ApexGuru API access
 * Uses @salesforce/core library to read credentials from SF CLI
 */
export class ApexGuruAuthService {
    private connection?: Connection;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(emitLogEvent: (logLevel: LogLevel, message: string) => void = () => {}) {
        this.emitLogEvent = emitLogEvent;
    }

    /**
     * Initialize connection to Salesforce org
     * Priority: 1) hardcoded (if enabled), 2) targetOrg, 3) direct credentials, 4) env vars
     */
    async initialize(config: AuthConfig): Promise<void> {

        // Option 0: Use hardcoded credentials (for quick testing)
        if (USE_HARDCODED_AUTH) {
            this.emitLogEvent(LogLevel.Warn, '⚠️  Using HARDCODED authentication credentials (for testing)');

            // Validate that credentials were actually set (using includes() to avoid TS literal type issues)
            if (!HARDCODED_ACCESS_TOKEN || HARDCODED_ACCESS_TOKEN.includes('YOUR_ACCESS_TOKEN')) {
                throw new Error(
                    'Hardcoded credentials not set! Edit ApexGuruAuthService.ts and set:\n' +
                    '  - HARDCODED_ACCESS_TOKEN (get from: sf org display --verbose)\n' +
                    '  - HARDCODED_INSTANCE_URL (e.g., https://yourorg.my.salesforce.com)'
                );
            }

            this.connection = await Connection.create({
                authInfo: await AuthInfo.create({
                    accessTokenOptions: {
                        accessToken: HARDCODED_ACCESS_TOKEN,
                        instanceUrl: HARDCODED_INSTANCE_URL
                    }
                })
            });
            return;
        }

        // Option 1: Use target org (or default org if targetOrg is undefined)
        if (config.targetOrg !== undefined || (!config.accessToken && !config.instanceUrl)) {
            try {

                const org = await Org.create({
                    aliasOrUsername: config.targetOrg  // undefined = use default org
                });

                this.connection = org.getConnection();
                return;
            } catch (error) {
                if (error instanceof Error && error.name === 'NamedOrgNotFound') {
                    throw new Error(
                        `Org '${config.targetOrg}' not found. Run 'sf org list' to see authenticated orgs.`
                    );
                }
                throw error;
            }
        }

        // Option 2: Direct credentials (for CI/CD or testing)
        if (config.accessToken && config.instanceUrl) {
            this.connection = await Connection.create({
                authInfo: await AuthInfo.create({
                    accessTokenOptions: {
                        accessToken: config.accessToken,
                        instanceUrl: config.instanceUrl
                    }
                })
            });
            return;
        }

        // Option 3: Environment variables (fallback)
        const envToken = process.env.SF_ACCESS_TOKEN;
        const envUrl = process.env.SF_INSTANCE_URL;

        if (envToken && envUrl) {
            this.connection = await Connection.create({
                authInfo: await AuthInfo.create({
                    accessTokenOptions: {
                        accessToken: envToken,
                        instanceUrl: envUrl
                    }
                })
            });
            return;
        }

        // No credentials found
        throw new Error(
            'No authentication credentials found. Please provide one of:\n' +
            '  1. Authenticate with SF CLI: sf org login web\n' +
            '  2. Use --target-org flag: --target-org <alias>\n' +
            '  3. Set environment variables: SF_ACCESS_TOKEN, SF_INSTANCE_URL'
        );
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
}
