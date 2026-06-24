import { ApexGuruService } from '../src/services/ApexGuruService';
import { ApexGuruAuthService } from '../src/services/ApexGuruAuthService';
import { ApexGuruResponseStatus } from '../src/types';

// Mock dependencies
jest.mock('../src/services/ApexGuruAuthService');
jest.mock('archiver');
jest.mock('node:fs');

const TEST_SFAP_BASE_URL = 'https://example.test/sfap';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

describe('ApexGuruService', () => {
    let apexGuruService: ApexGuruService;
    let mockEmitLogEvent: jest.Mock;
    let mockAuthService: jest.Mocked<ApexGuruAuthService>;
    let originalSfapBaseUrl: string | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        originalSfapBaseUrl = process.env.SFAP_API_BASE_URL;
        process.env.SFAP_API_BASE_URL = TEST_SFAP_BASE_URL;
        mockEmitLogEvent = jest.fn();

        mockAuthService = {
            initialize: jest.fn(),
            mintOrgJwt: jest.fn().mockResolvedValue('mock-jwt-token'),
            getConnection: jest.fn(),
            getAccessToken: jest.fn().mockReturnValue('test-token'),
            getInstanceUrl: jest.fn().mockReturnValue('https://test.salesforce.com'),
            getApiVersion: jest.fn().mockReturnValue('64.0')
        } as any;

        jest.mocked(ApexGuruAuthService).mockImplementation(() => mockAuthService);

        apexGuruService = new ApexGuruService(
            mockEmitLogEvent,
            300000,  // maxTimeoutMs
            2000,    // initialRetryMs
            60000,   // maxRetryMs
            2        // backoffMultiplier
        );
    });

    afterEach(() => {
        if (originalSfapBaseUrl === undefined) {
            delete process.env.SFAP_API_BASE_URL;
        } else {
            process.env.SFAP_API_BASE_URL = originalSfapBaseUrl;
        }
    });

    describe('initialize', () => {
        it('should initialize auth service with target org', async () => {
            await apexGuruService.initialize('myorg');

            expect(mockAuthService.initialize).toHaveBeenCalledWith({ targetOrg: 'myorg' });
            expect(mockAuthService.mintOrgJwt).toHaveBeenCalled();
        });

        it('should initialize auth service without target org', async () => {
            await apexGuruService.initialize();

            expect(mockAuthService.initialize).toHaveBeenCalledWith({ targetOrg: undefined });
            expect(mockAuthService.mintOrgJwt).toHaveBeenCalled();
        });
    });

    describe('scanWorkspace', () => {
        const mockWorkspaceRoot = '/test/workspace';
        const mockPathsToZip = ['/test/workspace'];

        beforeEach(() => {
            // Mock archiver to avoid actual zip creation
            const archiver = require('archiver');
            const mockArchive: any = {
                on: jest.fn((event: string, handler: () => void): any => {
                    if (event === 'end') {
                        // Simulate empty zip by calling handler immediately
                        setTimeout(() => handler(), 0);
                    }
                    return mockArchive;
                }),
                directory: jest.fn(),
                file: jest.fn(),
                finalize: jest.fn()
            };
            archiver.mockReturnValue(mockArchive);

            // Mock fs for zip operations
            const fs = require('node:fs');
            fs.statSync = jest.fn().mockReturnValue({
                isDirectory: () => true
            });
        });

        it('should successfully scan workspace and return violations', async () => {
            const mockViolations = [
                {
                    rule: 'SoqlInALoop',
                    message: 'SOQL in loop',
                    locations: [{ startLine: 10, file: 'classes/Test.cls' }],
                    primaryLocationIndex: 0,
                    resources: [],
                    severity: 1
                }
            ];

            const mockScanMetadata = {
                analysis_mode: 'full',
                files_scanned: 1,
                violation_breakdown: { SoqlInALoop: 1 },
                violation_count: 1,
                report_generated_ms: 1234567890
            };

            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-123',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll response - return SUCCEEDED immediately
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-123',
                    status: ApexGuruResponseStatus.SUCCEEDED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: mockScanMetadata,
                    report: Buffer.from(JSON.stringify(mockViolations)).toString('base64'),
                    reportS3Key: null,
                    message: null
                })
            } as any);

            const result = await apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            expect(result.violations).toEqual(mockViolations);
            expect(result.scanMetadata).toEqual(mockScanMetadata);
            expect(mockFetch).toHaveBeenCalledTimes(2); // submit + poll
        });

        it('should poll multiple times until success', async () => {
            const mockViolations = [
                {
                    rule: 'DmlInALoop',
                    message: 'DML in loop',
                    locations: [{ startLine: 20, file: 'classes/Controller.cls' }],
                    primaryLocationIndex: 0,
                    resources: [],
                    severity: 2
                }
            ];

            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-456',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock first poll - still RUNNING
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-456',
                    status: ApexGuruResponseStatus.RUNNING,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: null,
                    scanMetadata: null,
                    report: null,
                    reportS3Key: null,
                    message: null
                })
            } as any);

            // Mock second poll - SUCCEEDED
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-456',
                    status: ApexGuruResponseStatus.SUCCEEDED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: null,
                    report: Buffer.from(JSON.stringify(mockViolations)).toString('base64'),
                    reportS3Key: null,
                    message: null
                })
            } as any);

            const result = await apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            expect(result.violations).toEqual(mockViolations);
            expect(mockFetch).toHaveBeenCalledTimes(3); // submit + 2 polls
        });

        it('should throw error when scan fails', async () => {
            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-789',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll response - FAILED
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-789',
                    status: ApexGuruResponseStatus.FAILED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: null,
                    report: null,
                    reportS3Key: null,
                    message: 'Analysis failed due to invalid Apex syntax'
                })
            } as any);

            await expect(apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip))
                .rejects.toThrow('Scan failed');
        });

        it('should throw error when submit fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized'
            } as any);

            await expect(apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip))
                .rejects.toThrow('Failed to submit scan');
        });

        it('should throw error when poll returns HTTP error', async () => {
            // Mock successful submit
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-error',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll with HTTP error
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error'
            } as any);

            await expect(apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip))
                .rejects.toThrow('Polling failed');
        });

        it('should handle empty violation list', async () => {
            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-empty',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll response - no violations
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-empty',
                    status: ApexGuruResponseStatus.SUCCEEDED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: {
                        analysis_mode: 'full',
                        files_scanned: 1,
                        violation_breakdown: {},
                        violation_count: 0,
                        report_generated_ms: Date.now()
                    },
                    report: Buffer.from(JSON.stringify([])).toString('base64'),
                    reportS3Key: null,
                    message: null
                })
            } as any);

            const result = await apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            expect(result.violations).toEqual([]);
            expect(result.scanMetadata).toBeDefined();
        });

        it('should handle null report gracefully', async () => {
            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-null-report',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll response - null report
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-null-report',
                    status: ApexGuruResponseStatus.SUCCEEDED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: null,
                    report: null,
                    reportS3Key: null,
                    message: null
                })
            } as any);

            const result = await apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            expect(result.violations).toEqual([]);
            expect(result.scanMetadata).toBeUndefined();
        });

        it('should timeout if scan takes too long', async () => {
            jest.useFakeTimers();

            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-timeout',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll responses that never complete
            mockFetch.mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10000));
                return {
                    ok: true,
                    json: async () => ({
                        scanId: 'scan-timeout',
                        status: ApexGuruResponseStatus.RUNNING,
                        analysisMode: 'full',
                        createdMs: Date.now(),
                        updatedMs: Date.now(),
                        processingStartMs: Date.now(),
                        processingEndMs: null,
                        scanMetadata: null,
                        report: null,
                        reportS3Key: null,
                        message: null
                    })
                } as any;
            });

            const scanPromise = apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            jest.advanceTimersByTime(300000); // Advance past timeout

            await expect(scanPromise).rejects.toThrow('Workspace scan timed out after 300000ms');

            jest.useRealTimers();
        });

        it('should call progress callback during polling', async () => {
            const mockProgressCallback = jest.fn();
            apexGuruService.setProgressCallback(mockProgressCallback);

            // Mock submit response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-progress',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            // Mock poll response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-progress',
                    status: ApexGuruResponseStatus.SUCCEEDED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: null,
                    report: Buffer.from(JSON.stringify([])).toString('base64'),
                    reportS3Key: null,
                    message: null
                })
            } as any);

            await apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            expect(mockProgressCallback).toHaveBeenCalled();
            // Should report 100% when complete
            expect(mockProgressCallback).toHaveBeenCalledWith(100);
        });

        it('should use correct SFAP API endpoints', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-endpoint-check',
                    status: ApexGuruResponseStatus.QUEUED,
                    analysisMode: 'full',
                    createdMs: Date.now()
                })
            } as any);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    scanId: 'scan-endpoint-check',
                    status: ApexGuruResponseStatus.SUCCEEDED,
                    analysisMode: 'full',
                    createdMs: Date.now(),
                    updatedMs: Date.now(),
                    processingStartMs: Date.now(),
                    processingEndMs: Date.now(),
                    scanMetadata: null,
                    report: null,
                    reportS3Key: null,
                    message: null
                })
            } as any);

            await apexGuruService.scanWorkspace(mockWorkspaceRoot, mockPathsToZip);

            // Check submit endpoint
            expect(mockFetch).toHaveBeenNthCalledWith(
                1,
                `${TEST_SFAP_BASE_URL}/apex-guru/scan`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-jwt-token'
                    })
                })
            );

            // Check poll endpoint
            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                `${TEST_SFAP_BASE_URL}/apex-guru/scan/scan-endpoint-check`,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer mock-jwt-token'
                    }
                })
            );
        });
    });

    describe('setProgressCallback', () => {
        it('should set progress callback', () => {
            const callback = jest.fn();
            apexGuruService.setProgressCallback(callback);

            // Callback should be stored (we can't directly test this, but it's used in scanWorkspace)
            expect(callback).toBeDefined();
        });
    });

    describe('cleanup', () => {
        it('should cleanup resources without error', () => {
            expect(() => apexGuruService.cleanup()).not.toThrow();
        });
    });
});
