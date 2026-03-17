/**
 * Integration tests for suppression markers with actual test files
 * Tests end-to-end suppression behavior with files containing markers
 */

import * as path from 'node:path';
import { processSuppressions } from '../src/suppressions/suppression-processor';
import { Violation } from '../src/results';
import { Rule } from '../src/rules';
import { SeverityLevel } from '@salesforce/code-analyzer-engine-api';

// Mock implementations
class MockRule implements Rule {
    constructor(
        private engineName: string,
        private name: string,
        private severityLevel: SeverityLevel
    ) {}

    getEngineName(): string { return this.engineName; }
    getName(): string { return this.name; }
    getSeverityLevel(): SeverityLevel { return this.severityLevel; }
    getTags(): string[] { return []; }
    getDescription(): string { return ''; }
    getResourceUrls(): string[] { return []; }
}

class MockCodeLocation {
    constructor(
        private file: string,
        private startLine: number,
        private endLine?: number
    ) {}

    getFile(): string { return this.file; }
    getStartLine(): number { return this.startLine; }
    getEndLine(): number | undefined { return this.endLine; }
    getStartColumn(): number { return 1; }
    getEndColumn(): number | undefined { return undefined; }
    getComment(): string | undefined { return undefined; }
}

class MockViolation implements Violation {
    constructor(
        private rule: Rule,
        private message: string,
        private primaryLocation: MockCodeLocation
    ) {}

    getRule(): Rule { return this.rule; }
    getMessage(): string { return this.message; }
    getPrimaryLocation(): MockCodeLocation { return this.primaryLocation; }
    getCodeLocations(): MockCodeLocation[] { return [this.primaryLocation]; }
    getPrimaryLocationIndex(): number { return 0; }
    getResourceUrls(): string[] { return []; }
}

