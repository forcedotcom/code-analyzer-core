import { COMMON_TAGS } from '@salesforce/code-analyzer-engine-api';
import { APEXGURU_RULES, isKnownRule, FALLBACK_RULE_NAME } from '../src/apexguru-rules';

describe('apexguru-rules', () => {

    describe('aggregate invariants across all 23 rules', () => {
        it('should have exactly 23 rules', () => {
            expect(APEXGURU_RULES).toHaveLength(23);
        });

        it('every rule should carry exactly the Recommended and Performance tags', () => {
            for (const rule of APEXGURU_RULES) {
                expect(rule.tags).toEqual([COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE]);
            }
        });

        it('no rule should carry the removed DevPreviewApexGuru tag', () => {
            for (const rule of APEXGURU_RULES) {
                expect(rule.tags).not.toContain('DevPreviewApexGuru');
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
