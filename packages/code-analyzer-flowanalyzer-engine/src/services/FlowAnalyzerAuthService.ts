import { Connection, Org } from '@salesforce/core';
import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { getMessage } from '../messages';
import { AuthConfig } from '../types';

export class FlowAnalyzerAuthService {
    private connection?: Connection;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(emitLogEvent: (logLevel: LogLevel, message: string) => void = () => {}) {
        this.emitLogEvent = emitLogEvent;
    }

    async initialize(config: AuthConfig): Promise<void> {
        this.emitLogEvent(LogLevel.Fine, `Authenticating with org: ${config.targetOrg}`);
        try {
            const org = await Org.create({ aliasOrUsername: config.targetOrg });
            this.connection = org.getConnection();
            this.emitLogEvent(LogLevel.Fine, 'Successfully authenticated to org');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.emitLogEvent(LogLevel.Fine, `Failed to authenticate with org '${config.targetOrg}': ${errorMessage}`);
            throw new Error(getMessage('OrgNotFound', config.targetOrg, config.targetOrg));
        }
    }

    getConnection(): Connection {
        if (!this.connection) {
            throw new Error(getMessage('AuthNotInitialized'));
        }
        return this.connection;
    }

    getAccessToken(): string {
        const token = this.getConnection().accessToken;
        if (!token) {
            throw new Error(getMessage('AccessTokenUnavailable'));
        }
        return token;
    }

    /**
     * The cached access token may be expired even though the org is still authorized (the refresh token is valid).
     * Since requests are made with raw fetch, jsforce's auto-refresh never kicks in, so refresh explicitly.
     */
    async refreshAccessToken(): Promise<void> {
        this.emitLogEvent(LogLevel.Fine, 'Refreshing org access token');
        await this.getConnection().refreshAuth();
    }

    getInstanceUrl(): string {
        return this.getConnection().instanceUrl;
    }

    getApiVersion(): string {
        return this.getConnection().version || '64.0';
    }
}
