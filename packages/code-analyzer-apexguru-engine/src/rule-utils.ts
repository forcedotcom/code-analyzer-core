

import { RuleDescription, SeverityLevel, COMMON_TAGS } from '@salesforce/code-analyzer-engine-api';
import { APEXGURU_RULE_MAPPINGS } from './apexguru-rule-mappings';

/**
 * Helper to build RuleDescription for a known ApexGuru rule
 *
 * Usage: When you discover ApexGuru rule names (by running on sample code),
 * you can use this helper to create RuleDescription objects in describeRules().
 *
 * Example:
 * ```typescript
 * async describeRules(): Promise<RuleDescription[]> {
 *     return [
 *         buildRuleDescription('SoqlInALoop', 'Detects SOQL in loops', ['https://...']),
 *         buildRuleDescription('FlsViolation', 'Detects FLS violations', ['https://...']),
 *         // ... more rules
 *     ];
 * }
 * ```
 *
 * @param ruleName - ApexGuru rule name (e.g., 'SoqlInALoop')
 * @param description - Human-readable description
 * @param resourceUrls - Documentation URLs
 * @returns RuleDescription with severity/tags from APEXGURU_RULE_MAPPINGS (if present)
 */
export function buildRuleDescription(
    ruleName: string,
    description: string,
    resourceUrls: string[] = []
): RuleDescription {
    // Check if we have a mapping for this rule
    const mapping = APEXGURU_RULE_MAPPINGS[ruleName];

    if (mapping) {
        // Use our curated severity and tags
        return {
            name: ruleName,
            severityLevel: mapping.severity,
            tags: mapping.tags,
            description,
            resourceUrls
        };
    } else {
        // No mapping - use defaults
        return {
            name: ruleName,
            severityLevel: SeverityLevel.Moderate,  // Default severity
            tags: [
                COMMON_TAGS.RECOMMENDED,             // Default to recommended
                COMMON_TAGS.LANGUAGES.APEX,          // Always Apex
                'ApexGuru'                           // Custom tag to identify as ApexGuru rule
            ],
            description,
            resourceUrls
        };
    }
}

/**
 * Helper to convert ApexGuru severity number to SeverityLevel enum
 *
 * ApexGuru severity scale (from API):
 * - 1 = Critical
 * - 2 = High
 * - 3 = Moderate
 * - 4 = Low
 * - 5 = Info
 *
 * @param apiSeverity - Severity number from ApexGuru API
 * @returns Corresponding SeverityLevel
 */
export function mapApexGuruSeverity(apiSeverity: number): SeverityLevel {
    switch (apiSeverity) {
        case 1:
            return SeverityLevel.Critical;
        case 2:
            return SeverityLevel.High;
        case 3:
            return SeverityLevel.Moderate;
        case 4:
            return SeverityLevel.Low;
        case 5:
            return SeverityLevel.Info;
        default:
            return SeverityLevel.Moderate;  // Default fallback
    }
}

/**
 * Helper to map ApexGuru category to Code Analyzer tags
 *
 * @param category - Category from ApexGuru API (e.g., 'Performance', 'Security')
 * @returns Array of appropriate COMMON_TAGS
 */
export function mapApexGuruCategory(category?: string): string[] {
    if (!category) {
        return [];
    }

    const categoryLower = category.toLowerCase();

    if (categoryLower === 'performance') {
        return [COMMON_TAGS.CATEGORIES.PERFORMANCE];
    } else if (categoryLower === 'security') {
        return [COMMON_TAGS.CATEGORIES.SECURITY];
    } else if (categoryLower === 'best practices' || categoryLower === 'bestpractices') {
        return [COMMON_TAGS.CATEGORIES.BEST_PRACTICES];
    } else if (categoryLower === 'code style' || categoryLower === 'codestyle') {
        return [COMMON_TAGS.CATEGORIES.CODE_STYLE];
    } else if (categoryLower === 'documentation') {
        return [COMMON_TAGS.CATEGORIES.DOCUMENTATION];
    } else {
        return [];
    }
}
