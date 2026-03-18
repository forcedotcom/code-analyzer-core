/**
 * Unit tests for suppression-parser.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
    parseSuppressionMarkers,
    buildSuppressionRanges,
    parseFileSuppressions
} from '../../src/suppressions/suppression-parser';
import { SuppressionMarker, SuppressionRange } from '../../src/suppressions/suppression-types';

describe('parseSuppressionMarkers', () => {
    it('should find suppress marker with explicit rule selector', () => {
        const content = '// code-analyzer-suppress(pmd:ApexCrudViolation)';
        const markers = parseSuppressionMarkers(content, '/test/file.apex');

        expect(markers).toHaveLength(1);
        expect(markers[0]).toEqual({
            type: 'suppress',
            ruleSelector: 'pmd:ApexCrudViolation',
            lineNumber: 1
        });
    });

    it('should find suppress marker with "all" as default when no rule selector', () => {
        const content = '// code-analyzer-suppress()';
        const markers = parseSuppressionMarkers(content, '/test/file.js');

        expect(markers).toHaveLength(1);
        expect(markers[0]).toEqual({
            type: 'suppress',
            ruleSelector: 'all',
            lineNumber: 1
        });
    });

    it('should find suppress marker without parentheses as "all"', () => {
        const content = '// code-analyzer-suppress';
        const markers = parseSuppressionMarkers(content, '/test/file.js');

        expect(markers).toHaveLength(1);
        expect(markers[0]).toEqual({
            type: 'suppress',
            ruleSelector: 'all',
            lineNumber: 1
        });
    });

    it('should find unsuppress marker with explicit rule selector', () => {
        const content = '// code-analyzer-unsuppress(regex:AvoidOldSalesforceApiVersions)';
        const markers = parseSuppressionMarkers(content, '/test/file.xml');

        expect(markers).toHaveLength(1);
        expect(markers[0]).toEqual({
            type: 'unsuppress',
            ruleSelector: 'regex:AvoidOldSalesforceApiVersions',
            lineNumber: 1
        });
    });

    it('should find multiple markers on different lines', () => {
        const content = `// code-analyzer-suppress(pmd)
public class Test {
    // code-analyzer-unsuppress(pmd)
}`;
        const markers = parseSuppressionMarkers(content, '/test/file.apex');

        expect(markers).toHaveLength(2);
        expect(markers[0]).toEqual({
            type: 'suppress',
            ruleSelector: 'pmd',
            lineNumber: 1
        });
        expect(markers[1]).toEqual({
            type: 'unsuppress',
            ruleSelector: 'pmd',
            lineNumber: 3
        });
    });

    it('should find markers in any part of a line, not just comments', () => {
        const content = '"fakeProp": "code-analyzer-suppress(rule1) some text"';
        const markers = parseSuppressionMarkers(content, '/test/file.json');

        expect(markers).toHaveLength(1);
        expect(markers[0].ruleSelector).toBe('rule1');
    });

    it('should handle multiple markers on the same line', () => {
        const content = '// code-analyzer-suppress(rule1) and code-analyzer-suppress(rule2)';
        const markers = parseSuppressionMarkers(content, '/test/file.js');

        expect(markers).toHaveLength(2);
        expect(markers[0].ruleSelector).toBe('rule1');
        expect(markers[1].ruleSelector).toBe('rule2');
    });

    it('should trim whitespace from rule selectors', () => {
        const content = '// code-analyzer-suppress( pmd:SomeRule )';
        const markers = parseSuppressionMarkers(content, '/test/file.apex');

        expect(markers).toHaveLength(1);
        expect(markers[0].ruleSelector).toBe('pmd:SomeRule');
    });

    it('should handle empty file', () => {
        const content = '';
        const markers = parseSuppressionMarkers(content, '/test/file.js');

        expect(markers).toHaveLength(0);
    });

    it('should handle file with no markers', () => {
        const content = `public class Test {
    private String name;
}`;
        const markers = parseSuppressionMarkers(content, '/test/file.apex');

        expect(markers).toHaveLength(0);
    });

    it('should handle complex rule selectors with special characters', () => {
        const content = '// code-analyzer-suppress(eslint:(3,4))';
        const markers = parseSuppressionMarkers(content, '/test/file.js');

        expect(markers).toHaveLength(1);
        expect(markers[0].ruleSelector).toBe('eslint:(3,4)');
    });

    it('should be case-insensitive for marker names', () => {
        const content = `// Code-Analyzer-Suppress(pmd)
// CODE-ANALYZER-UNSUPPRESS(pmd)
// code-ANALYZER-suppress(eslint)`;
        const markers = parseSuppressionMarkers(content, '/test/file.js');

        expect(markers).toHaveLength(3);
        expect(markers[0]).toEqual({
            type: 'suppress',
            ruleSelector: 'pmd',
            lineNumber: 1
        });
        expect(markers[1]).toEqual({
            type: 'unsuppress',
            ruleSelector: 'pmd',
            lineNumber: 2
        });
        expect(markers[2]).toEqual({
            type: 'suppress',
            ruleSelector: 'eslint',
            lineNumber: 3
        });
    });
});

describe('buildSuppressionRanges', () => {
    it('should create suppression and unsuppression ranges', () => {
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'pmd', lineNumber: 5 },
            { type: 'unsuppress', ruleSelector: 'pmd', lineNumber: 10 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.apex');

        expect(ranges).toHaveLength(2);
        // First range: suppressed from line 5-9
        expect(ranges[0]).toEqual({
            startLine: 5,
            endLine: 9,
            ruleSelector: 'pmd',
            isSuppressed: true
        });
        // Second range: unsuppressed from line 10 onwards
        expect(ranges[1]).toEqual({
            startLine: 10,
            endLine: undefined,
            ruleSelector: 'pmd',
            isSuppressed: false
        });
    });

    it('should create range to end of file when no unsuppress', () => {
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'all', lineNumber: 3 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        expect(ranges).toHaveLength(1);
        expect(ranges[0]).toEqual({
            startLine: 3,
            endLine: undefined,
            ruleSelector: 'all',
            isSuppressed: true
        });
    });

    it('should handle multiple suppress/unsuppress pairs for same rule', () => {
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'pmd', lineNumber: 5 },
            { type: 'unsuppress', ruleSelector: 'pmd', lineNumber: 10 },
            { type: 'suppress', ruleSelector: 'pmd', lineNumber: 15 },
            { type: 'unsuppress', ruleSelector: 'pmd', lineNumber: 20 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.apex');

        expect(ranges).toHaveLength(4);
        expect(ranges[0]).toEqual({
            startLine: 5,
            endLine: 9,
            ruleSelector: 'pmd',
            isSuppressed: true
        });
        expect(ranges[1]).toEqual({
            startLine: 10,
            endLine: 14,
            ruleSelector: 'pmd',
            isSuppressed: false
        });
        expect(ranges[2]).toEqual({
            startLine: 15,
            endLine: 19,
            ruleSelector: 'pmd',
            isSuppressed: true
        });
        expect(ranges[3]).toEqual({
            startLine: 20,
            endLine: undefined,
            ruleSelector: 'pmd',
            isSuppressed: false
        });
    });

    it('should handle different rule selectors independently', () => {
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'pmd', lineNumber: 5 },
            { type: 'suppress', ruleSelector: 'eslint', lineNumber: 7 },
            { type: 'unsuppress', ruleSelector: 'pmd', lineNumber: 10 },
            { type: 'unsuppress', ruleSelector: 'eslint', lineNumber: 12 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        expect(ranges).toHaveLength(4);
        expect(ranges[0]).toEqual({
            startLine: 5,
            endLine: 9,
            ruleSelector: 'pmd',
            isSuppressed: true
        });
        expect(ranges[1]).toEqual({
            startLine: 7,
            endLine: 11,
            ruleSelector: 'eslint',
            isSuppressed: true
        });
        expect(ranges[2]).toEqual({
            startLine: 10,
            endLine: undefined,
            ruleSelector: 'pmd',
            isSuppressed: false
        });
        expect(ranges[3]).toEqual({
            startLine: 12,
            endLine: undefined,
            ruleSelector: 'eslint',
            isSuppressed: false
        });
    });

    it('should handle unsuppress without matching suppress', () => {
        const markers: SuppressionMarker[] = [
            { type: 'unsuppress', ruleSelector: 'pmd', lineNumber: 5 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.apex');

        expect(ranges).toHaveLength(1);
        expect(ranges[0]).toEqual({
            startLine: 5,
            endLine: undefined,
            ruleSelector: 'pmd',
            isSuppressed: false
        });
    });

    it('should handle nested suppress markers (second suppress is no-op)', () => {
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'all', lineNumber: 5 },
            { type: 'suppress', ruleSelector: 'all', lineNumber: 7 }, // This is ignored
            { type: 'unsuppress', ruleSelector: 'all', lineNumber: 10 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        expect(ranges).toHaveLength(2);
        expect(ranges[0]).toEqual({
            startLine: 5,
            endLine: 9,
            ruleSelector: 'all',
            isSuppressed: true
        });
        expect(ranges[1]).toEqual({
            startLine: 10,
            endLine: undefined,
            ruleSelector: 'all',
            isSuppressed: false
        });
    });

    it('should handle empty markers array', () => {
        const markers: SuppressionMarker[] = [];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        expect(ranges).toHaveLength(0);
    });

    it('should handle unsuppress(engine) ending suppress(engine:rule)', () => {
        // Test symmetrical case: broader unsuppress ends more specific suppress
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'eslint:no-unused-vars', lineNumber: 2 },
            { type: 'unsuppress', ruleSelector: 'eslint', lineNumber: 5 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        expect(ranges).toHaveLength(2);
        // suppress(eslint:no-unused-vars) should end at line 4 (before unsuppress(eslint))
        expect(ranges[0]).toEqual({
            startLine: 2,
            endLine: 4,
            ruleSelector: 'eslint:no-unused-vars',
            isSuppressed: true
        });
        // unsuppress(eslint) should start at line 5
        expect(ranges[1]).toEqual({
            startLine: 5,
            endLine: undefined,
            ruleSelector: 'eslint',
            isSuppressed: false
        });
    });

    it('should handle suppress(engine) closing unsuppress(engine:rule)', () => {
        // Test that broader suppress can close rule-based unsuppress (reverse of previous test)
        const markers: SuppressionMarker[] = [
            { type: 'unsuppress', ruleSelector: 'eslint:no-unused-vars', lineNumber: 2 },
            { type: 'suppress', ruleSelector: 'eslint', lineNumber: 5 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        expect(ranges).toHaveLength(2);
        // unsuppress(eslint:no-unused-vars) should end at line 4 (closed by suppress(eslint))
        expect(ranges[0]).toEqual({
            startLine: 2,
            endLine: 4,
            ruleSelector: 'eslint:no-unused-vars',
            isSuppressed: false
        });
        // suppress(eslint) should start at line 5
        expect(ranges[1]).toEqual({
            startLine: 5,
            endLine: undefined,
            ruleSelector: 'eslint',
            isSuppressed: true
        });
    });

    it('should handle suppress(engine) closing unsuppress(engine:(severity))', () => {
        // Test that broader suppress can close severity-based unsuppress
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'all', lineNumber: 2 },
            { type: 'unsuppress', ruleSelector: 'eslint:(3)', lineNumber: 5 },
            { type: 'suppress', ruleSelector: 'eslint', lineNumber: 10 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.js');

        // Expected ranges:
        // 1. all suppressed [2-∞] (continues to EOF; unsuppress(eslint:(3)) doesn't end it)
        // 2. eslint:(3) unsuppressed [5-9] (exception within all, closed by suppress(eslint))
        // 3. eslint suppressed [10-∞] (suppress(eslint) closes the unsuppress and starts new suppression)

        expect(ranges.length).toBe(3);

        const allRanges = ranges.filter(r => r.ruleSelector === 'all');
        const eslintSeverityRanges = ranges.filter(r => r.ruleSelector === 'eslint:(3)');
        const eslintRanges = ranges.filter(r => r.ruleSelector === 'eslint');

        // suppress(all) should continue to EOF (unsuppress(eslint:(3)) doesn't end it)
        expect(allRanges).toHaveLength(1);
        expect(allRanges[0]).toEqual({
            startLine: 2,
            endLine: undefined,
            ruleSelector: 'all',
            isSuppressed: true
        });

        // unsuppress(eslint:(3)) creates exception [5,9] (closed by suppress(eslint))
        expect(eslintSeverityRanges).toHaveLength(1);
        expect(eslintSeverityRanges[0]).toEqual({
            startLine: 5,
            endLine: 9,
            ruleSelector: 'eslint:(3)',
            isSuppressed: false
        });

        // suppress(eslint) starts at line 10
        expect(eslintRanges).toHaveLength(1);
        expect(eslintRanges[0]).toEqual({
            startLine: 10,
            endLine: undefined,
            ruleSelector: 'eslint',
            isSuppressed: true
        });
    });

    it('should handle complex XML example from spec with hierarchical suppressions', () => {
        // From the spec: tests full hierarchical behavior with overlapping exception ranges
        // Line 2: suppress(all) - suppress everything
        // Line 4: unsuppress(regex:AvoidOldSalesforceApiVersions) - create EXCEPTION (does NOT end suppress(all))
        // Line 6: suppress(regex) - suppress regex rules (closes the unsuppress exception)
        // Line 12: unsuppress(all) - end all suppressions
        const markers: SuppressionMarker[] = [
            { type: 'suppress', ruleSelector: 'all', lineNumber: 2 },
            { type: 'unsuppress', ruleSelector: 'regex:AvoidOldSalesforceApiVersions', lineNumber: 4 },
            { type: 'suppress', ruleSelector: 'regex', lineNumber: 6 },
            { type: 'unsuppress', ruleSelector: 'all', lineNumber: 12 }
        ];

        const ranges = buildSuppressionRanges(markers, '/test/file.xml');

        // Expected ranges (CORRECTED for overlapping exception behavior):
        // 1. "all" suppressed [2-11] (continues until unsuppress(all) at line 12)
        // 2. "regex:AvoidOldSalesforceApiVersions" unsuppressed [4-5] (exception, closed by suppress(regex))
        // 3. "regex" suppressed [6-11] (ends when unsuppress(all) happens)
        // 4. "all" unsuppressed [12-∞]

        expect(ranges.length).toBeGreaterThanOrEqual(3);

        // Find the ranges for each selector
        const allRanges = ranges.filter(r => r.ruleSelector === 'all');
        const regexAvoidRanges = ranges.filter(r => r.ruleSelector === 'regex:AvoidOldSalesforceApiVersions');
        const regexRanges = ranges.filter(r => r.ruleSelector === 'regex');

        // "all" should have suppression [2,11] (continues despite unsuppress at line 4) and unsuppression [12, ∞]
        expect(allRanges).toContainEqual({
            startLine: 2,
            endLine: 11,
            ruleSelector: 'all',
            isSuppressed: true
        });

        expect(allRanges).toContainEqual({
            startLine: 12,
            endLine: undefined,
            ruleSelector: 'all',
            isSuppressed: false
        });

        // "regex:AvoidOldSalesforceApiVersions" should be unsuppressed [4,5]
        // closed by suppress(regex) at line 6
        expect(regexAvoidRanges).toContainEqual({
            startLine: 4,
            endLine: 5,
            ruleSelector: 'regex:AvoidOldSalesforceApiVersions',
            isSuppressed: false
        });

        // "regex" should be suppressed [6,11]
        expect(regexRanges).toContainEqual({
            startLine: 6,
            endLine: 11,
            ruleSelector: 'regex',
            isSuppressed: true
        });

        // Expected behavior when checking violations (with specificity precedence):
        // Line 3: any violation → SUPPRESSED by "all" [2,11]
        // Line 5: regex:AvoidOldSalesforceApiVersions → NOT SUPPRESSED (unsuppressed [4,5] wins over all [2,11])
        // Line 5: pmd rule → SUPPRESSED by "all" [2,11] (all continues!)
        // Line 7: regex:AvoidOldSalesforceApiVersions → SUPPRESSED by "regex" [6,11] (broader suppress closed the unsuppress)
        // Line 7: any regex rule → SUPPRESSED by "regex" [6,11]
        // Line 13: anything → NOT SUPPRESSED (unsuppress(all) [12,∞])
    });
});

describe('parseFileSuppressions', () => {
    it('should parse complete file with suppressions', () => {
        const content = `public class Test {
    // code-analyzer-suppress(pmd:ApexCrudViolation)
    public List<SObject> load(Set<Id> accountIds) {
        List<Contact> contacts = [SELECT Id FROM Contact];
        // code-analyzer-unsuppress(pmd:ApexCrudViolation)
        return contacts;
    }
}`;
        const filePath = '/test/file.apex';
        const fileSuppressions = parseFileSuppressions(content, filePath);

        expect(fileSuppressions.filePath).toBe(filePath);
        expect(fileSuppressions.ranges).toHaveLength(2);
        expect(fileSuppressions.ranges[0]).toEqual({
            startLine: 2,
            endLine: 4,
            ruleSelector: 'pmd:ApexCrudViolation',
            isSuppressed: true
        });
        expect(fileSuppressions.ranges[1]).toEqual({
            startLine: 5,
            endLine: undefined,
            ruleSelector: 'pmd:ApexCrudViolation',
            isSuppressed: false
        });
    });

    it('should handle file with no suppressions', () => {
        const content = `public class Test {
    private String name;
}`;
        const filePath = '/test/file.apex';
        const fileSuppressions = parseFileSuppressions(content, filePath);

        expect(fileSuppressions.filePath).toBe(filePath);
        expect(fileSuppressions.ranges).toHaveLength(0);
    });
});
