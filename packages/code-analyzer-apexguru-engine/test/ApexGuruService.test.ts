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
            mintOrgJwt: jest.fn().mockResolvedValue('mock-jwt-token')
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
            (mockConnection.request as jest.Mock).mockResolvedValue({
                status: ApexGuruResponseStatus.SUCCESS
            });

            await expect(apexGuruService.validate()).resolves.toBeUndefined();

            expect(mockConnection.request).toHaveBeenCalledWith({
                method: 'GET',
                url: '/services/data/v64.0/apexguru/validate'
            });
        });

        it('should succeed for uppercase SUCCESS status', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValue({
                status: 'SUCCESS'
            });

            await expect(apexGuruService.validate()).resolves.toBeUndefined();
        });

        it('should throw error when validation fails', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValue({
                status: ApexGuruResponseStatus.FAILED
            });

            await expect(apexGuruService.validate())
                .rejects.toThrow('ApexGuru is not available for this org');
        });

        it('should throw error on network failure', async () => {
            (mockConnection.request as jest.Mock).mockRejectedValue(new Error('Network error'));

            await expect(apexGuruService.validate())
                .rejects.toThrow('Network error');
        });

        it('should throw timeout error when validation takes too long', async () => {
            jest.useFakeTimers();

            (mockConnection.request as jest.Mock).mockImplementation(() =>
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
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: mockRequestId
            });

            // Mock poll response with success
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64')
            });

            const violations = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(violations).toEqual(mockViolations);
            expect(mockConnection.request).toHaveBeenCalledTimes(2);
        });

        it('should submit base64 encoded content', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify([])).toString('base64')
            });

            await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            const submitCall = (mockConnection.request as jest.Mock).mock.calls[0][0];
            expect(submitCall.method).toBe('POST');
            expect(submitCall.url).toBe('/services/data/v64.0/apexguru/request');

            const body = JSON.parse(submitCall.body);
            expect(body.classContent).toBe(Buffer.from(testClassContent).toString('base64'));
        });

        it('should poll multiple times until success', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            // First poll returns "new", second returns success
            (mockConnection.request as jest.Mock)
                .mockResolvedValueOnce({ status: ApexGuruResponseStatus.NEW })
                .mockResolvedValueOnce({
                    status: ApexGuruResponseStatus.SUCCESS,
                    report: Buffer.from(JSON.stringify([])).toString('base64')
                });

            await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(mockConnection.request).toHaveBeenCalledTimes(3); // 1 submit + 2 polls
        }, 15000);

        it('should handle immediate success response', async () => {
            const mockViolations = [{ rule: 'Test', message: 'test', locations: [{ startLine: 1 }], primaryLocationIndex: 0, resources: [], severity: 1 }];

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64')
            });

            const violations = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(violations).toEqual(mockViolations);
        });

        it('should throw error when analysis fails', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.FAILED,
                message: 'Analysis failed'
            });

            await expect(apexGuruService.analyzeApexClass(testClassContent, testFilePath))
                .rejects.toThrow('ApexGuru analysis failed: Analysis failed');
        });

        it('should throw error on poll failure', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.FAILED,
                message: 'Processing failed'
            });

            await expect(apexGuruService.analyzeApexClass(testClassContent, testFilePath))
                .rejects.toThrow('Analysis failed: Processing failed');
        });

        it('should throw error on poll error status', async () => {
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
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

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock)
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

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64')
            });

            const violations = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(violations).toHaveLength(2);
            expect(violations[0].rule).toBe('SoqlInALoop');
            expect(violations[1].rule).toBe('DmlInALoop');
        });

        it('should stop polling when timeout occurs', async () => {
            jest.useFakeTimers();

            // Mock submit response
            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            // Mock never-ending polling (keeps returning "processing")
            (mockConnection.request as jest.Mock).mockImplementation(() =>
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
    });

    describe('cleanup', () => {
        it('should not throw error', () => {
            expect(() => apexGuruService.cleanup()).not.toThrow();
        });
    });
});
