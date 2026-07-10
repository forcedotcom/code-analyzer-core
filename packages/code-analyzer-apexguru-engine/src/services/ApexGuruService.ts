


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

const MAX_ZIP_SIZE_BYTES = 20 * 1024 * 1024;

// Identifies Code Analyzer as the caller on ApexGuru SFAP requests.
// Not sent on the /ide/auth JWT-mint call — that's a separate service.
const APEXGURU_CLIENT_HEADER = { 'x-apexguru-client': 'CodeAnalyzer' } as const;

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
    private readonly sfapBaseUrl = 'https://dev.api.salesforce.com//platform/scale/v1-beta.1';
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
     * Zip the given paths and scan them. workspaceRoot is used to compute zip-entry names so
     * the archive preserves project structure (e.g. force-app/main/default/classes/Foo.cls).
     * Each path in pathsToZip may be a file or a folder; contents are not inspected or filtered.
     */
    async scanWorkspace(workspaceRoot: string, pathsToZip: string[]): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata, analysisMode?: string}> {
        this.isCancelled = false;
        let timeoutId: NodeJS.Timeout;
        const scanPromise = this.performScan(workspaceRoot, pathsToZip);
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
    private async performScan(workspaceRoot: string, pathsToZip: string[]): Promise<{violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata, analysisMode?: string}> {
        // Step 1: Create zip of workspace
        const zipBuffer = await this.createWorkspaceZip(workspaceRoot, pathsToZip);

        if (zipBuffer.length > MAX_ZIP_SIZE_BYTES) {
            const actualMb = (zipBuffer.length / (1024 * 1024)).toFixed(2);
            const limitMb = MAX_ZIP_SIZE_BYTES / (1024 * 1024);
            throw new Error(
                `Project is too large to scan: zipped Apex sources are ${actualMb} MB, ` +
                `which exceeds the ${limitMb} MB limit. Please scan a smaller subset of the workspace.`
            );
        }

        // Step 2: Submit scan
        const submitResponse = await this.submitScan(zipBuffer);
        const { scanId } = submitResponse;

        // Step 3: Poll for results
        const pollResponse = await this.pollForResults(scanId);

        // Step 4: Decode and return
        const results = this.decodeResults(pollResponse);

        return results;
    }

    // Zip the given paths, including only Apex source files (.cls and .trigger).
    // Each path may be a file or a folder; folders are walked and filtered.
    // Entry names are computed relative to workspaceRoot so the archive mirrors the project layout.
    private async createWorkspaceZip(workspaceRoot: string, pathsToZip: string[]): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('data', (chunk: Buffer) => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', reject);

            const skipNonApex = (entry: archiver.EntryData): false | archiver.EntryData => {
                return isApexSourceFile(entry.name) ? entry : false;
            };

            for (const absPath of pathsToZip) {
                const stat = fs.statSync(absPath);
                const entryName = absPath === workspaceRoot
                    ? ''
                    : path.relative(workspaceRoot, absPath);
                if (stat.isDirectory()) {
                    archive.directory(absPath, entryName || false, skipNonApex);
                } else if (isApexSourceFile(absPath)) {
                    archive.file(absPath, { name: entryName || path.basename(absPath) });
                }
            }

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
                    ...APEXGURU_CLIENT_HEADER,
                    ...form.getHeaders()
                },
                body: form.getBuffer()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(formatHttpError(response.status, errorText));
            }

            const submitResponse = await response.json() as ApexGuruSubmitResponse;
            return submitResponse;
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
                        'Authorization': `Bearer ${orgJwt}`,
                        ...APEXGURU_CLIENT_HEADER
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(formatHttpError(response.status, errorText));
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
    private decodeResults(pollResponse: ApexGuruPollResponse): {violations: ApexGuruViolation[], scanMetadata?: ApexGuruScanMetadata, analysisMode?: string} {
        if (!pollResponse.report) {
            return {
                violations: [],
                scanMetadata: pollResponse.scanMetadata ?? undefined,
                analysisMode: pollResponse.analysisMode ?? undefined
            };
        }

        try {
            const decodedReport = Buffer.from(pollResponse.report, 'base64').toString('utf-8');
            const violations: ApexGuruViolation[] = JSON.parse(decodedReport);

            return {
                violations,
                scanMetadata: pollResponse.scanMetadata ?? undefined,
                analysisMode: pollResponse.analysisMode ?? undefined
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

/**
 * Returns true if the given path points to an Apex source file (.cls or .trigger).
 * Used to restrict the workspace zip to Apex sources only — every other file type
 * (meta-xml, objects, flows, etc.) is excluded.
 */
function isApexSourceFile(entryPath: string): boolean {
    if (!entryPath) {
        return false;
    }
    const lower = entryPath.toLowerCase();
    return lower.endsWith('.cls') || lower.endsWith('.trigger');
}

/**
 * Format a non-2xx HTTP response into a concise, single-line error message.
 * SFAP maintenance/error pages come back as HTML — strip tags and collapse whitespace
 * so the surfaced error isn't a wall of markup.
 */
function formatHttpError(status: number, body: string): string {
    const statusText = STATUS_TEXT[status] ?? 'Error';
    const detail = summarizeErrorBody(body);
    return detail
        ? `SFAP API returned ${status} ${statusText}: ${detail}`
        : `SFAP API returned ${status} ${statusText}`;
}

const STATUS_TEXT: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
};

const MAX_ERROR_DETAIL_LENGTH = 300;

/**
 * Extract a short, human-readable summary from an error response body.
 * Handles HTML (strips tags, keeps text), JSON (extracts common error fields),
 * and plain text (collapses whitespace). Truncates to keep logs readable.
 */
function summarizeErrorBody(body: string): string {
    if (!body) {
        return '';
    }
    const trimmed = body.trim();

    // Try JSON first — SFAP typically returns { message, error, detail } on structured errors
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const message = parsed.message ?? parsed.error ?? parsed.detail ?? parsed.error_description;
            if (typeof message === 'string' && message.trim()) {
                return truncate(message.trim());
            }
        } catch {
            // fall through to text/HTML handling
        }
    }

    // Strip HTML tags and script/style blocks, then collapse whitespace
    const stripped = trimmed
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();

    return truncate(stripped);
}

function truncate(text: string): string {
    return text.length > MAX_ERROR_DETAIL_LENGTH
        ? `${text.slice(0, MAX_ERROR_DETAIL_LENGTH)}…`
        : text;
}
