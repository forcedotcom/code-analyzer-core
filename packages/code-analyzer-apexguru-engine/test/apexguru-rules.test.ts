import { COMMON_TAGS } from '@salesforce/code-analyzer-engine-api';
import { APEXGURU_RULES, APEXGURU_TAG, isKnownRule, FALLBACK_RULE_NAME } from '../src/apexguru-rules';

describe('apexguru-rules', () => {

    describe('aggregate invariants across all 23 rules', () => {
        it('should have exactly 23 rules', () => {
            expect(APEXGURU_RULES).toHaveLength(23);
        });

        it('every rule should carry exactly the apex-guru tag', () => {
            for (const rule of APEXGURU_RULES) {
                expect(rule.tags).toEqual([APEXGURU_TAG]);
            }
        });

        it('no rule should carry the Recommended or Performance tags (ApexGuru is opt-in, not run by default)', () => {
            for (const rule of APEXGURU_RULES) {
                expect(rule.tags).not.toContain(COMMON_TAGS.RECOMMENDED);
                expect(rule.tags).not.toContain(COMMON_TAGS.CATEGORIES.PERFORMANCE);
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
