import { ApexGuruEngine } from '../src/engine';
import { ApexGuruService } from '../src/services/ApexGuruService';
import { LogLevel, RunOptions, Workspace } from '@salesforce/code-analyzer-engine-api';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';

// Mock dependencies
jest.mock('../src/services/ApexGuruService');
jest.mock('node:fs/promises');
jest.mock('node:fs', () => ({
    ...jest.requireActual('node:fs'),
    existsSync: jest.fn().mockReturnValue(true)
}));

describe('ApexGuruEngine', () => {
    let engine: ApexGuruEngine;
    let mockApexGuruService: jest.Mocked<ApexGuruService>;
    let mockWorkspace: jest.Mocked<Workspace>;
    beforeEach(() => {
        jest.clearAllMocks();

        mockApexGuruService = {
            initialize: jest.fn(),
            scanWorkspace: jest.fn(),
            cleanup: jest.fn(),
            setProgressCallback: jest.fn()
        } as any;

        (ApexGuruService as jest.Mock).mockImplementation(() => mockApexGuruService);

        mockWorkspace = {
            getTargetedFiles: jest.fn(),
            getAllFilesAndFolders: jest.fn(),
            getWorkspaceId: jest.fn().mockReturnValue('test-workspace'),
            getWorkspaceRoot: jest.fn().mockReturnValue('/test/workspace'),
            targetOrg: undefined
        } as any;

        engine = new ApexGuruEngine();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getName', () => {
        it('should return engine name', () => {
            expect(engine.getName()).toBe('apexguru');
        });
    });

    describe('getEngineVersion', () => {
        it('should return version from package.json', async () => {
            (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ version: '1.2.3' }));

            const version = await engine.getEngineVersion();

            expect(version).toBe('1.2.3');
        });
    });

    describe('describeRules', () => {
        it('should return all ApexGuru rules', async () => {
            const rules = await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working'
            });

            expect(rules.length).toBeGreaterThan(0);
            expect(rules.find(r => r.name === 'SoqlInALoop')).toBeDefined();
            expect(rules.find(r => r.name === 'DmlInALoop')).toBeDefined();
        });

        it('should emit progress events', async () => {
            const progressSpy = jest.spyOn(engine as any, 'emitDescribeRulesProgressEvent');

            await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working'
            });

            expect(progressSpy).toHaveBeenCalledWith(0);
            expect(progressSpy).toHaveBeenCalledWith(100);
        });

        it('should return empty array when workspace has no Apex files', async () => {
            mockWorkspace.getTargetedFiles = jest.fn().mockResolvedValue([
                '/project/js/app.js',
                '/project/js/utils.js',
                '/project/css/styles.css'
            ]);

            const rules = await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working',
                workspace: mockWorkspace
            });

            expect(rules).toEqual([]);
            expect(mockWorkspace.getTargetedFiles).toHaveBeenCalled();
        });

        it('should return all rules when workspace has Apex files', async () => {
            mockWorkspace.getTargetedFiles = jest.fn().mockResolvedValue([
                '/project/classes/Account.cls',
                '/project/js/app.js'
            ]);

            const rules = await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working',
                workspace: mockWorkspace
            });

            expect(rules.length).toBeGreaterThan(0);
            expect(rules.find(r => r.name === 'SoqlInALoop')).toBeDefined();
        });

        it('should return all rules when workspace has trigger files', async () => {
            mockWorkspace.getTargetedFiles = jest.fn().mockResolvedValue([
                '/project/triggers/AccountTrigger.trigger',
                '/project/js/app.js'
            ]);

            const rules = await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working',
                workspace: mockWorkspace
            });

            expect(rules.length).toBeGreaterThan(0);
            expect(rules.find(r => r.name === 'DmlInALoop')).toBeDefined();
        });

        it('should return all rules when no workspace provided', async () => {
            const rules = await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working'
                // No workspace
            });

            expect(rules.length).toBeGreaterThan(0);
            expect(rules.find(r => r.name === 'SoqlInALoop')).toBeDefined();
        });

        it('should return rules without attempting authentication regardless of auth state', async () => {
            const rules = await engine.describeRules({
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working'
            });

            expect(rules.length).toBeGreaterThan(0);
            expect(rules.find(r => r.name === 'SoqlInALoop')).toBeDefined();
            expect(rules.find(r => r.name === 'DmlInALoop')).toBeDefined();
            expect(mockApexGuruService.initialize).not.toHaveBeenCalled();
        });
    });

    describe('runRules', () => {
        let mockRunOptions: RunOptions;

        beforeEach(() => {
            mockRunOptions = {
                workspace: mockWorkspace,
                logFolder: '/tmp/logs',
                workingFolder: '/tmp/working',
                includeSuggestions: false
            };
            mockApexGuruService.initialize.mockResolvedValue();
            mockApexGuruService.scanWorkspace.mockResolvedValue({ violations: [] });
        });

        it('should return empty results immediately when no rules selected', async () => {
            const results = await engine.runRules([], mockRunOptions);

            expect(results.violations).toEqual([]);
            expect(mockApexGuruService.initialize).not.toHaveBeenCalled();
            expect(mockWorkspace.getTargetedFiles).not.toHaveBeenCalled();
        });

        it('should authenticate and scan workspace', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.initialize).toHaveBeenCalledWith(undefined);
            expect(mockApexGuruService.scanWorkspace).toHaveBeenCalledWith('/test/workspace', ['/test/workspace/Test.cls']);
        });

        it('should gracefully skip with NO_ORG_CONNECTION when authentication fails', async () => {
            mockApexGuruService.initialize.mockRejectedValue(new Error('No default org found'));
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            const logSpy = jest.spyOn(engine as any, 'emitLogEvent');
            const progressSpy = jest.spyOn(engine as any, 'emitRunRulesProgressEvent');

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toEqual([]);
            expect(results.insights).toEqual({
                status: 'skipped',
                error: {
                    code: 'NO_ORG_CONNECTION',
                    message: expect.stringContaining('No default org found'),
                    remediation: expect.stringContaining('sf org login web')
                }
            });
            expect(logSpy).toHaveBeenCalledWith(
                LogLevel.Warn,
                expect.stringContaining('Failed to authenticate')
            );
            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
            expect(progressSpy).toHaveBeenCalledWith(100);
            // No SFAP calls should be made after auth failure
            expect(mockApexGuruService.scanWorkspace).not.toHaveBeenCalled();
        });

        it('should gracefully skip with API_UNAVAILABLE when API is unreachable', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            mockApexGuruService.scanWorkspace.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:443'));
            const logSpy = jest.spyOn(engine as any, 'emitLogEvent');

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toEqual([]);
            expect(results.insights).toEqual({
                status: 'skipped',
                error: {
                    code: 'API_UNAVAILABLE',
                    message: expect.stringContaining('ECONNREFUSED'),
                    remediation: expect.stringContaining('temporarily unavailable')
                }
            });
            expect(logSpy).toHaveBeenCalledWith(
                LogLevel.Warn,
                expect.stringContaining('unavailable')
            );
            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should gracefully skip with API_UNAVAILABLE on timeout', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            mockApexGuruService.scanWorkspace.mockRejectedValue(new Error('Request timeout after 300000ms'));
            const logSpy = jest.spyOn(engine as any, 'emitLogEvent');

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toEqual([]);
            expect(results.insights).toEqual({
                status: 'skipped',
                error: {
                    code: 'API_UNAVAILABLE',
                    message: expect.stringContaining('timeout'),
                    remediation: expect.stringContaining('try again later')
                }
            });
            expect(logSpy).toHaveBeenCalledWith(LogLevel.Warn, expect.any(String));
        });

        it('should gracefully skip with UNEXPECTED_ERROR on non-network errors', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            mockApexGuruService.scanWorkspace.mockRejectedValue(new Error('Unexpected internal failure'));
            const logSpy = jest.spyOn(engine as any, 'emitLogEvent');

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toEqual([]);
            expect(results.insights).toEqual({
                status: 'skipped',
                error: {
                    code: 'UNEXPECTED_ERROR',
                    message: expect.stringContaining('Unexpected internal failure'),
                    remediation: expect.stringContaining('file a support ticket')
                }
            });
            expect(logSpy).toHaveBeenCalledWith(LogLevel.Warn, expect.any(String));
            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should return empty results if no Apex files found', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/Test.js',
                '/test/Test.java'
            ]);

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toEqual([]);
            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should throw error if workspace root is null', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockWorkspace.getWorkspaceRoot.mockReturnValue(null);

            await expect(engine.runRules(['SoqlInALoop'], mockRunOptions))
                .rejects.toThrow('ApexGuru requires a common workspace root');

            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should zip only the targeted Apex files', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/workspace/classes/Test.cls',
                '/test/workspace/triggers/AccountTrigger.trigger'
            ]);

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.scanWorkspace).toHaveBeenCalledWith('/test/workspace', [
                '/test/workspace/classes/Test.cls',
                '/test/workspace/triggers/AccountTrigger.trigger'
            ]);
        });

        it('should exclude non-Apex targeted files from the zip', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/workspace/classes/Test.cls',
                '/test/workspace/README.md',
                '/test/workspace/lwc/foo/foo.js'
            ]);

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.scanWorkspace).toHaveBeenCalledWith('/test/workspace', [
                '/test/workspace/classes/Test.cls'
            ]);
        });

        it('should filter violations by selected rules', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            // SFAP API returns 3 violations but only 2 match selected rules
            mockApexGuruService.scanWorkspace.mockResolvedValue({
                violations: [
                    {
                        rule: 'SoqlInALoop',
                        message: 'SOQL in loop',
                        locations: [{ startLine: 10, file: 'classes/Test.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    },
                    {
                        rule: 'DmlInALoop',
                        message: 'DML in loop',
                        locations: [{ startLine: 20, file: 'classes/Test.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    },
                    {
                        rule: 'SoqlWithWildcardFilter',
                        message: 'Wildcard filter',
                        locations: [{ startLine: 30, file: 'classes/Test.cls' }],
                        primaryLocationIndex: 0,
                        severity: 2,
                        resources: []
                    }
                ]
            });

            const results = await engine.runRules(
                ['SoqlInALoop', 'DmlInALoop'],
                mockRunOptions
            );

            expect(results.violations).toHaveLength(2);
            expect(results.violations.find(v => v.ruleName === 'SoqlInALoop')).toBeDefined();
            expect(results.violations.find(v => v.ruleName === 'DmlInALoop')).toBeDefined();
            expect(results.violations.find(v => v.ruleName === 'SoqlWithWildcardFilter')).toBeUndefined();
        });

        it('should include suggestions when includeSuggestions is true', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            mockApexGuruService.scanWorkspace.mockResolvedValue({
                violations: [
                    {
                        rule: 'SoqlInALoop',
                        message: 'SOQL in loop',
                        locations: [{ startLine: 10, file: 'classes/Test.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: [],
                        suggestions: [
                            {
                                location: { startLine: 10, file: 'classes/Test.cls' },
                                message: '// Move query outside loop\nList<Account> accounts = [SELECT Id FROM Account];'
                            }
                        ]
                    }
                ]
            });

            const results = await engine.runRules(['SoqlInALoop'], {
                ...mockRunOptions,
                includeSuggestions: true
            });

            expect(results.violations).toHaveLength(1);
            expect(results.violations[0].suggestions).toBeDefined();
            expect(results.violations[0].suggestions?.length).toBe(1);
        });

        it('should emit progress events', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            // Mock scanWorkspace to call the progress callback
            mockApexGuruService.scanWorkspace.mockImplementation(async () => {
                // Simulate progress callback being called
                const callback = mockApexGuruService.setProgressCallback.mock.calls[0]?.[0];
                if (callback) {
                    callback(50);  // Simulate 50% progress
                    callback(100); // Simulate 100% progress
                }
                return { violations: [] };
            });

            const progressSpy = jest.spyOn(engine as any, 'emitRunRulesProgressEvent');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(progressSpy).toHaveBeenCalled();
            expect(progressSpy.mock.calls.length).toBeGreaterThan(0);
        });

        it('should set progress callback on SFAP service', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.setProgressCallback).toHaveBeenCalled();
        });

        it('should always cleanup resources', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should cleanup even when error occurs within try block', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            // Make scanWorkspace throw an error — should be caught and return skip result
            mockApexGuruService.scanWorkspace.mockRejectedValue(new Error('Fatal API error'));

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            // Should not throw — error is caught and returned as UNEXPECTED_ERROR skip
            expect(results.violations).toEqual([]);
            expect(results.insights).toEqual({
                status: 'skipped',
                error: expect.objectContaining({ code: 'UNEXPECTED_ERROR' })
            });
            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should handle .trigger files', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/workspace/triggers/AccountTrigger.trigger'
            ]);

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.scanWorkspace).toHaveBeenCalled();
        });

        it('should pass target_org from config to auth service', async () => {
            // target_org is passed through config (set by CLI --target-org flag)
            // Core resolves credentials internally via @salesforce/core
            const engineWithConfig = new ApexGuruEngine({
                target_org: 'my-org',
                api_timeout_ms: 300000,
                api_initial_retry_ms: 2000,
                api_max_retry_ms: 60000,
                api_backoff_multiplier: 2
            });

            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);

            await engineWithConfig.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.initialize).toHaveBeenCalledWith('my-org');
        });

        it('should return insights with status completed, analysis mode, and scan metadata on success', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            const mockScanMetadata = {
                analysis_mode: 'full' as const,
                files_scanned: 1,
                violation_breakdown: { SoqlInALoop: 1 },
                violation_count: 1,
                report_generated_ms: 1234567890
            };
            mockApexGuruService.scanWorkspace.mockResolvedValue({
                violations: [],
                scanMetadata: mockScanMetadata,
                analysisMode: 'full'
            });

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.insights).toBeDefined();
            expect(results.insights!['status']).toBe('completed');
            expect(results.insights!['analysisMode']).toBe('full');
            expect(results.insights!['scan']).toEqual(mockScanMetadata);
        });

        it('should return insights with status completed even without scan metadata or analysis mode', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            mockApexGuruService.scanWorkspace.mockResolvedValue({ violations: [] });

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.insights).toBeDefined();
            expect(results.insights!['status']).toBe('completed');
            expect(results.insights!['analysisMode']).toBeUndefined();
            expect(results.insights!['scan']).toBeUndefined();
        });

        it('should use file path from SFAP violation location', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            mockApexGuruService.scanWorkspace.mockResolvedValue({
                violations: [
                    {
                        rule: 'SoqlInALoop',
                        message: 'SOQL in loop',
                        locations: [{ startLine: 10, file: 'force-app/main/default/classes/Test.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    }
                ]
            });

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toHaveLength(1);
            expect(results.violations[0].primaryLocationIndex).toBe(0);
            expect(results.violations[0].codeLocations[0].file).toBe(
                path.resolve('/test/workspace', 'force-app/main/default/classes/Test.cls'));
        });

        it('should reconstruct the real absolute path when SFAP strips a common leading directory', async () => {
            // Simulate the NPSP case: user targeted files under .../NPSP/unpackaged/,
            // SFAP stripped "unpackaged/" from the returned path.
            mockWorkspace.getWorkspaceRoot.mockReturnValue('/test/workspace');
            const zippedFile = '/test/workspace/unpackaged/config/foo/classes/Bar.cls';
            mockWorkspace.getTargetedFiles.mockResolvedValue([zippedFile]);
            (fsSync.existsSync as jest.Mock).mockImplementation((p: string) => p === zippedFile);
            mockApexGuruService.scanWorkspace.mockResolvedValue({
                violations: [
                    {
                        rule: 'SoqlInALoop',
                        message: 'stripped path',
                        locations: [{ startLine: 5, file: 'config/foo/classes/Bar.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    }
                ]
            });

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toHaveLength(1);
            expect(results.violations[0].codeLocations[0].file).toBe(zippedFile);
        });

        it('should drop violations whose primary location file does not exist on disk', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/workspace/Test.cls']);
            const realFilePath = path.resolve('/test/workspace', 'force-app/main/default/classes/Real.cls');
            // existsSync returns true only for the real file, false for the synthetic inner-class path
            (fsSync.existsSync as jest.Mock).mockImplementation((p: string) =>
                p === realFilePath);
            mockApexGuruService.scanWorkspace.mockResolvedValue({
                violations: [
                    {
                        rule: 'SoqlInALoop',
                        message: 'real file',
                        locations: [{ startLine: 10, file: 'force-app/main/default/classes/Real.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    },
                    {
                        rule: 'SoqlInALoop',
                        message: 'synthetic inner-class path',
                        locations: [{ startLine: 20, file: 'force-app/main/default/classes/Foo.InnerHelper.cls' }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    }
                ]
            });

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(results.violations).toHaveLength(1);
            expect(results.violations[0].codeLocations[0].file).toBe(realFilePath);
        });
    });
});
