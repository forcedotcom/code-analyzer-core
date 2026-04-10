/**
 * Unit tests for bulk-suppression-processor.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
    applyBulkSuppressions,
    BulkSuppressionQuotas
} from '../../src/suppressions/bulk-suppression-processor';
import { BulkSuppressionRule } from '../../src/config';
import { Violation, CodeLocation } from '../../src/results';
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
        private severityLevel: SeverityLevel = SeverityLevel.High,
        private tags: string[] = []
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
        return this.tags;
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

    getFixes(): any[] {
        return [];
    }

    getSuggestions(): any[] {
        return [];
    }
}

describe('applyBulkSuppressions', () => {
    const workspaceRoot = '/workspace';

    describe('Basic suppression scenarios', () => {
        it('should suppress violations matching rule selector with no quota limit', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(0);
            expect(result.suppressedCount).toBe(2);
            // Quota key uses config path with rule index
            expect(quotas.get('src/file1.apex|0|pmd:UnusedMethod')).toBe(2);
        });

        it('should suppress violations up to quota limit', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 30, 1, 30, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: 2
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(2);
            expect(result.unsuppressedViolations[0].getPrimaryLocation().getStartLine()).toBe(30);
            // Quota key uses config path with rule index
            expect(quotas.get('src/file1.apex|0|pmd:UnusedMethod')).toBe(2);
        });

        it('should not suppress violations when quota is already exhausted', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: 1
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            // Quota key uses config path with rule index
            quotas.set('src/file1.apex|0|pmd:UnusedMethod', 1); // Quota already used

            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(0);
            expect(quotas.get('src/file1.apex|0|pmd:UnusedMethod')).toBe(1);
        });

        it('should not suppress violations that do not match rule selector', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-unused-vars'),
                    'Unused variable',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(1);
            expect(result.unsuppressedViolations[0].getRule().getEngineName()).toBe('eslint');
        });
    });

    describe('File path matching', () => {
        it('should match violations in exact file path', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(1);
        });

        it('should match violations in folder path', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/folder/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/folder/file2.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/folder': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(2);
        });

        it('should not match violations outside the configured path', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/other/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/folder': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(0);
            expect(result.unsuppressedViolations).toHaveLength(1);
        });

        it('should NOT support absolute paths in config (relative paths only)', () => {
            // Config paths must be relative to workspace root
            // Absolute paths in config are not supported (similar to .gitignore)
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                '/workspace/src/file1.apex': [  // Absolute path - not supported
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            // Should NOT suppress - absolute paths in config are not supported
            expect(result.suppressedCount).toBe(0);
            expect(result.unsuppressedViolations).toHaveLength(1);
        });
    });

    describe('Rule selector matching', () => {
        it('should match violations by engine name', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-unused-vars'),
                    'Unused variable',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(1);
            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.unsuppressedViolations[0].getRule().getEngineName()).toBe('eslint');
        });

        it('should match violations by engine:rule', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedVariable'),
                    'Unused variable',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(1);
            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.unsuppressedViolations[0].getRule().getName()).toBe('UnusedVariable');
        });

        it('should match violations by severity level', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'Rule1', SeverityLevel.High),
                    'High severity',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'Rule2', SeverityLevel.Moderate),
                    'Moderate severity',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'Rule3', SeverityLevel.Low),
                    'Low severity',
                    new MockCodeLocation('/workspace/src/file1.apex', 30, 1, 30, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: '3,4',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(2);
            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.unsuppressedViolations[0].getRule().getSeverityLevel()).toBe(SeverityLevel.High);
        });

        it('should match violations by tag', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'Rule1', SeverityLevel.High, ['Recommended']),
                    'Tagged violation',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'Rule2', SeverityLevel.High, ['Security']),
                    'Security violation',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'Recommended',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(1);
            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.unsuppressedViolations[0].getRule().getTags()).toContain('Security');
        });
    });

    describe('Multiple rules per file', () => {
        it('should apply multiple rules to the same file', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('eslint', 'no-unused-vars'),
                    'Unused variable',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    },
                    {
                        rule_selector: 'eslint',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(2);
            expect(result.unsuppressedViolations).toHaveLength(0);
        });

        it('should apply first matching rule when multiple rules match', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: 1
                    },
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: 1
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(1);
            // Quota key uses config path with rule index (first rule at index 0 is used)
            expect(quotas.get('src/file1.apex|0|pmd')).toBe(1);
            expect(quotas.get('src/file1.apex|1|pmd:UnusedMethod')).toBeUndefined();
        });
    });

    describe('Deterministic ordering', () => {
        it('should process violations in deterministic order (file, then line)', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file2.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: 2
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.suppressedCount).toBe(2);
            expect(result.unsuppressedViolations).toHaveLength(1);
            // Should suppress file1:10 and file1:20 (sorted by file, then line)
            expect(result.unsuppressedViolations[0].getPrimaryLocation().getFile()).toBe('/workspace/src/file2.apex');
        });
    });

    describe('Quota tracking across engines', () => {
        it('should share quota across multiple files in same folder', () => {
            // Critical test: Folder-level quota should be shared across all files in folder
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method in file1',
                    new MockCodeLocation('/workspace/src/controllers/file1.apex', 10, 1, 10, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method in file2',
                    new MockCodeLocation('/workspace/src/controllers/file2.apex', 20, 1, 20, 20)
                ),
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method in file3',
                    new MockCodeLocation('/workspace/src/controllers/file3.apex', 30, 1, 30, 20)
                )
            ];

            const bulkConfig = {
                'src/controllers': [  // Folder-level suppression
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: 2  // Total across ALL files in folder
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            // Should suppress first 2 violations (across different files), reject 3rd
            expect(result.suppressedCount).toBe(2);
            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.unsuppressedViolations[0].getPrimaryLocation().getFile()).toBe('/workspace/src/controllers/file3.apex');

            // Quota is shared at folder level, not per-file (rule index 0)
            expect(quotas.get('src/controllers|0|pmd:UnusedMethod')).toBe(2);
        });

        it('should maintain quota state across multiple calls', () => {
            const violations1 = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const violations2 = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 20, 1, 20, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd:UnusedMethod',
                        max_suppressed_violations: 1
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();

            // First call - should suppress
            const result1 = applyBulkSuppressions(violations1, bulkConfig, quotas, workspaceRoot);
            expect(result1.suppressedCount).toBe(1);
            // Quota key uses config path with rule index
            expect(quotas.get('src/file1.apex|0|pmd:UnusedMethod')).toBe(1);

            // Second call - quota exhausted, should not suppress
            const result2 = applyBulkSuppressions(violations2, bulkConfig, quotas, workspaceRoot);
            expect(result2.suppressedCount).toBe(0);
            expect(result2.unsuppressedViolations).toHaveLength(1);
        });
    });

    describe('Edge cases', () => {
        it('should return all violations when bulkConfig is empty', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, {}, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(0);
        });

        it('should return early when violations array is empty', () => {
            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions([], bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(0);
            expect(result.suppressedCount).toBe(0);
        });

        it('should skip violations without file path', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation(undefined, 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(0);
        });

        it('should handle invalid rule selector gracefully', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'invalid:::selector',
                        max_suppressed_violations: null
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            // Should not suppress due to invalid selector
            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(0);
        });

        it('should handle max_suppressed_violations of 0', () => {
            const violations = [
                new MockViolation(
                    new MockRule('pmd', 'UnusedMethod'),
                    'Unused method',
                    new MockCodeLocation('/workspace/src/file1.apex', 10, 1, 10, 20)
                )
            ];

            const bulkConfig = {
                'src/file1.apex': [
                    {
                        rule_selector: 'pmd',
                        max_suppressed_violations: 0
                    }
                ]
            };

            const quotas: BulkSuppressionQuotas = new Map();
            const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot);

            expect(result.unsuppressedViolations).toHaveLength(1);
            expect(result.suppressedCount).toBe(0);
        });
    });
});