describe('Suppression Markers Integration Tests', () => {
    const testDataDir = path.resolve(__dirname, 'test-data', 'suppression-markers');

    describe('suppress(all) marker', () => {
        it('should suppress all violations after the marker', async () => {
            const filePath = path.join(testDataDir, 'file-with-suppress-all.js');

            // Create violations at different lines
            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate),
                    'No magic numbers',
                    new MockCodeLocation(filePath, 7) // After suppress(all) on line 6
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 8) // After suppress(all)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-eval', SeverityLevel.Critical),
                    'No eval',
                    new MockCodeLocation(filePath, 9) // After suppress(all)
                )
            ];

            const result = await processSuppressions(violations);

            // All violations should be suppressed
            expect(result.length).toBe(0);
        });
    });

    describe('suppress(engine) marker', () => {
        it('should suppress only violations from specified engine', async () => {
            const filePath = path.join(testDataDir, 'file-with-suppress-engine.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate),
                    'No magic numbers',
                    new MockCodeLocation(filePath, 6) // Before suppress(eslint) on line 7
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 9) // After suppress(eslint)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedVariable', SeverityLevel.Moderate),
                    'Unused variable',
                    new MockCodeLocation(filePath, 9) // After suppress(eslint), but pmd not suppressed
                )
            ];

            const result = await processSuppressions(violations);

            // Only the eslint violation before marker and pmd violation should remain
            expect(result.length).toBe(2);
            expect(result[0].getRule().getName()).toBe('no-magic-numbers'); // Before marker
            expect(result[1].getRule().getEngineName()).toBe('pmd'); // Different engine
        });
    });

    describe('suppress(engine:rule) marker', () => {
        it('should suppress only specific rule violations', async () => {
            const filePath = path.join(testDataDir, 'file-with-suppress-specific-rule.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 6) // Before suppress marker
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 9) // After suppress(eslint:no-console)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate),
                    'No magic numbers',
                    new MockCodeLocation(filePath, 10) // After suppress, but different rule
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 11) // After suppress(eslint:no-console)
                )
            ];

            const result = await processSuppressions(violations);

            // Should have: line 6 (before marker) and line 10 (different rule)
            expect(result.length).toBe(2);
            expect(result[0].getPrimaryLocation().getStartLine()).toBe(6);
            expect(result[1].getRule().getName()).toBe('no-magic-numbers');
        });
    });

    describe('unsuppress marker', () => {
        it('should re-enable violation reporting after unsuppress', async () => {
            const filePath = path.join(testDataDir, 'file-with-unsuppress.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 7) // After suppress, before unsuppress
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 10) // After unsuppress
                )
            ];

            const result = await processSuppressions(violations);

            // Line 7 should be suppressed, line 10 should NOT be suppressed
            expect(result.length).toBe(1);
            expect(result[0].getPrimaryLocation().getStartLine()).toBe(10);
        });
    });

    describe('suppress by severity', () => {
        it('should suppress violations with specified severities', async () => {
            const filePath = path.join(testDataDir, 'file-with-suppress-severity.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate), // Severity 3
                    'No magic numbers',
                    new MockCodeLocation(filePath, 8)
                ),
                new MockViolation(
                    new MockRule('eslint', 'some-low-rule', SeverityLevel.Low), // Severity 4
                    'Low severity',
                    new MockCodeLocation(filePath, 9)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-eval', SeverityLevel.High), // Severity 2
                    'No eval',
                    new MockCodeLocation(filePath, 10)
                )
            ];

            const result = await processSuppressions(violations);

            // Only severity 2 (High) should remain (severities 3 and 4 suppressed)
            expect(result.length).toBe(1);
            expect(result[0].getRule().getSeverityLevel()).toBe(SeverityLevel.High);
        });
    });

    describe('case-insensitive markers', () => {
        it('should work with markers in any case', async () => {
            const filePath = path.join(testDataDir, 'file-with-case-insensitive.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 7) // After Code-Analyzer-Suppress
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 10) // After CODE-ANALYZER-UNSUPPRESS
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 13) // After code-analyzer-SUPPRESS
                )
            ];

            const result = await processSuppressions(violations);

            // Line 10 should remain (after unsuppress), others suppressed
            expect(result.length).toBe(1);
            expect(result[0].getPrimaryLocation().getStartLine()).toBe(10);
        });
    });

    describe('hierarchical suppressions with specificity', () => {
        it('should apply specificity rules correctly', async () => {
            const filePath = path.join(testDataDir, 'file-with-hierarchical-suppressions.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 7) // After suppress(all)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 10) // After unsuppress(eslint:no-console) - higher specificity
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate),
                    'No magic numbers',
                    new MockCodeLocation(filePath, 12) // After unsuppress(eslint:no-console), still suppressed by 'all'
                )
            ];

            const result = await processSuppressions(violations);

            // Line 10 should remain (unsuppress with higher specificity wins)
            // Lines 7 and 12 should be suppressed (still covered by 'all')
            expect(result.length).toBe(1);
            expect(result[0].getPrimaryLocation().getStartLine()).toBe(10);
        });
    });

    describe('file without markers', () => {
        it('should report all violations when no markers present', async () => {
            const filePath = path.join(testDataDir, 'file-without-markers.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate),
                    'No magic numbers',
                    new MockCodeLocation(filePath, 6)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 7)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-eval', SeverityLevel.Critical),
                    'No eval',
                    new MockCodeLocation(filePath, 8)
                )
            ];

            const result = await processSuppressions(violations);

            // All violations should remain (no suppressions)
            expect(result.length).toBe(3);
        });
    });

    describe('multiple files with mixed suppressions', () => {
        it('should handle suppressions independently per file', async () => {
            const file1 = path.join(testDataDir, 'file-with-suppress-all.js');
            const file2 = path.join(testDataDir, 'file-without-markers.js');

            const violations: Violation[] = [
                // File 1: suppress(all) - should be suppressed
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(file1, 8)
                ),
                // File 2: no markers - should remain
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(file2, 7)
                )
            ];

            const result = await processSuppressions(violations);

            // Only file2 violation should remain
            expect(result.length).toBe(1);
            expect(result[0].getPrimaryLocation().getFile()).toBe(file2);
        });
    });

    describe('violations before marker', () => {
        it('should not suppress violations that occur before the marker', async () => {
            const filePath = path.join(testDataDir, 'file-with-suppress-engine.js');

            const violations: Violation[] = [
                new MockViolation(
                    new MockRule('eslint', 'no-magic-numbers', SeverityLevel.Moderate),
                    'No magic numbers',
                    new MockCodeLocation(filePath, 6) // Before suppress(eslint) on line 7
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-console', SeverityLevel.High),
                    'No console',
                    new MockCodeLocation(filePath, 9) // After suppress(eslint)
                )
            ];

            const result = await processSuppressions(violations);

            // Violation on line 6 should remain (before marker)
            expect(result.length).toBe(1);
            expect(result[0].getPrimaryLocation().getStartLine()).toBe(6);
        });
    });
});
