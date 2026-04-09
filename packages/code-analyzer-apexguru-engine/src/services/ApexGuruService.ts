

import { Connection } from '@salesforce/core';
import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { ApexGuruAuthService } from './ApexGuruAuthService';
import {
    ApexGuruInitialResponse,
    ApexGuruQueryResponse,
    ApexGuruResponseStatus,
    ApexGuruViolation
} from '../types';

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
     * Initialize authentication
     */
    async initialize(targetOrg?: string): Promise<void> {
        await this.authService.initialize({ targetOrg });
    }

    /**
     * Set progress callback for polling updates
     */
    setProgressCallback(callback: (progress: number) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Validate ApexGuru access
     */
    async validate(): Promise<boolean> {
        const VALIDATE_TIMEOUT_MS = 60000; // 60 seconds hardcoded timeout

        const validatePromise = this.performValidate();
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Validate request timed out after ${VALIDATE_TIMEOUT_MS}ms`)), VALIDATE_TIMEOUT_MS);
        });

        try {
            return await Promise.race([validatePromise, timeoutPromise]);
        } catch (error: any) {
            this.emitLogEvent(LogLevel.Error, `VALIDATE ERROR: ${error.message}`);
            this.emitLogEvent(LogLevel.Debug, `Error Stack: ${error.stack}`);
            return false;
        }
    }

    /**
     * Internal validate implementation (without timeout wrapper)
     */
    private async performValidate(): Promise<boolean> {
        const connection: Connection = this.authService.getConnection();
        const apiVersion = this.authService.getApiVersion();
        const url = `/services/data/v${apiVersion}/apexguru/validate`;
        const fullUrl = `${connection.instanceUrl}${url}`;

        // Debug: Log API call details (captured in CLI log file)
        this.emitLogEvent(LogLevel.Debug, '=== VALIDATE API CALL ===');
        this.emitLogEvent(LogLevel.Debug, `URL Format: GET <instance-url>/services/data/v<api-version>/apexguru/validate`);
        this.emitLogEvent(LogLevel.Debug, `URL: GET ${fullUrl}`);
        this.emitLogEvent(LogLevel.Debug, `Authorization: Bearer ${connection.accessToken?.substring(0, 20)}...`);
        this.emitLogEvent(LogLevel.Debug, `API Version: v${apiVersion}`);

        const response: any = await connection.request({
            method: 'GET',
            url
        });

        // Debug: Log response
        this.emitLogEvent(LogLevel.Debug, `Response Status: ${response.status || 'N/A'}`);
        this.emitLogEvent(LogLevel.Debug, `Response Body: ${JSON.stringify(response)}`);
        this.emitLogEvent(LogLevel.Debug, '=== END VALIDATE ===');

        if (response.status && response.status.toLowerCase() === ApexGuruResponseStatus.SUCCESS) {
            this.emitLogEvent(LogLevel.Info, 'ApexGuru access validated successfully');
            return true;
        }

        this.emitLogEvent(LogLevel.Warn, `ApexGuru validation returned status: ${response.status}`);
        return false;
    }

    /**
     * Submit Apex class for analysis and wait for results
     * Wraps submit + poll together with a single timeout (api_timeout_ms)
     */
    async analyzeApexClass(classContent: string, filePath: string): Promise<ApexGuruViolation[]> {
        const analysisPromise = this.performAnalysis(classContent, filePath);
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Analysis timed out after ${this.maxTimeoutMs}ms for file: ${filePath}`)), this.maxTimeoutMs);
        });

        return await Promise.race([analysisPromise, timeoutPromise]);
    }

    /**
     * Internal analysis implementation (without timeout wrapper)
     * Performs submit + poll
     */
    private async performAnalysis(classContent: string, filePath: string): Promise<ApexGuruViolation[]> {
        // Step 1: Submit request
        const requestId = await this.submitAnalysis(classContent, filePath);

        // Step 2: Poll for results
        const violations = await this.pollForResults(requestId, filePath);

        return violations;
    }

    /**
     * Submit Apex class for analysis
     */
    private async submitAnalysis(classContent: string, filePath: string): Promise<string> {
        const connection: Connection = this.authService.getConnection();
        const apiVersion = this.authService.getApiVersion();
        const url = `/services/data/v${apiVersion}/apexguru/request`;
        const fullUrl = `${connection.instanceUrl}${url}`;

        const base64Content = Buffer.from(classContent, 'utf-8').toString('base64');
        const requestBody = { classContent: base64Content };

        // Debug: Log API call details (captured in CLI log file)
        this.emitLogEvent(LogLevel.Debug, '=== SUBMIT ANALYSIS API CALL ===');
        this.emitLogEvent(LogLevel.Debug, `URL Format: POST <instance-url>/services/data/v<api-version>/apexguru/request`);
        this.emitLogEvent(LogLevel.Debug, `URL: POST ${fullUrl}`);
        this.emitLogEvent(LogLevel.Debug, `Authorization: Bearer ${connection.accessToken?.substring(0, 20)}...`);
        this.emitLogEvent(LogLevel.Debug, `Content-Type: application/json`);
        this.emitLogEvent(LogLevel.Info, `Submitting analysis request for: ${filePath}`);
        this.emitLogEvent(LogLevel.Debug, `Class Content Length: ${classContent.length} chars`);
        this.emitLogEvent(LogLevel.Debug, `Base64 Content Length: ${base64Content.length} chars`);

        try {
            const response: ApexGuruInitialResponse = await connection.request({
                method: 'POST',
                url,
                body: JSON.stringify(requestBody),
                headers: { 'Content-Type': 'application/json' }
            });

            // Debug: Log response
            this.emitLogEvent(LogLevel.Debug, `Response Status: ${response.status || 'N/A'}`);
            this.emitLogEvent(LogLevel.Debug, `Response RequestId: ${response.requestId || 'N/A'}`);
            this.emitLogEvent(LogLevel.Debug, `Response Body: ${JSON.stringify(response)}`);
            this.emitLogEvent(LogLevel.Debug, '=== END SUBMIT ===');

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

            // Note: requestId might not be present in some responses
            // We'll use a placeholder and poll the same endpoint
            const requestId = response.requestId || 'pending';
            this.emitLogEvent(LogLevel.Fine, `Analysis request submitted. Request ID: ${requestId}`);

            return requestId;
        } catch (error: any) {
            throw new Error(`Failed to submit analysis request: ${error.message}`);
        }
    }

    /**
     * Poll for analysis results with exponential backoff
     * Note: Timeout is handled by analyzeApexClass wrapper, not here
     */
    private async pollForResults(requestId: string, filePath: string): Promise<ApexGuruViolation[]> {
        const connection: Connection = this.authService.getConnection();
        const apiVersion = this.authService.getApiVersion();
        const url = requestId === 'pending'
            ? `/services/data/v${apiVersion}/apexguru/request`
            : `/services/data/v${apiVersion}/apexguru/request/${requestId}`;
        const fullUrl = `${connection.instanceUrl}${url}`;

        let delay = this.initialRetryMs;
        let attempts = 0;

        // Debug: Log polling setup (captured in CLI log file)
        this.emitLogEvent(LogLevel.Debug, '=== POLL FOR RESULTS ===');
        this.emitLogEvent(LogLevel.Debug, `URL Format: GET <instance-url>/services/data/v<api-version>/apexguru/request/<request-id>`);
        this.emitLogEvent(LogLevel.Debug, `URL: GET ${fullUrl}`);
        this.emitLogEvent(LogLevel.Info, `Polling for Request ID: ${requestId}`);
        this.emitLogEvent(LogLevel.Debug, `Initial Retry Delay: ${this.initialRetryMs}ms`);

        while (true) {
            if (attempts > 0) {
                // Wait before next attempt
                this.emitLogEvent(LogLevel.Debug, `Waiting ${delay}ms before next poll...`);
                await this.sleep(delay);
            }

            attempts++;

            // Emit asymptotic progress (approaches 95% but never quite reaches it)
            // Formula: 95 * (1 - e^(-attempts/4))
            // Poll 1: 21%, Poll 2: 38%, Poll 3: 53%, Poll 4: 64%, Poll 5: 73%, Poll 10: 92%
            if (this.progressCallback) {
                const asymptoticProgress = 95 * (1 - Math.exp(-attempts / 4));
                this.progressCallback(asymptoticProgress);
            }

            try {
                this.emitLogEvent(LogLevel.Debug, `--- Poll Attempt ${attempts} ---`);
                this.emitLogEvent(LogLevel.Debug, `GET ${fullUrl}`);

                const response: ApexGuruQueryResponse = await connection.request({
                    method: 'GET',
                    url
                });

                // Normalize status
                if (response.status) {
                    response.status = response.status.toLowerCase();
                }

                this.emitLogEvent(LogLevel.Debug, `Response Status: ${response.status || 'N/A'}`);
                this.emitLogEvent(LogLevel.Debug, `Has Report: ${!!response.report}`);
                if (response.report) {
                    this.emitLogEvent(LogLevel.Debug, `Report Length: ${response.report.length} chars`);
                }

                this.emitLogEvent(LogLevel.Info, `Poll attempt ${attempts}, status: ${response.status}`);

                // Check if analysis is complete
                if (response.status === ApexGuruResponseStatus.SUCCESS && response.report) {
                    this.emitLogEvent(LogLevel.Info, '✅ Analysis complete! Parsing report...');
                    this.emitLogEvent(LogLevel.Debug, '=== END POLL ===');
                    return this.parseReport(response.report, filePath);
                }

                // Check for failures
                if (response.status === ApexGuruResponseStatus.FAILED) {
                    this.emitLogEvent(LogLevel.Error, '❌ Analysis FAILED');
                    throw new Error(`Analysis failed: ${response.message || 'Unknown error'}`);
                }

                if (response.status === ApexGuruResponseStatus.ERROR) {
                    this.emitLogEvent(LogLevel.Error, '❌ Analysis ERROR');
                    throw new Error(`Analysis error: ${response.message || 'Unknown error'}`);
                }

                // Still processing, continue polling with exponential backoff
                this.emitLogEvent(LogLevel.Info, `⏳ Status: ${response.status} - Still processing...`);
                const oldDelay = delay;
                delay = Math.min(delay * this.backoffMultiplier, this.maxRetryMs);
                this.emitLogEvent(LogLevel.Debug, `Next poll delay: ${oldDelay}ms → ${delay}ms`);
            } catch (error: any) {
                this.emitLogEvent(LogLevel.Error, `❌ Poll attempt ${attempts} FAILED: ${error.message}`);
                this.emitLogEvent(LogLevel.Debug, `Error Stack: ${error.stack}`);
                throw error;
            }
        }
    }

    /**
     * Parse Base64-encoded report
     */
    private parseReport(reportBase64: string, filePath: string): ApexGuruViolation[] {
        try {
            this.emitLogEvent(LogLevel.Debug, '=== PARSING REPORT ===');
            this.emitLogEvent(LogLevel.Debug, `File: ${filePath}`);
            this.emitLogEvent(LogLevel.Debug, `Base64 Report Length: ${reportBase64.length} chars`);

            const reportJson = Buffer.from(reportBase64, 'base64').toString('utf-8');
            this.emitLogEvent(LogLevel.Debug, `Decoded JSON Length: ${reportJson.length} chars`);
            this.emitLogEvent(LogLevel.Debug, `Decoded JSON: ${reportJson.substring(0, 500)}...`);

            const violations: ApexGuruViolation[] = JSON.parse(reportJson);

            if (!Array.isArray(violations)) {
                this.emitLogEvent(LogLevel.Error, '❌ ERROR: Report is not an array');
                throw new Error('Report is not an array of violations');
            }

            this.emitLogEvent(LogLevel.Info, `✅ Parsed ${violations.length} violation(s)`);
            violations.forEach((v, i) => {
                this.emitLogEvent(LogLevel.Debug, `  Violation ${i + 1}: ${v.rule} at line ${v.locations[0]?.startLine}`);
            });
            this.emitLogEvent(LogLevel.Debug, '=== END PARSING ===');

            return violations;
        } catch (error: any) {
            this.emitLogEvent(LogLevel.Error, `❌ PARSE ERROR: ${error.message}`);
            throw new Error(`Failed to parse ApexGuru report: ${error.message}`);
        }
    }

    /**
     * Sleep utility for polling
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
