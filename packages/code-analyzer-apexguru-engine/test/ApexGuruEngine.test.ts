import { ApexGuruEngine } from '../src/engine';
import { ApexGuruService } from '../src/services/ApexGuruService';
import { ViolationMapper } from '../src/mappers/ViolationMapper';
import { RunOptions, Workspace } from '@salesforce/code-analyzer-engine-api';
import * as fs from 'node:fs/promises';

// Mock dependencies
jest.mock('../src/services/ApexGuruService');
jest.mock('../src/mappers/ViolationMapper');
jest.mock('node:fs/promises');

describe('ApexGuruEngine', () => {
    let engine: ApexGuruEngine;
    let mockApexGuruService: jest.Mocked<ApexGuruService>;
    let mockViolationMapper: jest.Mocked<ViolationMapper>;
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

        mockViolationMapper = {
            mapViolations: jest.fn()
        } as any;

        (ApexGuruService as jest.Mock).mockImplementation(() => mockApexGuruService);
        (ViolationMapper as jest.Mock).mockImplementation(() => mockViolationMapper);

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
            mockViolationMapper.mapViolations.mockReturnValue([]);
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
            mockViolationMapper.mapViolations.mockReturnValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.analyzeApexClass).toHaveBeenCalledTimes(2);
            expect(fs.readFile).toHaveBeenCalledWith('/test/Test.cls', 'utf-8');
            expect(fs.readFile).toHaveBeenCalledWith('/test/Controller.cls', 'utf-8');
        });

        it('should filter violations by selected rules', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);

            // Mapper returns 3 violations but only 2 match selected rules
            mockViolationMapper.mapViolations.mockReturnValue([
                {
                    ruleName: 'SoqlInALoop',
                    message: 'SOQL in loop',
                    codeLocations: [],
                    primaryLocationIndex: 0
                },
                {
                    ruleName: 'DmlInALoop',
                    message: 'DML in loop',
                    codeLocations: [],
                    primaryLocationIndex: 0
                },
                {
                    ruleName: 'SoqlWithWildcardFilter',
                    message: 'Wildcard filter',
                    codeLocations: [],
                    primaryLocationIndex: 0
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

        it('should pass includeSuggestions to mapper', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            mockViolationMapper.mapViolations.mockReturnValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], {
                ...mockRunOptions,
                includeSuggestions: true
            });

            expect(mockViolationMapper.mapViolations).toHaveBeenCalledWith(
                [],
                '/test/Test.cls',
                true
            );
        });

        it('should emit progress events', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            mockViolationMapper.mapViolations.mockReturnValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            const progressSpy = jest.spyOn(engine as any, 'emitRunRulesProgressEvent');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(progressSpy).toHaveBeenCalled();
            expect(progressSpy.mock.calls.length).toBeGreaterThan(0);
        });

        it('should set progress callback on ApexGuru service', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            mockViolationMapper.mapViolations.mockReturnValue([]);
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

            mockViolationMapper.mapViolations.mockReturnValue([]);

            const results = await engine.runRules(['SoqlInALoop'], mockRunOptions);

            // Should still return results from files 1 and 3
            expect(mockApexGuruService.analyzeApexClass).toHaveBeenCalledTimes(3);
            expect(results.violations).toBeDefined();
        });

        it('should always cleanup resources', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            mockViolationMapper.mapViolations.mockReturnValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.cleanup).toHaveBeenCalled();
        });

        it('should cleanup even when error occurs within try block', async () => {
            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            // Make analyzeApexClass throw a fatal error that propagates
            mockApexGuruService.analyzeApexClass.mockRejectedValue(new Error('Fatal API error'));
            mockViolationMapper.mapViolations.mockImplementation(() => {
                throw new Error('Mapper error');
            });

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
            mockViolationMapper.mapViolations.mockReturnValue([]);
            (fs.readFile as jest.Mock).mockResolvedValue('trigger AccountTrigger on Account {}');

            await engine.runRules(['SoqlInALoop'], mockRunOptions);

            expect(mockApexGuruService.analyzeApexClass).toHaveBeenCalled();
        });

        it('should extract targetOrg from environment', async () => {
            process.env.SF_TARGET_ORG = 'my-org';

            mockWorkspace.getTargetedFiles.mockResolvedValue(['/test/Test.cls']);
            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);
            mockViolationMapper.mapViolations.mockReturnValue([]);
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

            mockApexGuruService.analyzeApexClass.mockResolvedValue([]);

            mockViolationMapper.mapViolations
                .mockReturnValueOnce([
                    { ruleName: 'SoqlInALoop', message: 'Violation 1', codeLocations: [], primaryLocationIndex: 0 }
                ])
                .mockReturnValueOnce([
                    { ruleName: 'SoqlInALoop', message: 'Violation 2', codeLocations: [], primaryLocationIndex: 0 },
                    { ruleName: 'DmlInALoop', message: 'Violation 3', codeLocations: [], primaryLocationIndex: 0 }
                ]);

            (fs.readFile as jest.Mock).mockResolvedValue('public class Test {}');

            const results = await engine.runRules(['SoqlInALoop', 'DmlInALoop'], mockRunOptions);

            expect(results.violations).toHaveLength(3);
        });
    });
});
