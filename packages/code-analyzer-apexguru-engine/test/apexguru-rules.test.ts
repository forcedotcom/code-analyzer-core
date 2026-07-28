import { APEXGURU_RULES, DEV_PREVIEW_TAG, isKnownRule, FALLBACK_RULE_NAME } from '../src/apexguru-rules';

describe('apexguru-rules', () => {

    describe('DEV_PREVIEW_TAG constant', () => {
        it('should equal DevPreview', () => {
            expect(DEV_PREVIEW_TAG).toBe('DevPreview');
        });
    });

    describe('7 rules that previously had RECOMMENDED tag', () => {
        const rulesWithFormerRecommended = [
            'SoqlInALoop',
            'DmlInALoop',
            'SoqlWithoutAWhereClauseOrLimitStatement',
            'SoqlWithWildcardFilter',
            'SchemaGetGlobalDescribeNotEfficient',
            'UsingTheTestMethodKeyword',
            'apexguru-other'
        ];

        it.each(rulesWithFormerRecommended)('%s should have DevPreview as first tag', (ruleName) => {
            const rule = APEXGURU_RULES.find(r => r.name === ruleName);
            expect(rule).toBeDefined();
            expect(rule!.tags[0]).toBe('DevPreview');
        });

        it.each(rulesWithFormerRecommended)('%s should NOT contain Recommended tag', (ruleName) => {
            const rule = APEXGURU_RULES.find(r => r.name === ruleName);
            expect(rule).toBeDefined();
            expect(rule!.tags).not.toContain('Recommended');
        });

        it('should have zero rules with Recommended tag across all APEXGURU_RULES', () => {
            const rulesWithRecommended = APEXGURU_RULES.filter(r => r.tags.includes('Recommended'));
            expect(rulesWithRecommended).toHaveLength(0);
        });
    });

    describe('16 rules without former RECOMMENDED tag', () => {
        const rulesWithoutFormerRecommended = [
            'SoqlInALoopOneHop',
            'ExpensiveMethods',
            'Soql Aggregation',
            'SoqlWithApexFilter',
            'CopyingListOrSetElementsUsingAForLoop',
            'Redundant Soql',
            'SoqlWithNegativeExpressions',
            'SObjectMapInAForLoop',
            'SoqlWithoutPlatformCache',
            'LimitsGetHeapsizeMethods',
            'ExpensiveStringComparison',
            'ExpensiveDebugStatements',
            'SortingInApex',
            'BusyLoopDelay',
            'SoqlWithUnusedFields',
            'WritingFillerStatements'
        ];

        it.each(rulesWithoutFormerRecommended)('%s should have DevPreview as first tag', (ruleName) => {
            const rule = APEXGURU_RULES.find(r => r.name === ruleName);
            expect(rule).toBeDefined();
            expect(rule!.tags[0]).toBe('DevPreview');
        });

        it.each(rulesWithoutFormerRecommended)('%s should NOT contain Recommended tag', (ruleName) => {
            const rule = APEXGURU_RULES.find(r => r.name === ruleName);
            expect(rule).toBeDefined();
            expect(rule!.tags).not.toContain('Recommended');
        });
    });

    describe('aggregate invariants across all 23 rules', () => {
        it('should have exactly 23 rules', () => {
            expect(APEXGURU_RULES).toHaveLength(23);
        });

        it('every rule should have DevPreview in its tags', () => {
            for (const rule of APEXGURU_RULES) {
                expect(rule.tags).toContain('DevPreview');
            }
        });

        it('no rule should have Recommended in its tags', () => {
            for (const rule of APEXGURU_RULES) {
                expect(rule.tags).not.toContain('Recommended');
            }
        });

    });

    describe('isKnownRule', () => {
        it('should return true for known rules', () => {
            expect(isKnownRule('SoqlInALoop')).toBe(true);
        });

        it('should return false for unknown rules', () => {
            expect(isKnownRule('NonExistentRule')).toBe(false);
        });
    });

    describe('FALLBACK_RULE_NAME', () => {
        it('should equal apexguru-other', () => {
            expect(FALLBACK_RULE_NAME).toBe('apexguru-other');
        });
    });
});
