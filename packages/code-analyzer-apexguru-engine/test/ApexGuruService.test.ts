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

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toEqual(mockViolations);
            expect(result.scanMetadata).toBeUndefined();
            expect(mockConnection.request).toHaveBeenCalledTimes(2);
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

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify(mockViolations)).toString('base64'),
                scanMetadata: mockScanMetadata
            });

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toEqual(mockViolations);
            expect(result.scanMetadata).toEqual(mockScanMetadata);
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

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toEqual(mockViolations);
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

            const result = await apexGuruService.analyzeApexClass(testClassContent, testFilePath);

            expect(result.violations).toHaveLength(2);
            expect(result.violations[0].rule).toBe('SoqlInALoop');
            expect(result.violations[1].rule).toBe('DmlInALoop');
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

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
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

    describe('generateCurlCommand', () => {
        beforeEach(async () => {
            // Initialize to set up connection
            await apexGuruService.initialize();
        });

        it('should generate valid curl command for GET validate endpoint', () => {
            const curlCmd = (apexGuruService as any).generateCurlCommand(
                'GET',
                '/services/data/v64.0/apexguru/validate'
            );

            expect(curlCmd).toContain('curl -X GET');
            expect(curlCmd).toContain('https://test.salesforce.com/services/data/v64.0/apexguru/validate');
            expect(curlCmd).toContain('-H "Authorization: Bearer test-token"');
        });

        it('should generate valid curl command for POST submit endpoint with body', () => {
            const testContent = 'public class Test { }';
            const base64Content = Buffer.from(testContent, 'utf-8').toString('base64');
            const requestBody = { classContent: base64Content };

            const curlCmd = (apexGuruService as any).generateCurlCommand(
                'POST',
                '/services/data/v64.0/apexguru/request',
                JSON.stringify(requestBody)
            );

            expect(curlCmd).toContain('curl -X POST');
            expect(curlCmd).toContain('https://test.salesforce.com/services/data/v64.0/apexguru/request');
            expect(curlCmd).toContain('-H "Authorization: Bearer test-token"');
            expect(curlCmd).toContain('-H "Content-Type: application/json"');
            expect(curlCmd).toContain(`-d '${JSON.stringify(requestBody)}'`);
        });

        it('should generate valid curl command for GET query endpoint with requestId', () => {
            const requestId = 'req-123';
            const curlCmd = (apexGuruService as any).generateCurlCommand(
                'GET',
                `/services/data/v64.0/apexguru/request/${requestId}`
            );

            expect(curlCmd).toContain('curl -X GET');
            expect(curlCmd).toContain(`https://test.salesforce.com/services/data/v64.0/apexguru/request/${requestId}`);
            expect(curlCmd).toContain('-H "Authorization: Bearer test-token"');
        });

        it('should properly escape single quotes in body', () => {
            const bodyWithQuotes = JSON.stringify({ data: "It's a test" });
            const curlCmd = (apexGuruService as any).generateCurlCommand(
                'POST',
                '/services/data/v64.0/apexguru/request',
                bodyWithQuotes
            );

            expect(curlCmd).toContain(`-d '${bodyWithQuotes.replace(/'/g, "'\\''")}'`);
        });

        it('should return graceful message when connection not initialized', () => {
            const uninitializedAuthService = {
                initialize: jest.fn(),
                getConnection: jest.fn().mockReturnValue(null),
                getAccessToken: jest.fn(),
                getInstanceUrl: jest.fn(),
                getApiVersion: jest.fn(),
                mintOrgJwt: jest.fn()
            } as any;

            jest.mocked(ApexGuruAuthService).mockImplementationOnce(() => uninitializedAuthService);

            const uninitializedService = new ApexGuruService(
                mockEmitLogEvent,
                120000,
                2000,
                60000,
                2
            );

            const curlCmd = (uninitializedService as any).generateCurlCommand(
                'GET',
                '/services/data/v64.0/apexguru/validate'
            );

            expect(curlCmd).toBe('# Connection not initialized');
        });
    });

    describe('debug curl logging', () => {
        const originalEnv = process.env.APEXGURU_DEBUG_CURL;

        afterEach(() => {
            if (originalEnv !== undefined) {
                process.env.APEXGURU_DEBUG_CURL = originalEnv;
            } else {
                delete process.env.APEXGURU_DEBUG_CURL;
            }
        });

        beforeEach(async () => {
            await apexGuruService.initialize();
        });

        it('should log curl command for validate when APEXGURU_DEBUG_CURL is set', async () => {
            process.env.APEXGURU_DEBUG_CURL = '1';

            (mockConnection.request as jest.Mock).mockResolvedValue({
                status: ApexGuruResponseStatus.SUCCESS
            });

            await apexGuruService.validate();

            expect(mockEmitLogEvent).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('Equivalent curl command:')
            );
            expect(mockEmitLogEvent).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('curl -X GET')
            );
        });

        it('should not log curl command for validate when APEXGURU_DEBUG_CURL is not set', async () => {
            delete process.env.APEXGURU_DEBUG_CURL;

            (mockConnection.request as jest.Mock).mockResolvedValue({
                status: ApexGuruResponseStatus.SUCCESS
            });

            await apexGuruService.validate();

            const curlLogs = mockEmitLogEvent.mock.calls.filter((call: any[]) =>
                call[1] && call[1].includes('curl')
            );
            expect(curlLogs).toHaveLength(0);
        });

        it('should log curl command for submit when APEXGURU_DEBUG_CURL is set', async () => {
            process.env.APEXGURU_DEBUG_CURL = '1';

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify([])).toString('base64')
            });

            await apexGuruService.analyzeApexClass('public class Test { }', '/test/Test.cls');

            const curlLogs = mockEmitLogEvent.mock.calls.filter((call: any[]) =>
                call[1] && call[1].includes('Equivalent curl command:')
            );
            expect(curlLogs.length).toBeGreaterThanOrEqual(2); // At least submit and poll
        });

        it('should log curl command for poll when APEXGURU_DEBUG_CURL is set', async () => {
            process.env.APEXGURU_DEBUG_CURL = '1';

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.NEW,
                requestId: 'req-123'
            });

            (mockConnection.request as jest.Mock).mockResolvedValueOnce({
                status: ApexGuruResponseStatus.SUCCESS,
                report: Buffer.from(JSON.stringify([])).toString('base64')
            });

            await apexGuruService.analyzeApexClass('public class Test { }', '/test/Test.cls');

            const curlWithRequestId = mockEmitLogEvent.mock.calls.filter((call: any[]) =>
                call[1] && call[1].includes('curl') && call[1].includes('req-123')
            );
            expect(curlWithRequestId.length).toBeGreaterThan(0);
        });
    });

    describe('exportCurlCommands', () => {
        beforeEach(async () => {
            await apexGuruService.initialize();
        });

        it('should return object with validate, submit, and query curl commands', () => {
            const exported = apexGuruService.exportCurlCommands();

            expect(exported).toHaveProperty('validate');
            expect(exported).toHaveProperty('submit');
            expect(exported).toHaveProperty('query');
            expect(typeof exported.validate).toBe('string');
            expect(typeof exported.submit).toBe('function');
            expect(typeof exported.query).toBe('function');
        });

        it('should generate valid validate curl command', () => {
            const exported = apexGuruService.exportCurlCommands();

            expect(exported.validate).toContain('curl -X GET');
            expect(exported.validate).toContain('https://test.salesforce.com/services/data/v64.0/apexguru/validate');
            expect(exported.validate).toContain('Authorization: Bearer test-token');
        });

        it('should generate valid submit curl command with class content', () => {
            const exported = apexGuruService.exportCurlCommands();
            const testContent = 'public class Test { }';
            const submitCmd = exported.submit(testContent);

            expect(submitCmd).toContain('curl -X POST');
            expect(submitCmd).toContain('https://test.salesforce.com/services/data/v64.0/apexguru/request');
            expect(submitCmd).toContain('Authorization: Bearer test-token');
            expect(submitCmd).toContain('Content-Type: application/json');
            expect(submitCmd).toContain(Buffer.from(testContent).toString('base64'));
        });

        it('should generate valid query curl command with requestId', () => {
            const exported = apexGuruService.exportCurlCommands();
            const requestId = 'req-123';
            const queryCmd = exported.query(requestId);

            expect(queryCmd).toContain('curl -X GET');
            expect(queryCmd).toContain(`https://test.salesforce.com/services/data/v64.0/apexguru/request/${requestId}`);
            expect(queryCmd).toContain('Authorization: Bearer test-token');
        });

        it('should handle pending requestId for query', () => {
            const exported = apexGuruService.exportCurlCommands();
            const queryCmd = exported.query('pending');

            expect(queryCmd).toContain('curl -X GET');
            expect(queryCmd).toContain('https://test.salesforce.com/services/data/v64.0/apexguru/request');
            expect(queryCmd).not.toContain('request/pending');
        });
    });
});
