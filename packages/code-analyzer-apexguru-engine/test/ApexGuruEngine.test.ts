import { ApexGuruEngine } from '../src/engine';
import { ApexGuruService } from '../src/services/ApexGuruService';
import { RunOptions, Workspace } from '@salesforce/code-analyzer-engine-api';
import * as fs from 'node:fs/promises';

// Mock dependencies
jest.mock('../src/services/ApexGuruService');
jest.mock('node:fs/promises');

describe('ApexGuruEngine', () => {
    let engine: ApexGuruEngine;
    let mockApexGuruService: jest.Mocked<ApexGuruService>;
    let mockWorkspace: jest.Mocked<Workspace>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockApexGuruService = {
            initialize: jest.fn(),
            validate: jest.fn(),
            analyzeApexClass: jest.fn(),
            cleanup: jest.fn(),
            setProgressCallback: jest.fn()
        } as any;

        (ApexGuruService as jest.Mock).mockImplementation(() => mockApexGuruService);

        mockWorkspace = {
            getTargetedFiles: jest.fn(),
            getAllFilesAndFolders: jest.fn(),
            getWorkspaceId: jest.fn().mockReturnValue('test-workspace'),
            targetOrg: undefined
        } as any;

        engine = new ApexGuruEngine();
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
            mockWorkspace.getWorkspaceFiles = jest.fn().mockResolvedValue([
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
            expect(mockWorkspace.getWorkspaceFiles).toHaveBeenCalled();
        });

        it('should return all rules when workspace has Apex files', async () => {
            mockWorkspace.getWorkspaceFiles = jest.fn().mockResolvedValue([
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
            mockWorkspace.getWorkspaceFiles = jest.fn().mockResolvedValue([
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
            mockApexGuruService.validate.mockResolvedValue(true);
        });

        it('should authenticate and validate', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.initialize).toHaveBeenCalledWith(undefined);
            expect(mockApexGuruService.validate).toHaveBeenCalled();
        });

        it('should throw error if authentication fails', async () => {
            mockApexGuruService.initialize.mockRejectedValue(new Error('Auth failed'));

            await expect(engine.runRules(['SoqlInALoop'], mockRunOptions))
                .rejects.toThrow('Failed to authenticate');
        });

        it('should throw error if validation fails', async () => {
            mockApexGuruService.validate.mockResolvedValue(false);

            await expect(engine.runRules(['SoqlInALoop'], mockRunOptions))
                .rejects.toThrow('ApexGuru is not available for this org');
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

        it('should analyze Apex class files', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/Test.cls',
                '/test/Controller.cls'
            ]);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.analyzeApexClass).toHaveBeenCalledTimes(2);
            expect(fs.readFile).toHaveBeenCalledWith('/test/Test.cls', 'utf-8');
            expect(fs.readFile).toHaveBeenCalledWith('/test/Controller.cls', 'utf-8');
        });

        it('should filter violations by selected rules', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);

            // ApexGuru API returns 3 violations but only 2 match selected rules
            mockApexGuruService.analyzeApexClass.mockResolvedValue([
                {
                    rule: 'SoqlInALoop',
                    message: 'SOQL in loop',
                    locations: [{ startLine: 10 }],
                    primaryLocationIndex: 0,
                    severity: 1,
                    resources: []
                },
                {
                    rule: 'DmlInALoop',
                    message: 'DML in loop',
                    locations: [{ startLine: 20 }],
                    primaryLocationIndex: 0,
                    severity: 1,
                    resources: []
                },
                {
                    rule: 'SoqlWithWildcardFilter',
                    message: 'Wildcard filter',
                    locations: [{ startLine: 30 }],
                    primaryLocationIndex: 0,
                    severity: 2,
                    resources: []
                }
            ]);

            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

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
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([
                {
                    rule: 'SoqlInALoop',
                    message: 'SOQL in loop',
                    locations: [{ startLine: 10 }],
                    primaryLocationIndex: 0,
                    severity: 1,
                    resources: [],
                    suggestions: [
                        {
                            location: { startLine: 10 },
                            message: '// Move query outside loop\nList<Account> accounts = [SELECT Id FROM Account];'
                        }
                    ]
                }
            ]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            const results = await engine.runRules(['SoqlInALoop'], {
                ...mockRunOptions,
                includeSuggestions: true
            });

            expect(results.violations).toHaveLength(1);
            expect(results.violations[0].suggestions).toBeDefined();
            expect(results.violations[0].suggestions?.length).toBe(1);
        });

        it('should emit progress events', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            const progressSpy = jest.spyOn(engine as any, 'emitRunRulesProgressEvent');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(progressSpy).toHaveBeenCalled();
            expect(progressSpy.mock.calls.length).toBeGreaterThan(0);
        });

        it('should set progress callback on ApexGuru service', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.setProgressCallback).toHaveBeenCalled();
        });

        it('should continue analyzing after single file failure', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/Test1.cls',
                '/test/Test2.cls',
                '/test/Test3.cls'
            ]);

            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            // Second file fails
            mockApexGuruService.analyzeApexClass
                .mockResolvedValueOnce([])
                .mockRejectedValueOnce(new Error('Analysis failed'))
                .mockResolvedValueOnce([]);


            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            // Should still return results from files 1 and 3
            expect(mockApexGuruService.analyzeApexClass).toHaveBeenCalledTimes(3);
            expect(results.violations).toBeDefined();
        });

        it('should always cleanup resources', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should cleanup even when error occurs within try block', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            // Make analyzeApexClass throw an error
            mockApexGuruService.analyzeApexClass.mockRejectedValue(new Error('Fatal API error'));

            // Even though analysis fails, cleanup should still be called
            const result = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            // The engine catches individual file errors and continues, so result is returned
            expect(result.violations).toEqual([]);
            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should handle .trigger files', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/AccountTrigger.trigger'
            ]);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('trigger AccountTrigger on Account {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.analyzeApexClass).toHaveBeenCalled();
        });

        it('should extract targetOrg from environment', async () => {
            process.env.SF_TARGET_ORG = 'my-org';

            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.initialize).toHaveBeenCalledWith('my-org');

            delete process.env.SF_TARGET_ORG;
        });

        it('should aggregate violations from multiple files', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue([
                '/test/Test1.cls',
                '/test/Test2.cls'
            ]);

            // First file returns 1 violation, second file returns 2 violations
            mockApexGuruService.analyzeApexClass
                .mockResolvedValueOnce([
                    {
                        rule: 'SoqlInALoop',
                        message: 'Violation 1',
                        locations: [{ startLine: 10 }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    }
                ])
                .mockResolvedValueOnce([
                    {
                        rule: 'SoqlInALoop',
                        message: 'Violation 2',
                        locations: [{ startLine: 20 }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    },
                    {
                        rule: 'DmlInALoop',
                        message: 'Violation 3',
                        locations: [{ startLine: 30 }],
                        primaryLocationIndex: 0,
                        severity: 1,
                        resources: []
                    }
                ]);

            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            const results = await engine.runRules(['SoqlInALoop', 'DmlInALoop'], mockRunOptions);

            expect(results.violations).toHaveLength(3);
        });
    });
});
