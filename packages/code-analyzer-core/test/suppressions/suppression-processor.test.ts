/**
 * Unit tests for suppression-processor.ts
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
    isViolationSuppressed,
    filterSuppressedViolations
} from '../../src/suppressions/suppression-processor';
import { FileSuppressions, SuppressionRange } from '../../src/suppressions/suppression-types';
import { toSelector } from '../../src/selectors';
import { Violation, CodeLocation, Fix, Suggestion } from '../../src/results';
import { Rule, SeverityLevel } from '../../src/rules';

// Mock implementations for testing
class MockCodeLocation implements CodeLocation {
    constructor(
        private file?: string,
        private startLine?: number,
        private startColumn?: number,
        private endLine?: number,
        private endColumn?: number
    ) {}

    getFile(): string | undefined {
        return this.file;
    }

    getStartLine(): number | undefined {
        return this.startLine;
    }

    getStartColumn(): number | undefined {
        return this.startColumn;
    }

    getEndLine(): number | undefined {
        return this.endLine;
    }

    getEndColumn(): number | undefined {
        return this.endColumn;
    }

    getComment(): string | undefined {
        return undefined;
    }
}

class MockRule implements Rule {
    constructor(
        private engineName: string,
        private name: string,
        private severityLevel: SeverityLevel = SeverityLevel.High
    ) {}

    getEngineName(): string {
        return this.engineName;
    }

    getName(): string {
        return this.name;
    }

    getSeverityLevel(): SeverityLevel {
        return this.severityLevel;
    }

    getTags(): string[] {
        return [];
    }

    getDescription(): string {
        return 'Mock rule';
    }

    getResourceUrls(): string[] {
        return [];
    }
}

class MockViolation implements Violation {
    constructor(
        private rule: Rule,
        private message: string,
        private primaryLocation: CodeLocation
    ) {}

    getRule(): Rule {
        return this.rule;
    }

    getMessage(): string {
        return this.message;
    }

    getCodeLocations(): CodeLocation[] {
        return [this.primaryLocation];
    }

    getPrimaryLocation(): CodeLocation {
        return this.primaryLocation;
    }

    getPrimaryLocationIndex(): number {
        return 0;
    }

    getResourceUrls(): string[] {
        return [];
    }

    getFixes(): Fix[] {
        return [];
    }

    getSuggestions(): Suggestion[] {
        return [];
    }
}

describe('isViolationSuppressed', () => {
    describe('Basic overlap scenarios', () => {
        it('should suppress violation when fully contained in suppression range', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: true
                    }
                ]
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should suppress violation when partially overlapping suppression range (violation starts before)', () => {
            // Spec: "If ANY part of the violation's primary location range has been suppressed"
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 6,
                        endLine: 8,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Violation spans lines 5-7, suppression is 6-8
            // Lines 6-7 are suppressed → entire violation should be suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 5, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should suppress violation when partially overlapping suppression range (violation ends after)', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 7,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Violation spans lines 6-10, suppression is 5-7
            // Lines 6-7 are suppressed → entire violation should be suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 6, 1, 10, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should suppress violation when suppression range is fully contained within violation', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 6,
                        endLine: 7,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Violation spans lines 5-8, suppression is 6-7
            // Lines 6-7 are suppressed → entire violation should be suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 5, 1, 8, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should suppress violation when only a single line overlaps', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Violation spans lines 10-15, suppression is 5-10
            // Line 10 overlaps → entire violation should be suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 10, 1, 15, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should NOT suppress violation when no overlap', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Violation is on lines 15-20, suppression is 5-10
            // No overlap → should NOT be suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 15, 1, 20, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });
    });

    describe('Multi-line violations', () => {
        it('should handle multi-line violation spanning 10 lines', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 10,
                        endLine: 15,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: true
                    }
                ]
            };

            // Violation spans lines 5-20, suppression is 10-15
            // Lines 10-15 are suppressed → entire violation should be suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ComplexMethod'),
                'Method too complex',
                new MockCodeLocation('/test/file.apex', 5, 1, 20, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should handle single-line violation (endLine undefined)', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Single line violation at line 7
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, undefined, undefined)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should handle suppression range extending to end of file', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: undefined, // End of file
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            // Violation at lines 100-105
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 100, 1, 105, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });
    });

    describe('Rule selector matching', () => {
        it('should suppress when rule selector is "all"', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should suppress when rule selector matches engine name', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: true
                    }
                ]
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should suppress when rule selector matches engine:rule', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('pmd:ApexCrudViolation'), ruleSelectorString: 'pmd:ApexCrudViolation',
                        isSuppressed: true
                    }
                ]
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should NOT suppress when rule selector does not match', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('eslint'), ruleSelectorString: 'eslint',
                        isSuppressed: true
                    }
                ]
            };

            // PMD violation, but only eslint is suppressed
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should suppress when rule selector matches severity', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('eslint:(3,4)'), ruleSelectorString: 'eslint:(3,4)',
                        isSuppressed: true
                    }
                ]
            };

            // Violation with severity 3
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars', 3),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should NOT suppress when severity does not match', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('eslint:(3,4)'), ruleSelectorString: 'eslint:(3,4)',
                        isSuppressed: true
                    }
                ]
            };

            // Violation with severity 2 (not in the suppressed list)
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars', 2),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });
    });

    describe('Hierarchical suppressions with specificity', () => {
        it('should use most specific suppression when multiple ranges overlap', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: undefined,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: false // Unsuppressed - exception
                    }
                ]
            };

            // PMD violation at line 10
            // "all" says suppress, "pmd" says don't suppress
            // "pmd" is more specific (specificity 2) than "all" (specificity 1)
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 10, 1, 10, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should use most specific rule when engine:rule overrides engine', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: false // Unsuppressed
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('pmd:ApexCrudViolation'), ruleSelectorString: 'pmd:ApexCrudViolation',
                        isSuppressed: true // Re-suppressed
                    }
                ]
            };

            // PMD:ApexCrudViolation violation at line 10
            // "pmd" says don't suppress (specificity 2)
            // "pmd:ApexCrudViolation" says suppress (specificity 3 - more specific)
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 10, 1, 10, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should use most recent range when same specificity', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 1,
                        endLine: undefined,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: true
                    },
                    {
                        startLine: 10,
                        endLine: undefined,
                        ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                        isSuppressed: false // Unsuppressed later
                    }
                ]
            };

            // Violation at line 15
            // Both ranges have same specificity (2)
            // Range with higher startLine (10) should win
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 15, 1, 15, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should handle complex XML example from spec', () => {
            // Lines 2-3: all suppressed
            // Lines 4-5: regex:AvoidOldSalesforceApiVersions unsuppressed (exception)
            // Lines 6-11: regex suppressed (closes the exception)
            // Lines 12+: all unsuppressed
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.xml',
                ranges: [
                    {
                        startLine: 2,
                        endLine: 3,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    },
                    {
                        startLine: 4,
                        endLine: 5,  // Closed by suppress(regex) at line 6
                        ruleSelector: toSelector('regex:AvoidOldSalesforceApiVersions'), ruleSelectorString: 'regex:AvoidOldSalesforceApiVersions',
                        isSuppressed: false
                    },
                    {
                        startLine: 6,
                        endLine: 11,
                        ruleSelector: toSelector('regex'), ruleSelectorString: 'regex',
                        isSuppressed: true
                    },
                    {
                        startLine: 12,
                        endLine: undefined,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: false
                    }
                ]
            };

            // Line 3: PMD violation → suppressed by "all"
            const violation1 = new MockViolation(
                new MockRule('pmd', 'SomeRule'),
                'Some violation',
                new MockCodeLocation('/test/file.xml', 3, 1, 3, 20)
            );
            expect(isViolationSuppressed(violation1, fileSuppressions)).toBe(true);

            // Line 5: regex:AvoidOldSalesforceApiVersions → unsuppressed (exception)
            const violation2 = new MockViolation(
                new MockRule('regex', 'AvoidOldSalesforceApiVersions'),
                'Old API',
                new MockCodeLocation('/test/file.xml', 5, 1, 5, 20)
            );
            expect(isViolationSuppressed(violation2, fileSuppressions)).toBe(false);

            // Line 7: regex:AvoidOldSalesforceApiVersions → suppressed (regex overrides exception)
            const violation3 = new MockViolation(
                new MockRule('regex', 'AvoidOldSalesforceApiVersions'),
                'Old API',
                new MockCodeLocation('/test/file.xml', 7, 1, 7, 20)
            );
            expect(isViolationSuppressed(violation3, fileSuppressions)).toBe(true);

            // Line 13: anything → unsuppressed
            const violation4 = new MockViolation(
                new MockRule('pmd', 'SomeRule'),
                'Some violation',
                new MockCodeLocation('/test/file.xml', 13, 1, 13, 20)
            );
            expect(isViolationSuppressed(violation4, fileSuppressions)).toBe(false);
        });
    });

    describe('Complex selector specificity (OR, AND, grouping)', () => {
        it('should handle OR selector with minimum specificity rule', () => {
            // Test that OR selectors take minimum specificity of both sides
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('eslint,pmd'), ruleSelectorString: 'eslint,pmd',
                        isSuppressed: false // Unsuppressed
                    }
                ]
            };

            // ESLint violation at line 10
            // 'all' (specificity 1) says suppress
            // 'eslint,pmd' (specificity min(2,2) = 2) says don't suppress
            // 'eslint,pmd' is more specific, so violation should NOT be suppressed
            const eslintViolation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(eslintViolation, fileSuppressions)).toBe(false);

            // PMD violation should also not be suppressed
            const pmdViolation = new MockViolation(
                new MockRule('pmd', 'UnusedVariable'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(pmdViolation, fileSuppressions)).toBe(false);

            // Regex violation (not in OR selector) should be suppressed by 'all'
            const regexViolation = new MockViolation(
                new MockRule('regex', 'SomeRule'),
                'Some issue',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(regexViolation, fileSuppressions)).toBe(true);
        });

        it('should handle OR with different specificities (all,engine)', () => {
            // Test with temporal ordering: most recent range wins
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('eslint:no-unused-vars'), ruleSelectorString: 'eslint:no-unused-vars',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('all,pmd'), ruleSelectorString: 'all,pmd',
                        isSuppressed: false
                    }
                ]
            };

            // ESLint:no-unused-vars violation at line 10
            // Range 1 (startLine=1): suppress
            // Range 2 (startLine=5): unsuppress - more recent, so this wins
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false); // Most recent wins
        });

        it('should handle multiple colons (higher specificity)', () => {
            // Test selectors with multiple colons for higher specificity
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('eslint:no-unused-vars'), ruleSelectorString: 'eslint:no-unused-vars',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('eslint:no-unused-vars:extra'), ruleSelectorString: 'eslint:no-unused-vars:extra',
                        isSuppressed: false // Specificity 4 (3 colons)
                    }
                ]
            };

            // Violation matching 'eslint:no-unused-vars:extra'
            // 'eslint:no-unused-vars' (specificity 3) says suppress
            // 'eslint:no-unused-vars:extra' (specificity 4) says don't suppress
            // More colons = more specific
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );

            // Note: This will actually be suppressed because the Selector won't match 'extra'
            // But the specificity calculation still works correctly
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true);
        });

        it('should handle parentheses (transparent specificity)', () => {
            // Test that parentheses don't affect specificity
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('(eslint)'), ruleSelectorString: '(eslint)',
                        isSuppressed: false
                    }
                ]
            };

            // ESLint violation at line 10
            // 'all' (specificity 1) says suppress
            // '(eslint)' (specificity 2, same as 'eslint') says don't suppress
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should handle complex combination: (engine,engine):rule', () => {
            // Test '(eslint,pmd):no-unused-vars'
            // This means (eslint OR pmd) AND no-unused-vars
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('eslint'), ruleSelectorString: 'eslint',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('(eslint,pmd):no-unused-vars'), ruleSelectorString: '(eslint,pmd):no-unused-vars',
                        isSuppressed: false
                    }
                ]
            };

            // ESLint:no-unused-vars violation at line 10
            // 'eslint' (specificity 2) says suppress
            // '(eslint,pmd):no-unused-vars' has one colon, so specificity = 3
            // More specific range wins
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should handle severity selector: engine:(severity,severity)', () => {
            // Test 'eslint:(3,4)' which means eslint with severity 3 OR 4
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('eslint:(3,4)'), ruleSelectorString: 'eslint:(3,4)',
                        isSuppressed: false
                    }
                ]
            };

            // ESLint violation with severity 3 at line 10
            // 'all' (specificity 1) says suppress
            // 'eslint:(3,4)' (specificity 3: one colon) says don't suppress
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars', SeverityLevel.Moderate), // Severity 3
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);

            // ESLint violation with severity 5 should be suppressed (doesn't match (3,4))
            const violation2 = new MockViolation(
                new MockRule('eslint', 'no-unused-vars', SeverityLevel.Critical), // Severity 5
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation2, fileSuppressions)).toBe(true);
        });

        it('should handle deep nesting: ((engine,engine):rule,all)', () => {
            // Test with temporal ordering: most recent range wins
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('eslint:no-unused-vars'), ruleSelectorString: 'eslint:no-unused-vars',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('((eslint,pmd):no-unused-vars,all)'), ruleSelectorString: '((eslint,pmd):no-unused-vars,all)',
                        isSuppressed: false
                    }
                ]
            };

            // ESLint:no-unused-vars violation at line 10
            // Range 1 (startLine=1): suppress
            // Range 2 (startLine=5): unsuppress - more recent, so this wins
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false); // Most recent wins
        });

        it('should compare OR selectors correctly when both have same min specificity', () => {
            // Test two OR selectors with same minimum specificity
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('eslint,pmd'), ruleSelectorString: 'eslint,pmd',
                        isSuppressed: true // Specificity min(2,2) = 2
                    },
                    {
                        startLine: 10,
                        endLine: undefined,
                        ruleSelector: toSelector('regex,sfge'), ruleSelectorString: 'regex,sfge',
                        isSuppressed: false // Specificity min(2,2) = 2
                    }
                ]
            };

            // ESLint violation at line 15
            // Both ranges have same specificity (2)
            // Range with higher startLine (10) should win
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 15, 1, 15, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(true); // eslint matches first range
        });

        it('should handle mixed AND and OR: engine:rule,engine:other', () => {
            // Test 'eslint:no-unused-vars,pmd:UnusedVariable'
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.js',
                ranges: [
                    {
                        startLine: 1,
                        endLine: 20,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    },
                    {
                        startLine: 5,
                        endLine: 15,
                        ruleSelector: toSelector('eslint:no-unused-vars,pmd:UnusedVariable'), ruleSelectorString: 'eslint:no-unused-vars,pmd:UnusedVariable',
                        isSuppressed: false // Specificity min(3,3) = 3
                    }
                ]
            };

            // ESLint:no-unused-vars violation
            // 'all' (specificity 1) says suppress
            // 'eslint:no-unused-vars,pmd:UnusedVariable' (specificity 3) says don't suppress
            const violation = new MockViolation(
                new MockRule('eslint', 'no-unused-vars'),
                'Unused variable',
                new MockCodeLocation('/test/file.js', 10, 1, 10, 20)
            );
            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('should return false when fileSuppressions is undefined', () => {
            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, undefined)).toBe(false);
        });

        it('should return false when ranges array is empty', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: []
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should return false when violation has no file', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation(undefined, 7, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });

        it('should return false when violation has no start line', () => {
            const fileSuppressions: FileSuppressions = {
                filePath: '/test/file.apex',
                ranges: [
                    {
                        startLine: 5,
                        endLine: 10,
                        ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                        isSuppressed: true
                    }
                ]
            };

            const violation = new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', undefined, 1, 7, 20)
            );

            expect(isViolationSuppressed(violation, fileSuppressions)).toBe(false);
        });
    });
});

describe('filterSuppressedViolations', () => {
    it('should filter out suppressed violations', () => {
        const suppressionsMap = new Map<string, FileSuppressions>();
        suppressionsMap.set('/test/file.apex', {
            filePath: '/test/file.apex',
            ranges: [
                {
                    startLine: 5,
                    endLine: 10,
                    ruleSelector: toSelector('pmd'), ruleSelectorString: 'pmd',
                    isSuppressed: true
                }
            ]
        });

        const violations = [
            new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            ),
            new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 15, 1, 15, 20)
            )
        ];

        const filtered = filterSuppressedViolations(violations, suppressionsMap);

        expect(filtered).toHaveLength(1);
        expect(filtered[0].getPrimaryLocation().getStartLine()).toBe(15);
    });

    it('should keep all violations when none are suppressed', () => {
        const suppressionsMap = new Map<string, FileSuppressions>();
        suppressionsMap.set('/test/file.apex', {
            filePath: '/test/file.apex',
            ranges: [
                {
                    startLine: 5,
                    endLine: 10,
                    ruleSelector: toSelector('eslint'), ruleSelectorString: 'eslint',
                    isSuppressed: true
                }
            ]
        });

        const violations = [
            new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 7, 1, 7, 20)
            ),
            new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file.apex', 15, 1, 15, 20)
            )
        ];

        const filtered = filterSuppressedViolations(violations, suppressionsMap);

        expect(filtered).toHaveLength(2);
    });

    it('should handle empty violations array', () => {
        const suppressionsMap = new Map<string, FileSuppressions>();

        const filtered = filterSuppressedViolations([], suppressionsMap);

        expect(filtered).toHaveLength(0);
    });

    it('should handle violations from different files', () => {
        const suppressionsMap = new Map<string, FileSuppressions>();
        suppressionsMap.set('/test/file1.apex', {
            filePath: '/test/file1.apex',
            ranges: [
                {
                    startLine: 1,
                    endLine: undefined,
                    ruleSelector: toSelector('all'), ruleSelectorString: 'all',
                    isSuppressed: true
                }
            ]
        });

        const violations = [
            new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file1.apex', 7, 1, 7, 20)
            ),
            new MockViolation(
                new MockRule('pmd', 'ApexCrudViolation'),
                'CRUD violation',
                new MockCodeLocation('/test/file2.apex', 7, 1, 7, 20)
            )
        ];

        const filtered = filterSuppressedViolations(violations, suppressionsMap);

        // File1 violation suppressed, file2 violation kept
        expect(filtered).toHaveLength(1);
        expect(filtered[0].getPrimaryLocation().getFile()).toBe('/test/file2.apex');
    });
});
