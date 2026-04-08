

import { COMMON_TAGS, SeverityLevel } from '@salesforce/code-analyzer-engine-api';

/**
 * Salesforce-curated metadata for ApexGuru rules.
 *
 * Purpose:
 * - Override ApexGuru's default severity levels with Salesforce-approved values
 * - Add/standardize tags for better rule categorization
 * - Control which rules get the "Recommended" tag
 *
 * When to add rules here:
 * - You want to override ApexGuru's severity for a specific rule
 * - You want to add the "Recommended" tag (rules not listed here won't be recommended by default)
 * - You want to add custom tags for categorization
 *
 * Note: Rules NOT in this mapping will still be available and will use ApexGuru's
 * default severity and be tagged as "Recommended" + "Custom" by default.
 *
 * To find rule names: Run ApexGuru on sample code and check violation.ruleName values.
 */
export const APEXGURU_RULE_MAPPINGS: Record<string, {severity: SeverityLevel, tags: string[]}> = {

    // =================================================================================================================
    //   PERFORMANCE RULES - HIGH SEVERITY (Override API's Moderate)
    // =================================================================================================================

    // SOQL query inside a loop - causes performance issues and can hit governor limits
    // ApexGuru API: severity: 3 (Moderate), category: "soql_in_loop"
    // Overriding to High severity due to critical nature of this anti-pattern
    "SoqlInALoop": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // DML statement inside a loop - causes performance issues and can hit governor limits
    // ApexGuru API: severity: 3 (Moderate), category: "dml_in_loop"
    // Overriding to High severity due to critical nature of this anti-pattern
    "DmlInALoop": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // =================================================================================================================
    //   PERFORMANCE RULES - MODERATE SEVERITY (Keep API's default)
    // =================================================================================================================

    // SOQL query without WHERE clause or LIMIT statement
    // ApexGuru API: severity: 3 (Moderate), category: "soql_without_where_clause_or_limit_statement"
    "SoqlWithoutAWhereClauseOrLimitStatement": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // SOQL wildcard search with leading %
    // ApexGuru API: severity: 3 (Moderate), category: "soql_with_wildcard_filter"
    "SoqlWithWildcardFilter": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Manual aggregation in Apex instead of SOQL aggregate functions
    // ApexGuru API: severity: 3 (Moderate), category: "record_aggregation_in_apex"
    "Soql Aggregation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Filtering in Apex instead of SOQL WHERE clause
    // ApexGuru API: severity: 2 (Low), category: "record_filtering_in_apex"
    // Overriding to Moderate due to performance impact
    "SoqlWithApexFilter": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Copying list/set elements using for loop instead of addAll()
    // ApexGuru API: severity: 3 (Moderate), category: N/A
    "CopyingListOrSetElementsUsingAForLoop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Multiple identical SOQL queries
    // ApexGuru API: severity: 2 (Low), category: "redundant_soql_query"
    "Redundant Soql": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Using Schema.getGlobalDescribe() in loops or repeatedly
    // ApexGuru API: severity: 2 (Low)
    "SchemaGetGlobalDescribeNotEfficient": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // SOQL with negative expressions (NOT IN, !=)
    // ApexGuru API: severity: 3 (Moderate), category: "soql_with_negative_expressions"
    "SoqlWithNegativeExpressions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Building SObject map using .put() in a for loop
    // ApexGuru API: severity: 3 (Moderate)
    "SObjectMapInAForLoop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.APEX]
    },

    // =================================================================================================================
    //   BEST PRACTICES - LOW SEVERITY
    // =================================================================================================================

    // Sorting in Apex instead of using ORDER BY in SOQL
    // ApexGuru API: severity: 2 (Low), category: "record_sorting_in_apex"
    "SortingInApex": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Busy loop delay using empty while loops
    // ApexGuru API: severity: 2 (Low)
    "BusyLoopDelay": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },

    // SOQL query selecting unused fields
    // ApexGuru API: severity: 4 (Low), category: "soql_unused_fields"
    "SoqlWithUnusedFields": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },

    // Deprecated testMethod keyword
    // ApexGuru API: severity: 4 (Low)
    "UsingTheTestMethodKeyword": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },

    // =================================================================================================================
    //   SECURITY RULES
    // =================================================================================================================

    // Example:
    // "FlsViolation": {
    //     severity: SeverityLevel.Critical,
    //     tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    // },

    // =================================================================================================================
    //   BEST PRACTICES RULES
    // =================================================================================================================

    // Example:
    // "AvoidDebugStatements": {
    //     severity: SeverityLevel.Low,
    //     tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    // },

    // =================================================================================================================
    //   NON-RECOMMENDED RULES
    // =================================================================================================================

    // Example of a rule you want available but NOT recommended by default:
    // "SomeNoisyRule": {
    //     severity: SeverityLevel.Low,
    //     tags: [/* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.APEX]
    // },

};

/**
 * Helper function to check if a rule is in our mappings
 */
export function hasRuleMapping(ruleName: string): boolean {
    return ruleName in APEXGURU_RULE_MAPPINGS;
}

/**
 * Helper function to get rule mapping (returns undefined if not found)
 */
export function getRuleMapping(ruleName: string): {severity: SeverityLevel, tags: string[]} | undefined {
    return APEXGURU_RULE_MAPPINGS[ruleName];
}
