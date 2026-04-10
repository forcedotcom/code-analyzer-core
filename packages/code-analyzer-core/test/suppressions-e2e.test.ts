/**
 * End-to-end integration tests for suppression markers with actual engine execution
 * These tests run real engines (stub engines) to verify suppressions work in the full flow
 */

import * as path from 'node:path';
import { CodeAnalyzer } from '../src/code-analyzer';
import { CodeAnalyzerConfig } from '../src/config';
import * as stubs from './stubs';
import { SeverityLevel } from '@salesforce/code-analyzer-engine-api';
import { changeWorkingDirectoryToPackageRoot, FakeFileSystem } from './test-helpers';

changeWorkingDirectoryToPackageRoot();

describe('Suppression Markers E2E Tests (with actual engine execution)', () => {
    const testDataDir = path.resolve(__dirname, 'test-data', 'suppression-markers');

    describe('with suppressions enabled', () => {
        it('should suppress all violations with suppress(all) marker', async () => {
            // Create CodeAnalyzer with suppressions enabled
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());

            // Add stub engine plugin
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            // Create workspace with test file
            const filePath = path.join(testDataDir, 'file-with-suppress-all.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);

            // Select rules
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            // Configure engine to return violations
            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation on line 7',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Violation on line 8',
                        codeLocations: [{ file: filePath, startLine: 8, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleC',
                        message: 'Violation on line 9',
                        codeLocations: [{ file: filePath, startLine: 9, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            // Run the analyzer (this actually runs the engine)
            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // All violations should be suppressed (suppress(all) on line 6)
            const violations = results.getViolations();
            expect(violations.length).toBe(0);
        });

        it('should suppress only engine-specific violations with suppress(engine)', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const filePath = path.join(testDataDir, 'e2e-file-with-suppress-engine.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation on line 6 (before marker)',
                        codeLocations: [{ file: filePath, startLine: 6, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Violation on line 9 (after suppress(stubEngine1))',
                        codeLocations: [{ file: filePath, startLine: 9, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Only violation before marker should remain
            const violations = results.getViolations();
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(6);
        });

        it('should suppress only specific rule violations with suppress(engine:rule)', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            // File has: suppress(stubEngine1:stub1RuleA) on line 8
            const filePath = path.join(testDataDir, 'e2e-file-with-suppress-specific-rule.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Rule A on line 6 (before marker)',
                        codeLocations: [{ file: filePath, startLine: 6, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Rule A on line 9 (should be suppressed)',
                        codeLocations: [{ file: filePath, startLine: 9, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Rule B on line 10 (different rule, not suppressed)',
                        codeLocations: [{ file: filePath, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Rule A on line 11 (should be suppressed)',
                        codeLocations: [{ file: filePath, startLine: 11, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Should have: line 6 (before marker) and line 10 (different rule)
            const violations = results.getViolations();
            expect(violations.length).toBe(2);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(6);
            expect(violations[1].getPrimaryLocation().getStartLine()).toBe(10);
        });

        it('should re-enable violations with unsuppress marker', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            // File has: suppress(stubEngine1:stub1RuleA) on line 6, unsuppress on line 9
            const filePath = path.join(testDataDir, 'e2e-file-with-unsuppress.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 7 (after suppress, before unsuppress)',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 10 (after unsuppress)',
                        codeLocations: [{ file: filePath, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Line 7 suppressed, line 10 NOT suppressed
            const violations = results.getViolations();
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(10);
        });

        it('should suppress violations with specified severities', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            // File has: suppress(stubEngine1:(3,4)) - suppresses Moderate and Low
            const filePath = path.join(testDataDir, 'e2e-file-with-suppress-severity.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA', // Severity 4 (Low) - should be suppressed
                        message: 'Low severity on line 8',
                        codeLocations: [{ file: filePath, startLine: 8, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB', // Severity 2 (High) - should NOT be suppressed
                        message: 'High severity on line 9',
                        codeLocations: [{ file: filePath, startLine: 9, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Only High severity (line 9) should remain
            const violations = results.getViolations();
            expect(violations.length).toBe(1);
            expect(violations[0].getRule().getSeverityLevel()).toBe(SeverityLevel.High);
        });

        it('should apply hierarchical specificity rules correctly', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            // File has: suppress(all) on line 6, unsuppress(stubEngine1:stub1RuleA) on line 9
            const filePath = path.join(testDataDir, 'e2e-file-with-hierarchical-suppressions.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 7 (suppressed by all)',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 10 (unsuppressed - higher specificity)',
                        codeLocations: [{ file: filePath, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Line 12 (still suppressed by all)',
                        codeLocations: [{ file: filePath, startLine: 12, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Only line 10 should remain (unsuppress with higher specificity)
            const violations = results.getViolations();
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(10);
        });

        it('should have no effect when only unsuppress markers are present', async () => {
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            // File has only unsuppress markers, no suppress markers
            const filePath = path.join(testDataDir, 'e2e-file-with-only-unsuppress.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 7 (before unsuppress)',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 10 (after unsuppress - no effect)',
                        codeLocations: [{ file: filePath, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Line 13 (after unsuppress(all) - no effect)',
                        codeLocations: [{ file: filePath, startLine: 13, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // All violations should remain - unsuppress without suppress has no effect
            const violations = results.getViolations();
            expect(violations.length).toBe(3);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(7);
            expect(violations[1].getPrimaryLocation().getStartLine()).toBe(10);
            expect(violations[2].getPrimaryLocation().getStartLine()).toBe(13);
        });

        it('should create exception range with nested suppress/unsuppress against broader suppress', async () => {
            // Regression test: suppress(all) -> suppress(specific) -> unsuppress(specific)
            // After unsuppress, specific rule should NOT be suppressed by broader suppress(all)
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const filePath = path.join(testDataDir, 'e2e-file-with-nested-suppress-unsuppress.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 10 (suppressed by all)',
                        codeLocations: [{ file: filePath, startLine: 10, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 13 (suppressed by specific)',
                        codeLocations: [{ file: filePath, startLine: 13, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Line 16 (after unsuppress - should NOT be suppressed)',
                        codeLocations: [{ file: filePath, startLine: 16, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Line 19 (different rule - still suppressed by all)',
                        codeLocations: [{ file: filePath, startLine: 19, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Critical: Line 16 should NOT be suppressed
            // unsuppress(stubEngine1:stub1RuleA) creates exception range against suppress(all)
            const violations = results.getViolations();
            expect(violations.length).toBe(1);
            expect(violations[0].getPrimaryLocation().getStartLine()).toBe(16);
            expect(violations[0].getRule().getName()).toBe('stub1RuleA');
        });
    });

    describe('with suppressions disabled', () => {
        it('should report all violations when suppressions are disabled', async () => {
            // Create CodeAnalyzer with suppressions DISABLED
            const config = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: true }, // Explicitly disabled
                log_level: 'error'
            });
            const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
            const plugin = new stubs.StubEnginePlugin();
            await codeAnalyzer.addEnginePlugin(plugin);

            const filePath = path.join(testDataDir, 'file-with-suppress-all.js');
            const workspace = await codeAnalyzer.createWorkspace([filePath]);
            const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });

            const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation 1',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    },
                    {
                        ruleName: 'stub1RuleB',
                        message: 'Violation 2',
                        codeLocations: [{ file: filePath, startLine: 8, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };

            const results = await codeAnalyzer.run(ruleSelection, { workspace });

            // Should have all violations even though file has suppress(all)
            const violations = results.getViolations();
            expect(violations.length).toBe(2);
        });
    });

    describe('comparing with and without suppressions', () => {
        it('should have fewer violations with suppressions than without', async () => {
            // Create two analyzers - one with, one without suppressions
            const configWith = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: false },
                log_level: 'error'
            });
            const configWithout = CodeAnalyzerConfig.fromObject({
                suppressions: { disable_suppressions: true },
                log_level: 'error'
            });

            const analyzerWith = new CodeAnalyzer(configWith, new FakeFileSystem());
            const analyzerWithout = new CodeAnalyzer(configWithout, new FakeFileSystem());

            // Add plugins to both
            const pluginWith = new stubs.StubEnginePlugin();
            const pluginWithout = new stubs.StubEnginePlugin();
            await analyzerWith.addEnginePlugin(pluginWith);
            await analyzerWithout.addEnginePlugin(pluginWithout);

            const filePath = path.join(testDataDir, 'file-with-suppress-all.js');

            // Run with suppressions
            const workspaceWith = await analyzerWith.createWorkspace([filePath]);
            const ruleSelectionWith = await analyzerWith.selectRules(['stubEngine1'], { workspace: workspaceWith });
            const stubEngine1With = pluginWith.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1With.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };
            const resultsWith = await analyzerWith.run(ruleSelectionWith, { workspace: workspaceWith });

            // Run without suppressions
            const workspaceWithout = await analyzerWithout.createWorkspace([filePath]);
            const ruleSelectionWithout = await analyzerWithout.selectRules(['stubEngine1'], { workspace: workspaceWithout });
            const stubEngine1Without = pluginWithout.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
            stubEngine1Without.resultsToReturn = {
                violations: [
                    {
                        ruleName: 'stub1RuleA',
                        message: 'Violation',
                        codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                        primaryLocationIndex: 0
                    }
                ]
            };
            const resultsWithout = await analyzerWithout.run(ruleSelectionWithout, { workspace: workspaceWithout });

            // With suppressions: 0 violations
            // Without suppressions: 1 violation
            expect(resultsWith.getViolations().length).toBe(0);
            expect(resultsWithout.getViolations().length).toBe(1);
        });
    });
});
