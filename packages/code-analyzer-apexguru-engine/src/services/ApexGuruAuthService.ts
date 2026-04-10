

import { AuthInfo, Connection } from '@salesforce/core';
import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { AuthConfig } from '../types';

/**
 * TEMPORARY: Hardcoded credentials for testing
 * TODO: Implement SF CLI, env vars, and OAuth in future PR
 * NEVER commit real credentials - use 'YOUR_ACCESS_TOKEN_HERE' as placeholder
 */
const HARDCODED_ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE';  // Get from: sf org display --verbose
const HARDCODED_INSTANCE_URL = 'https://yourorg.my.salesforce.com';  // e.g., https://yourorg.my.salesforce.com

/**
 * Handles authentication to Salesforce orgs for ApexGuru API access
 * TODO: Currently uses hardcoded credentials only. Implement proper auth in future PR.
 */
export class ApexGuruAuthService {
    private connection?: Connection;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(emitLogEvent: (logLevel: LogLevel, message: string) => void = () => {}) {
        this.emitLogEvent = emitLogEvent;
    }

    /**
     * Initialize connection to Salesforce org
     * TODO: Implement SF CLI, env vars, and OAuth in future PR
     * @param _config - Auth configuration (currently unused, for future implementation)
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async initialize(_config: AuthConfig): Promise<void> {
        // Use hardcoded credentials (temporary implementation)
        this.emitLogEvent(LogLevel.Warn, '⚠️  Using HARDCODED authentication credentials (for testing)');

        // Validate that credentials were actually set
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
