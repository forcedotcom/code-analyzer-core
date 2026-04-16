/**
 * End-to-end integration tests for bulk suppressions with actual engine execution
 * These tests run real stub engines to verify bulk suppressions work in the full flow
 * with YAML config files and test workspaces
 */

import * as path from 'node:path';
import { CodeAnalyzer } from '../src/code-analyzer';
import { CodeAnalyzerConfig } from '../src/config';
import * as stubs from './stubs';
import { changeWorkingDirectoryToPackageRoot, FakeFileSystem } from './test-helpers';

changeWorkingDirectoryToPackageRoot();

describe('Bulk Suppressions E2E Tests (with YAML config and test workspace)', () => {
    const testWorkspaceDir = path.resolve(__dirname, 'test-data', 'bulk-suppressions-workspace');
    const configFile = path.join(testWorkspaceDir, 'code-analyzer.yml');

    describe('file-level bulk suppressions', () => {
        it('should suppress violations up to quota limit for specific file', async () => {
            // Config has: file1.js with max_suppressed_violations: 2
            // We'll create 3 violations in file1.js
            // Expected: 2 suppressed, 1 unsuppressed

            const config = await CodeAnalyzerConfig.fromFile(configFile);
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());

            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const file1Path = path.join(testWorkspaceDir, 'file1.js');
            const workspace = await codeAnalyzer.createWorkspace([file1Path]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            // Create 3 violations in file1.js
            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 1',
                        codeLocations: [{ file: file1Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 2',
                        codeLocations: [{ file: file1Path, startLine: 6, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 3',
                        codeLocations: [{ file: file1Path, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });
            const violations = results.getViolations();

            // Only 1 violation should remain (quota was 2)
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(10);
        });

        it('should suppress all violations with null quota limit', async () => {
            // Config has: file2.js with max_suppressed_violations: null (unlimited)
            // Expected: all violations suppressed

            const config = await CodeAnalyzerConfig.fromFile(configFile);
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());

            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const file2Path = path.join(testWorkspaceDir, 'file2.js');
            const workspace = await codeAnalyzer.createWorkspace([file2Path]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 1',
                        codeLocations: [{ file: file2Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });
            const violations = results.getViolations();

            // All violations should be suppressed
            expect(violations.length).toBe(0);
        });
    });

    describe('folder-level bulk suppressions with shared quota', () => {
        it('should share quota across all files in folder', async () => {
            // Config has: src/controllers/ with max_suppressed_violations: 2 (shared)
            // We have controller1.js with 2 violations and controller2.js with 1 violation
            // Expected: First 2 violations suppressed (across files), 1 remains

            const config = await CodeAnalyzerConfig.fromFile(configFile);
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());

            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const controller1Path = path.join(testWorkspaceDir, 'src', 'controllers', 'controller1.js');
            const controller2Path = path.join(testWorkspaceDir, 'src', 'controllers', 'controller2.js');
            // Pass testWorkspaceDir as workspace folder to set correct workspace root
            const workspace = await codeAnalyzer.createWorkspace([testWorkspaceDir], [controller1Path, controller2Path]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation in controller1 line 3',
                        codeLocations: [{ file: controller1Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation in controller1 line 6',
                        codeLocations: [{ file: controller1Path, startLine: 6, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation in controller2 line 3',
                        codeLocations: [{ file: controller2Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });
            const violations = results.getViolations();

            // Only 1 violation should remain (quota of 2 shared across folder)
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getFile()).toBe(controller2Path);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(3);
        });
    });

    describe('multiple rules with duplicate selectors', () => {
        it('should give each array entry independent quota', async () => {
            // Create a custom config with duplicate selectors
            const customConfig = CodeAnalyzerConfig.fromObject({
                suppressions: {
                    disable_suppressions: false,
                    'file1.js': [
                        { rule_selector: 'all', max_suppressed_violations: 2 },
                        { rule_selector: 'all', max_suppressed_violations: 1 }  // Duplicate
                    ]
                },
                log_level: 'error'
            });

            const codeAnalyzer = new CodeAnalyzer(customConfig, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const file1Path = path.join(testWorkspaceDir, 'file1.js');
            const workspace = await codeAnalyzer.createWorkspace([file1Path]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            // Create 4 violations
            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 1',
                        codeLocations: [{ file: file1Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 2',
                        codeLocations: [{ file: file1Path, startLine: 6, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 3',
                        codeLocations: [{ file: file1Path, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 4',
                        codeLocations: [{ file: file1Path, startLine: 11, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });
            const violations = results.getViolations();

            // Should suppress 3 total (2 + 1), leaving 1 unsuppressed
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(11);
        });
    });

    describe('workspace root path resolution', () => {
        it('should resolve paths relative to workspace root, not config file location', async () => {
            // This test verifies Bug #2 fix: paths in config are relative to workspace root
            // Config is in testWorkspaceDir but paths should be relative to workspace root

            const config = await CodeAnalyzerConfig.fromFile(configFile);
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());

            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const file1Path = path.join(testWorkspaceDir, 'file1.js');
            const workspace = await codeAnalyzer.createWorkspace([file1Path]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation',
                        codeLocations: [{ file: file1Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });
            const violations = results.getViolations();

            // Should be suppressed because config path "file1.js" is relative to workspace root
            expect(violations.length).toBe(0);
        });
    });

    describe('with suppressions disabled', () => {
        it('should not suppress any violations when disable_suppressions is true', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: {
                    disable_suppressions: true,
                    'file1.js': [
                        { rule_selector: 'all', max_suppressed_violations: null }
                    ]
                },
                log_level: 'error'
            });

            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const file1Path = path.join(testWorkspaceDir, 'file1.js');
            const workspace = await codeAnalyzer.createWorkspace([file1Path]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation',
                        codeLocations: [{ file: file1Path, startLine: 3, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });
            const violations = results.getViolations();

            // Should NOT be suppressed (suppressions disabled)
            expect(violations.length).toBe(1);
        });
    });
});
