

import { RuleDescription, SeverityLevel } from '@salesforce/code-analyzer-engine-api';

/**
 * Tag carried by every ApexGuru rule.
 *
 * ApexGuru rules are opt-in: they are excluded from the default ("Recommended"), "all", and severity-based
 * rule selection. They only run when explicitly requested by the engine name ('apexguru') or by this tag
 * (e.g. via '--rule-selector apex-guru'). The opt-in exclusion is enforced in code-analyzer-core's
 * rule selection logic, which special-cases this tag.
 */
export const APEXGURU_TAG: string = 'apex-guru';

/**
 * Known ApexGuru rules with descriptions and metadata.
 *
 * This list should be updated when Salesforce adds new ApexGuru rules.
 * Violations for rules NOT in this list will be mapped to the fallback "apexguru-other" rule.
 */
export const APEXGURU_RULES: RuleDescription[] = [
    // =================================================================================================================
    //   PERFORMANCE RULES - HIGH SEVERITY
    // =================================================================================================================

    {
        name: 'SoqlInALoop',
        severityLevel: SeverityLevel.High,
        tags: [APEXGURU_TAG],
        description: 'SOQL query inside a loop causes performance issues and can hit governor limits',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_in_loop.htm&type=5']
    },

    {
        name: 'DmlInALoop',
        severityLevel: SeverityLevel.High,
        tags: [APEXGURU_TAG],
        description: 'DML statement inside a loop causes performance issues and can hit governor limits',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_dml_in_loop.htm&type=5']
    },

    {
        name: 'ExpensiveMethods',
        severityLevel: SeverityLevel.High,
        tags: [APEXGURU_TAG],
        description: 'Method accounts for a large share of observed Apex CPU time and is a hotspot for performance work',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_expensive_methods.htm&type=5']
    },

    {
        name: 'SchemaGetGlobalDescribeNotEfficient',
        severityLevel: SeverityLevel.High,
        tags: [APEXGURU_TAG],
        description: 'Using Schema.getGlobalDescribe() causes unnecessary overhead and decreases performance',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_schema_getglobaldescribe_not_efficient.htm&type=5']
    },

    {
        name: 'SoqlWithoutPlatformCache',
        severityLevel: SeverityLevel.High,
        tags: [APEXGURU_TAG],
        description: 'Frequently executed SOQL query whose results could be served from Platform Cache to reduce database load',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_without_platform_cache.htm&type=5']
    },

    // =================================================================================================================
    //   PERFORMANCE RULES - MODERATE SEVERITY
    // =================================================================================================================

    {
        name: 'SoqlInALoopOneHop',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'SOQL query reached one method-hop away inside a loop causes performance issues and can hit governor limits',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_in_loop_one_hop.htm&type=5']
    },

    {
        name: 'Soql Aggregation',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'Manual aggregation in Apex instead of using SOQL aggregate functions causes performance issues',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_aggregating_in_apex.htm&type=5']
    },

    {
        name: 'SoqlWithApexFilter',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'Filtering records in Apex instead of using SOQL WHERE clause causes performance issues',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_with_apex_filter.htm&type=5']
    },

    {
        name: 'CopyingListOrSetElementsUsingAForLoop',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'Copying list or set elements using a for loop is inefficient - use addAll() instead',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_copying_elements_with_for_loop.htm&type=5']
    },

    {
        name: 'Redundant Soql',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'Multiple identical SOQL queries cause unnecessary database round trips',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_redundant_soql.htm&type=5']
    },

    {
        name: 'SObjectMapInAForLoop',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'Building Map<Id, SObject> using .put() in a for loop is inefficient - use map constructor or putAll()',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_sobject_map_in_for_loop.htm&type=5']
    },

    // =================================================================================================================
    //   PERFORMANCE RULES - LOW SEVERITY
    // =================================================================================================================

    {
        name: 'SoqlWithoutAWhereClauseOrLimitStatement',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'SOQL query without WHERE clause or LIMIT statement can cause performance issues and heap size exceptions',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_without_where_clause_or_limit_statement.htm&type=5']
    },

    {
        name: 'SoqlWithWildcardFilter',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'SOQL query using LIKE with leading wildcard is inefficient and cannot use indexes',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_with_wildcard_filter.htm&type=5']
    },

    {
        name: 'SoqlWithNegativeExpressions',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'SOQL queries using negative expressions (NOT IN, !=) don\'t use indexes and cause full table scans',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_with_negative_expressions.htm&type=5']
    },

    {
        name: 'LimitsGetHeapsizeMethods',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'Frequent Limits.getHeapSize() calls add runtime overhead',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_limits_getheapsize_methods.htm&type=5']
    },

    {
        name: 'ExpensiveStringComparison',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'Inefficient string comparison wastes CPU time',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_expensive_string_comparison.htm&type=5']
    },

    {
        name: 'ExpensiveDebugStatements',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'Expensive System.debug() statements add runtime overhead',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_expensive_debug_statements.htm&type=5']
    },

    {
        name: 'UsingTheTestMethodKeyword',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'The testMethod keyword is deprecated - use @isTest annotation instead',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_test_case_antipattern_using_testmethod.htm&type=5']
    },

    {
        name: 'SortingInApex',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'Sorting records in Apex wastes CPU time and can exceed governor limits - use ORDER BY in SOQL',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_sorting_in_apex.htm&type=5']
    },

    {
        name: 'BusyLoopDelay',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'Using empty loops to delay execution wastes CPU time - use System.enqueueJob with delay parameter',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_busy_loop_delay.htm&type=5']
    },

    {
        name: 'SoqlWithUnusedFields',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'SOQL query selecting unused fields increases resource consumption unnecessarily',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_antipattern_soql_with_unused_fields.htm&type=5']
    },

    {
        name: 'WritingFillerStatements',
        severityLevel: SeverityLevel.Low,
        tags: [APEXGURU_TAG],
        description: 'Filler statements written to inflate code coverage instead of testing real behavior',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru_test_case_antipattern_filler_statements.htm&type=5']
    },

    // =================================================================================================================
    //   FALLBACK RULE
    // =================================================================================================================

    {
        name: 'apexguru-other',
        severityLevel: SeverityLevel.Moderate,
        tags: [APEXGURU_TAG],
        description: 'Other ApexGuru rules - covers new rules added by Salesforce that are not yet explicitly declared',
        resourceUrls: ['https://help.salesforce.com/s/articleView?id=xcloud.apexguru.htm']
    }
];

/**
 * Helper to check if a rule name is known
 */
export function isKnownRule(ruleName: string): boolean {
    return APEXGURU_RULES.some(rule => rule.name === ruleName);
}

/**
 * Fallback rule name for unknown violations
 */
export const FALLBACK_RULE_NAME = 'apexguru-other';
