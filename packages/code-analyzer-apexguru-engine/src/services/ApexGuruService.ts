

import { LogLevel } from '@salesforce/code-analyzer-engine-api';
import { ApexGuruAuthService } from './ApexGuruAuthService';
import {
    ApexGuruSubmitResponse,
    ApexGuruPollResponse,
    ApexGuruResponseStatus,
    ApexGuruScanMetadata,
    ApexGuruViolation
} from '../types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import archiver from 'archiver';
import FormData from 'form-data';
import fetch from 'node-fetch';

/**
 * Service for interacting with SFAP ApexGuru workspace scan APIs
 */
export class ApexGuruService {
    private readonly authService: ApexGuruAuthService;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;
    private readonly maxTimeoutMs: number;
    private readonly initialRetryMs: number;
    private readonly maxRetryMs: number;
    private readonly backoffMultiplier: number;
    private readonly sfapBaseUrl = 'https://dev.api.salesforce.com/platform/scale/v1-beta.1';
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
        await this.authService.mintOrgJwt();
    }

    /**
     * Set progress callback for polling updates
     */
    setProgressCallback(callback: (progress: number) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        // No global HTTP agent cleanup needed for fetch-based implementation
    }

    /**
     * Scan workspace Apex files and return violations with insights
     */
    async scanWorkspace(workspacePath: string): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata}> {
        this.isCancelled = false;
        let timeoutId: NodeJS.Timeout;
        const scanPromise = this.performScan(workspacePath);
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                this.isCancelled = true;
                reject(new Error(`Workspace scan timed out after ${this.maxTimeoutMs}ms`));
            }, this.maxTimeoutMs);
        });

        try {
            return await Promise.race([scanPromise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId!);
        }
    }

    /**
     * Perform the full scan workflow: create zip -> submit -> poll -> decode
     */
    private async performScan(workspacePath: string): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata}> {
        // Step 1: Create zip of workspace
        const zipBuffer = await this.createWorkspaceZip(workspacePath);

        // Step 2: Submit scan
        const { scanId } = await this.submitScan(zipBuffer);

        // Step 3: Poll for results
        const pollResponse = await this.pollForResults(scanId);

        // Step 4: Decode and return
        return this.decodeResults(pollResponse);
    }

    /**
     * Create a zip file of workspace Apex files
     */
    private async createWorkspaceZip(workspacePath: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('data', (chunk: Buffer) => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', reject);

            // Find force-app directory
            const forceAppPath = path.join(workspacePath, 'force-app');
            if (!fs.existsSync(forceAppPath)) {
                reject(new Error(`force-app directory not found at ${forceAppPath}`));
                return;
            }

            // Add all .cls and .trigger files, exclude hidden/temp files
            archive.glob('**/*.{cls,trigger}', {
                cwd: forceAppPath,
                ignore: ['**/__MACOSX/**', '**/.*', '**/.sfdx/**', '**/.DS_Store']
            }, { prefix: 'force-app' });

            archive.finalize();
        });
    }

    /**
     * Submit workspace zip to SFAP API
     */
    private async submitScan(zipBuffer: Buffer): Promise<ApexGuruSubmitResponse> {
        const orgJwt = await this.authService.mintOrgJwt();
        const url = `${this.sfapBaseUrl}/apex-guru/scan`;

        const form = new FormData();
        form.append('file', zipBuffer, { filename: 'project.zip', contentType: 'application/zip' });
        form.append('analysisModeHint', 'full');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${orgJwt}`,
                    ...form.getHeaders()
                },
                body: form
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SFAP API returned ${response.status}: ${errorText}`);
            }

            return await response.json() as ApexGuruSubmitResponse;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to submit scan: ${errorMessage}`);
        }
    }

    /**
     * Poll SFAP API for scan results with exponential backoff
     */
    private async pollForResults(scanId: string): Promise<ApexGuruPollResponse> {
        const orgJwt = await this.authService.mintOrgJwt();
        const url = `${this.sfapBaseUrl}/apex-guru/scan/${scanId}`;

        let retryMs = this.initialRetryMs;
        const startTime = Date.now();

        while (!this.isCancelled) {
            const elapsedMs = Date.now() - startTime;

            // Asymptotic progress: approaches 100% but never reaches it
            if (this.progressCallback) {
                const asymptoticProgress = Math.min(95, 100 * (1 - Math.exp(-elapsedMs / (this.maxTimeoutMs * 0.5))));
                this.progressCallback(asymptoticProgress);
            }

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${orgJwt}`
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`SFAP API returned ${response.status}: ${errorText}`);
                }

                const pollResponse: ApexGuruPollResponse = await response.json() as ApexGuruPollResponse;

                // Check status
                if (pollResponse.status === ApexGuruResponseStatus.SUCCEEDED) {
                    if (this.progressCallback) {
                        this.progressCallback(100);
                    }
                    return pollResponse;
                }

                if (pollResponse.status === ApexGuruResponseStatus.FAILED) {
                    throw new Error(`Scan failed: ${pollResponse.message ?? 'Unknown error'}`);
                }

                // Still processing (QUEUED or RUNNING), wait and retry
                await this.sleep(retryMs);
                retryMs = Math.min(retryMs * this.backoffMultiplier, this.maxRetryMs);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Polling failed: ${errorMessage}`);
            }
        }

        throw new Error('Scan was cancelled');
    }

    /**
     * Decode base64 report and parse violations
     */
    private decodeResults(pollResponse: ApexGuruPollResponse): {violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata} {
        if (!pollResponse.report) {
            return { violations: [], scanMetadata: pollResponse.scanMetadata ?? undefined };
        }

        try {
            // Decode base64 report
            const decodedReport = Buffer.from(pollResponse.report, 'base64').toString('utf-8');
            const violations: ApexGuruViolation[] = JSON.parse(decodedReport);

            return {
                violations,
                scanMetadata: pollResponse.scanMetadata ?? undefined
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to decode report: ${errorMessage}`);
        }
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
