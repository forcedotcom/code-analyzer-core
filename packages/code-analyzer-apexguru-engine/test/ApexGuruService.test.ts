import { ApexGuruService } from '../src/services/ApexGuruService';
import { ApexGuruAuthService } from '../src/services/ApexGuruAuthService';
import { Connection } from '@salesforce/core';
import { ApexGuruResponseStatus } from '../src/types';

// Mock dependencies
jest.mock('../src/services/ApexGuruAuthService');

describe('ApexGuruService', () => {
    let apexGuruService: ApexGuruService;
    let mockEmitLogEvent: jest.Mock;
    let mockConnection: Partial<Connection>;
    let mockAuthService: jest.Mocked<ApexGuruAuthService>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEmitLogEvent = jest.fn();

        mockConnection = {
            instanceUrl: 'https://test.salesforce.com',
            accessToken: 'test-token',
            version: '64.0',
            request: jest.fn()
        };

        mockAuthService = {
            initialize: jest.fn(),
            getConnection: jest.fn().mockReturnValue(mockConnection),
            getAccessToken: jest.fn().mockReturnValue('test-token'),
            getInstanceUrl: jest.fn().mockReturnValue('https://test.salesforce.com'),
            getApiVersion: jest.fn().mockReturnValue('64.0'),
            mintOrgJwt: jest.fn().mockResolvedValue('mock-jwt-token'),
            curlRequest: jest.fn()
        } as any;

        jest.mocked(ApexGuruAuthService).mockImplementation(() => mockAuthService);

        apexGuruService = new ApexGuruService(
            mockEmitLogEvent,
            120000,  // maxTimeoutMs
            2000,    // initialRetryMs
            60000,   // maxRetryMs
            2        // backoffMultiplier
        );
    });

    describe('initialize', () => {
        it('should initialize auth service with target org', async () => {
            await apexGuruService.initialize('myorg');

            expect(mockAuthService.initialize).toHaveBeenCalledWith({ targetOrg: 'myorg' });
        });

        it('should initialize auth service without target org', async () => {
            await apexGuruService.initialize();

            expect(mockAuthService.initialize).toHaveBeenCalledWith({ targetOrg: undefined });
        });
    });

    describe('validate', () => {
        it('should succeed when validation returns success status', async () => {
            mockAuthService.curlRequest.mockResolvedValue({
                status: ApexGuruResponseStatus.SUCCESS
            });

            await expect(apexGuruService.validate()).resolves.toBeUndefined();

            expect(mockAuthService.curlRequest).toHaveBeenCalledWith(
                'GET',
                '/services/data/v64.0/apexguru/validate'
            );
        });

        it('should succeed for uppercase SUCCESS status', async () => {
            mockAuthService.curlRequest.mockResolvedValue({
                status: 'SUCCESS'
            });

            await expect(apexGuruService.validate()).resolves.toBeUndefined();
        });

        it('should throw error when validation fails', async () => {
            mockAuthService.curlRequest.mockResolvedValue({
                status: ApexGuruResponseStatus.FAILED
            });

            await expect(apexGuruService.validate())
                .rejects.toThrow('ApexGuru is not available for this org');
        });

        it('should throw error on network failure', async () => {
            mockAuthService.curlRequest.mockRejectedValue(new Error('Network error'));

            await expect(apexGuruService.validate())
                .rejects.toThrow('Network error');
        });

        it('should throw timeout error when validation takes too long', async () => {
            jest.useFakeTimers();

            mockAuthService.curlRequest.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({ status: ApexGuruResponseStatus.SUCCESS }), 200000))
            );

            const validatePromise = apexGuruService.validate();

            jest.advanceTimersByTime(120000);

            await expect(validatePromise).rejects.toThrow('Validate request timed out after 120000ms');

            jest.useRealTimers();
        });
    });

    describe('analyzeApexClass', () => {
        const testClassContent = 'public class Test { }';
        const testFilePath = '/test/Test.cls';

        it('should successfully analyze and return violations', async () => {
            const mockRequestId = 'req-123';
            const mockViolations = [{
                rule: 'SoqlInALoop',
                message: 'SOQL in loop',
                locations: [{ startLine: 5 }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 3
            }];

            // Mock submit response
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: mockRequestId
            });

            // Mock poll response with success
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64')
            });

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toEqual(mockViolations);
            expect(result.scanMetadata).toBeUndefined();
            expect(mockAuthService.curlRequest).toHaveBeenCalledTimes(2);
        });

        it('should return scanMetadata when API response includes it', async () => {
            const mockViolations = [{
                rule: 'SoqlInALoop',
                message: 'SOQL in loop',
                locations: [{ startLine: 5 }],
                primaryLocationIndex: 0,
                resources: [],
                severity: 3
            }];
            const mockScanMetadata = {
                analysis_mode: 'full' as const,
                files_scanned: 1,
                violation_breakdown: { SoqlInALoop: 1 },
                violation_count: 1,
                report_generated_ms: 1234567890
            };

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64'),
                scanMetadata: mockScanMetadata
            });

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toEqual(mockViolations);
            expect(result.scanMetadata).toEqual(mockScanMetadata);
        });

        it('should submit base64 encoded content', async () => {
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify([])).toString('base64')
            });

            await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            const submitCall = mockAuthService.curlRequest.mock.calls[0];
            expect(submitCall[0]).toBe('POST');
            expect(submitCall[1]).toBe('/services/data/v64.0/apexguru/request');

            const body = submitCall[2] as { classContent: string };
            expect(body.classContent).toBe(Buffer.from(testClassContent).toString('base64'));
        });

        it('should poll multiple times until success', async () => {
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            // First poll returns "new", second returns success
            mockAuthService.curlRequest
                .mockResolvedValueOnce({ status: ApexGuruResponseStatus.NEW })
                .mockResolvedValueOnce({
                    status: ApexGuruResponseStatus.SUCCESS,
                    report: Buffer.from(JSON.stringify([])).toString('base64')
                });

            await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(mockAuthService.curlRequest).toHaveBeenCalledTimes(3); // 1 submit + 2 polls
        }, 15000);

        it('should handle immediate success response', async () => {
            const mockViolations = [{ rule: 'Test', message: 'test', locations: [{ startLine: 1 }], primaryLocationIndex: 0, resources: [], severity: 1 }];

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64')
            });

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toEqual(mockViolations);
        });

        it('should throw error when analysis fails', async () => {
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.FAILED,
                message: 'Analysis failed'
            });

            await expect(apexGuruService.analyzeApexClass(testClassContent, testFilePath))
                .rejects.toThrow('ApexGuru analysis failed: Analysis failed');
        });

        it('should throw error on poll failure', async () => {
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.FAILED,
                message: 'Processing failed'
            });

            await expect(apexGuruService.analyzeApexClass(testClassContent, testFilePath))
                .rejects.toThrow('Analysis failed: Processing failed');
        });

        it('should throw error on poll error status', async () => {
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.ERROR,
                message: 'Internal error'
            });

            await expect(apexGuruService.analyzeApexClass(testClassContent, testFilePath))
                .rejects.toThrow('Analysis error: Internal error');
        });

        // Timeout test removed - difficult to test with Promise.race pattern
        // Timeout behavior is tested in integration/e2e tests

        it('should invoke progress callback during polling', async () => {
            const progressCallback = jest.fn();
            apexGuruService.setProgressCallback(progressCallback);

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest
                .mockResolvedValueOnce({ status: ApexGuruResponseStatus.NEW })
                .mockResolvedValueOnce({
                    status: ApexGuruResponseStatus.SUCCESS,
                    report: Buffer.from(JSON.stringify([])).toString('base64')
                });

            await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(progressCallback).toHaveBeenCalled();
            expect(progressCallback.mock.calls.length).toBeGreaterThan(0);
        }, 15000);

        it('should parse report correctly', async () => {
            const mockViolations = [
                {
                    rule: 'SoqlInALoop',
                    message: 'SOQL in loop',
                    locations: [{ startLine: 5 }],
                    primaryLocationIndex: 0,
                    resources: ['https://example.com'],
                    severity: 3
                },
                {
                    rule: 'DmlInALoop',
                    message: 'DML in loop',
                    locations: [{ startLine: 10 }],
                    primaryLocationIndex: 0,
                    resources: [],
                    severity: 3
                }
            ];

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64')
            });

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toHaveLength(2);
            expect(result.violations[0].rule).toBe('SoqlInALoop');
            expect(result.violations[1].rule).toBe('DmlInALoop');
        });

        it('should stop polling when timeout occurs', async () => {
            jest.useFakeTimers();

            // Mock submit response
            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            // Mock never-ending polling (keeps returning "processing")
            mockAuthService.curlRequest.mockImplementation(() =>
                new Promise(resolve => {
                    setTimeout(() => resolve({ status: ApexGuruResponseStatus.NEW }), 100);
                })
            );

            const analyzePromise = apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            // Fast-forward past the timeout
            jest.advanceTimersByTime(120000);

            await expect(analyzePromise).rejects.toThrow('Analysis timed out');

            // Verify flag remains true so background polling can detect and abort
            expect((apexGuruService as any).isCancelled).toBe(true);

            jest.useRealTimers();
        });

        it('When parseReport extracts scanMetadata from API response, then both violations and scanMetadata are returned', async () => {
            const mockViolations = [
                {
                    rule: 'SoqlInALoop',
                    message: 'SOQL in loop',
                    locations: [{ startLine: 5 }],
                    primaryLocationIndex: 0,
                    resources: ['https://example.com'],
                    severity: 3
                }
            ];

            const mockScanMetadata = {
                analysis_mode: 'full' as const,
                files_scanned: 5,
                violation_breakdown: { 'SoqlInALoop': 1 },
                violation_count: 1,
                report_generated_ms: 1234567890
            };

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            mockAuthService.curlRequest.mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64'),
                scanMetadata: mockScanMetadata
            });

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            // Test will fail until we update return type and parseReport
            expect(result).toHaveProperty('violations');
            expect(result).toHaveProperty('scanMetadata');
            expect((result as any).violations).toEqual(mockViolations);
            expect((result as any).scanMetadata).toEqual(mockScanMetadata);
        });
    });

    describe('cleanup', () => {
        it('should not throw error', () => {
            expect(() => apexGuruService.cleanup()).not.toThrow();
        });
    });
});
