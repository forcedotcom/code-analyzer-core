

import { Connection } from '@salesforce/core';
import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { ApexGuruAuthService } from './ApexGuruAuthService';
import {
    ApexGuruInitialResponse,
    ApexGuruQueryResponse,
    ApexGuruResponseStatus,
    ApexGuruScanMetadata,
    ApexGuruViolation
} from '../types';
import * as http from 'node:http';
import * as https from 'node:https';

/**
 * Service for interacting with ApexGuru APIs
 */
export class ApexGuruService {
    private readonly authService: ApexGuruAuthService;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;
    private readonly maxTimeoutMs: number;
    private readonly initialRetryMs: number;
    private readonly maxRetryMs: number;
    private readonly backoffMultiplier: number;
    private progressCallback?: (progress: number) => void;
    private isCancelled = false;

    constructor(
        emitLogEvent: (logLevel: LogLevel, message: string) => void,
        maxTimeoutMs: number,
        initialRetryMs: number,
        maxRetryMs: number,
        backoffMultiplier: number
    ) {
        this.authService = new ApexGuruAuthService(emitLogEvent);
        this.emitLogEvent = emitLogEvent;
        this.maxTimeoutMs = maxTimeoutMs;
        this.initialRetryMs = initialRetryMs;
        this.maxRetryMs = maxRetryMs;
        this.backoffMultiplier = backoffMultiplier;
    }

    /**
     * Initialize authentication and mint Org JWT
     */
    async initialize(targetOrg?: string): Promise<void> {
        // Initialize auth service with SF CLI
        await this.authService.initialize({ targetOrg });

        // Mint Org JWT for SFAP API access
        const orgJwt = await this.authService.mintOrgJwt();

        try {
            const jwtParts = orgJwt.split('.');
            if (jwtParts.length === 3) {
                //const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
            }
        } catch (error) {
            this.emitLogEvent(LogLevel.Warn, `Could not decode JWT payload: ${error}`);
        }
    }

