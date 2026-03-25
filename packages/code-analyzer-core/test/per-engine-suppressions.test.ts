/**
 * Unit tests for per-engine suppression processing
 * Tests the new architecture where suppressions are applied before EngineResultsEvent emission
 */

import * as path from 'node:path';
import { CodeAnalyzer, CodeAnalyzerConfig, EngineResultsEvent, EventType, LogEvent, LogLevel } from '../src';
import * as stubs from './stubs';
import { changeWorkingDirectoryToPackageRoot, FakeFileSystem } from './test-helpers';

changeWorkingDirectoryToPackageRoot();

describe('Per-Engine Suppression Processing', () => {
    const testDataDir = path.resolve(__dirname, 'test-data', 'suppression-markers');

    it('should emit EngineResultsEvent with already-suppressed violations', async () => {
        // Setup
        const config = CodeAnalyzerConfig.fromObject({
            suppressions: { disable_suppressions: false },
            log_level: 'error'
        });
        const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
        const plugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(plugin);

        const filePath = path.join(testDataDir, 'file-with-suppress-all.js');
        const workspace = await codeAnalyzer.createWorkspace([filePath]);

        // Listen to EngineResultsEvent
        const engineResultsEvents: EngineResultsEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineResultsEvent, (event: EngineResultsEvent) => {
            engineResultsEvents.push(event);
        });

        // Configure engine to return violations (lines 7, 8, 9)
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
                }
            ]
        };

        // Execute
        const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });
        await codeAnalyzer.run(ruleSelection, { workspace });

        // Verify EngineResultsEvent was emitted with filtered violations
        expect(engineResultsEvents.length).toBe(1);
        const event = engineResultsEvents[0];
        expect(event.results.getEngineName()).toBe('stubEngine1');

        // The event should contain 0 violations because file has suppress(all) on line 4
        expect(event.results.getViolations().length).toBe(0);
    });

    it('should cache suppression data across multiple engines processing the same file', async () => {
        // Setup
        const config = CodeAnalyzerConfig.fromObject({
            suppressions: { disable_suppressions: false },
            log_level: 'error'
        });
        const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
        const plugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(plugin);

        const filePath = path.join(testDataDir, 'file-with-suppress-all.js');
        const workspace = await codeAnalyzer.createWorkspace([filePath]);

        // Configure both engines to return violations for the same file
        const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        const stubEngine2 = plugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;

        stubEngine1.resultsToReturn = {
            violations: [
                {
                    ruleName: 'stub1RuleA',
                    message: 'Violation from engine1',
                    codeLocations: [{ file: filePath, startLine: 7, startColumn: 1 }],
                    primaryLocationIndex: 0
                }
            ]
        };

        stubEngine2.resultsToReturn = {
            violations: [
                {
                    ruleName: 'stub2RuleA',
                    message: 'Violation from engine2',
                    codeLocations: [{ file: filePath, startLine: 8, startColumn: 1 }],
                    primaryLocationIndex: 0
                }
            ]
        };

        // Execute with both engines
        const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1', 'stubEngine2'], { workspace });
        const results = await codeAnalyzer.run(ruleSelection, { workspace });

        // Verify both engines' violations were suppressed (file has suppress(all))
        expect(results.getViolationCount()).toBe(0);
        expect(results.getEngineRunResults('stubEngine1').getViolationCount()).toBe(0);
        expect(results.getEngineRunResults('stubEngine2').getViolationCount()).toBe(0);
    });

    it('should log aggregate suppressed violations count at Info level', async () => {
        // Setup
        const config = CodeAnalyzerConfig.fromObject({
            suppressions: { disable_suppressions: false },
            log_level: 'info' // Set to info to capture the log
        });
        const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
        const plugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(plugin);

        const filePath = path.join(testDataDir, 'file-with-suppress-all.js');
        const workspace = await codeAnalyzer.createWorkspace([filePath]);

        // Listen to LogEvent
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => {
            if (event.logLevel === LogLevel.Info && event.message.includes('suppressed')) {
                logEvents.push(event);
            }
        });

        // Configure engine to return violations
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

        // Execute
        const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });
        await codeAnalyzer.run(ruleSelection, { workspace });

        // Verify aggregate log message was emitted
        expect(logEvents.length).toBeGreaterThan(0);
        const suppressionLog = logEvents.find(e => e.message.includes('2 violation(s) were suppressed'));
        expect(suppressionLog).toBeDefined();
    });

    it('should log "No violations were suppressed" when no suppressions apply', async () => {
        // Setup
        const config = CodeAnalyzerConfig.fromObject({
            suppressions: { disable_suppressions: false },
            log_level: 'info'
        });
        const codeAnalyzer = new CodeAnalyzer(config, new FakeFileSystem());
        const plugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(plugin);

        const filePath = path.join(testDataDir, 'file-without-markers.js');
        const workspace = await codeAnalyzer.createWorkspace([filePath]);

        // Listen to LogEvent
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => {
            if (event.logLevel === LogLevel.Info && event.message.includes('suppressed')) {
                logEvents.push(event);
            }
        });

        // Configure engine to return violations
        const stubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        stubEngine1.resultsToReturn = {
            violations: [
                {
                    ruleName: 'stub1RuleA',
                    message: 'Violation',
                    codeLocations: [{ file: filePath, startLine: 5, startColumn: 1 }],
                    primaryLocationIndex: 0
                }
            ]
        };

        // Execute
        const ruleSelection = await codeAnalyzer.selectRules(['stubEngine1'], { workspace });
        await codeAnalyzer.run(ruleSelection, { workspace });

        // Verify "No violations were suppressed" log was emitted
        expect(logEvents.length).toBeGreaterThan(0);
        const noSuppressionLog = logEvents.find(e => e.message.includes('No violations were suppressed'));
        expect(noSuppressionLog).toBeDefined();
    });
});