    /**
     * Set progress callback for polling updates
     */
    setProgressCallback(callback: (progress: number) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Cleanup resources - force close all HTTP connections
     * This is critical to allow the Node.js process to exit, especially when timeouts occur
     * and underlying HTTP requests are still pending
     */
    cleanup(): void {
        try {
            // TODO: This destroys process-wide HTTP agents, which could interfere with
            // concurrent HTTP work in the Code Analyzer process. We should investigate
            // using custom agents specific to ApexGuru's Connection and destroy only
            // those agents instead of the global ones. For now, this approach works
            // because Node.js automatically recreates destroyed agents when needed.
            // To be addressed in a future PR.
            http.globalAgent.destroy();
            https.globalAgent.destroy();
        } catch {
            // Ignore cleanup errors - best effort
        }
    }

    /**
     * Validate ApexGuru access
     * Throws error with specific context if validation fails
     */
    async validate(): Promise<void> {
        let timeoutId: NodeJS.Timeout;
        const validatePromise = this.performValidate();
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Validate request timed out after ${this.maxTimeoutMs}ms`)), this.maxTimeoutMs);
        });

        try {
            await Promise.race([validatePromise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId!);
        }
    }

    /**
     * Internal validate implementation (without timeout wrapper)
     */
    private async performValidate(): Promise<void> {
        const apiVersion = this.authService.getApiVersion();
        const url = `/services/data/v${apiVersion}/apexguru/validate`;

        const response: { status?: string } = await (this.authService as any).curlRequest('GET', url);

        if (response.status && response.status.toLowerCase() === ApexGuruResponseStatus.SUCCESS) {
            return;
        }

        throw new Error(
            `ApexGuru is not available for this org (status: ${response.status ?? 'unknown'}).\n` +
            'Please check that ApexGuru is enabled and you have the required permissions.'
        );
    }

    /**
     * Submit Apex class for analysis and wait for results
     * Wraps submit + poll together with a single timeout (api_timeout_ms)
     */
    async analyzeApexClass(classContent: string, filePath: string): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata}> {
        this.isCancelled = false;
        let timeoutId: NodeJS.Timeout;
        const analysisPromise = this.performAnalysis(classContent);
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                this.isCancelled = true;
                reject(new Error(`Analysis timed out after ${this.maxTimeoutMs}ms for file: ${filePath}`));
            }, this.maxTimeoutMs);
        });

        try {
            return await Promise.race([analysisPromise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId!);
        }
    }

    /**
     * Internal analysis implementation (without timeout wrapper)
     * Performs submit + poll
     */
    private async performAnalysis(classContent: string): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata}> {
        // Step 1: Submit request
        const requestId = await this.submitAnalysis(classContent);

        // Step 2: Poll for results
        return await this.pollForResults(requestId);
    }

    /**
     * Submit Apex class for analysis
     */
    private async submitAnalysis(classContent: string): Promise<string> {
        const connection: Connection = this.authService.getConnection();
        const apiVersion = this.authService.getApiVersion();
        const url = `/services/data/v${apiVersion}/apexguru/request`;

        const base64Content = Buffer.from(classContent, 'utf-8').toString('base64');
        const requestBody = { classContent: base64Content };

        try {
            const response: ApexGuruInitialResponse = await connection.request({
                method: 'POST',
                url,
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            // Normalize status to lowercase
            if (response.status) {
                response.status = response.status.toLowerCase();
            }

            if (response.status === ApexGuruResponseStatus.FAILED) {
                throw new Error(`ApexGuru analysis failed: ${response.message || 'Unknown error'}`);
            }

            if (response.status !== ApexGuruResponseStatus.NEW && response.status !== ApexGuruResponseStatus.SUCCESS) {
                throw new Error(`Unexpected response status: ${response.status}`);
            }

            return response.requestId || 'pending';
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to submit analysis request: ${message}`);
        }
    }

    /**
     * Poll for analysis results with exponential backoff
     * Note: Timeout is handled by analyzeApexClass wrapper, not here
     */
    private async pollForResults(requestId: string): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata}> {
        const connection: Connection = this.authService.getConnection();
        const apiVersion = this.authService.getApiVersion();
        const url = requestId === 'pending'
            ? `/services/data/v${apiVersion}/apexguru/request`
            : `/services/data/v${apiVersion}/apexguru/request/${requestId}`;

        let delay = this.initialRetryMs;
        let attempts = 0;

        while (true) {
            if (this.isCancelled) {
                throw new Error('Analysis cancelled due to timeout');
            }

            if (attempts > 0) {
                await this.sleep(delay);
            }

            attempts++;

            // Emit asymptotic progress (approaches 95% but never quite reaches it)
            // Formula: 95 * (1 - e^(-attempts/4))
            if (this.progressCallback) {
                const asymptoticProgress = 95 * (1 - Math.exp(-attempts / 4));
                this.progressCallback(asymptoticProgress);
            }

            const response: ApexGuruQueryResponse = await connection.request({
                method: 'GET',
                url
            });

            // Normalize status
            if (response.status) {
                response.status = response.status.toLowerCase();
            }

            // Check if analysis is complete
            if (response.status === ApexGuruResponseStatus.SUCCESS && response.report) {
                const violations = this.parseReport(response.report);
                return { violations, scanMetadata: response.scanMetadata };
            }

            // Check for failures
            if (response.status === ApexGuruResponseStatus.FAILED) {
                throw new Error(`Analysis failed: ${response.message || 'Unknown error'}`);
            }

            if (response.status === ApexGuruResponseStatus.ERROR) {
                throw new Error(`Analysis error: ${response.message || 'Unknown error'}`);
            }

            // Still processing, continue polling with exponential backoff
            delay = Math.min(delay * this.backoffMultiplier, this.maxRetryMs);
        }
    }

    /**
     * Parse Base64-encoded report
     */
    private parseReport(reportBase64: string): ApexGuruViolation[] {
        try {
            const reportJson = Buffer.from(reportBase64, 'base64').toString('utf-8');
            const violations: ApexGuruViolation[] = JSON.parse(reportJson);

            if (!Array.isArray(violations)) {
                throw new Error('Report is not an array of violations');
            }

            return violations;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse ApexGuru report: ${message}`);
        }
    }

    /**
     * Sleep utility for polling
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
