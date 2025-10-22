import {COMMON_TAGS, RuleDescription, SeverityLevel} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from './messages';

const PREVENT_PASSING_USER_DATA_WITHOUT_SHARING = 'PreventPassingUserDataIntoElementWithoutSharing';
const PREVENT_PASSING_USER_DATA_WITH_SHARING = 'PreventPassingUserDataIntoElementWithSharing';

const QUERY_NAMES_TO_CONSOLIDATED_NAMES: Map<string, string> = new Map([
    ['Flow: SystemModeWithoutSharing recordCreates data', PREVENT_PASSING_USER_DATA_WITHOUT_SHARING],
    ['Flow: SystemModeWithoutSharing recordDeletes selector', PREVENT_PASSING_USER_DATA_WITHOUT_SHARING],
    ['Flow: SystemModeWithoutSharing recordLookups selector', PREVENT_PASSING_USER_DATA_WITHOUT_SHARING],
    ['Flow: SystemModeWithoutSharing recordUpdates data', PREVENT_PASSING_USER_DATA_WITHOUT_SHARING],
    ['Flow: SystemModeWithoutSharing recordUpdates selector', PREVENT_PASSING_USER_DATA_WITHOUT_SHARING],
    ['Flow: SystemModeWithSharing recordCreates data', PREVENT_PASSING_USER_DATA_WITH_SHARING],
    ['Flow: SystemModeWithSharing recordDeletes selector', PREVENT_PASSING_USER_DATA_WITH_SHARING],
    ['Flow: SystemModeWithSharing recordLookups selector', PREVENT_PASSING_USER_DATA_WITH_SHARING],
    ['Flow: SystemModeWithSharing recordUpdates data', PREVENT_PASSING_USER_DATA_WITH_SHARING],
    ['Flow: SystemModeWithSharing recordUpdates selector', PREVENT_PASSING_USER_DATA_WITH_SHARING],
    // New FlowScanner rules
    ['Database Operation In Loop', 'DbInLoop'],
    ['Same Record Update In Trigger', 'SameRecordUpdate'],
    ['Record Trigger With No Entry Criteria', 'TriggerEntryCriteria'],
    ['Missing Fault Handler', 'MissingFaultHandler'],
    ['Default Copy Label', 'DefaultCopy'],
    ['Unused Resource', 'UnusedResource'],
    ['Missing Description', 'MissingDescription'],
    ['Hardcoded Id', 'HardcodedId'],
    ['Loop Element Without nextValueConnector', 'MissingNextValueConnector'],
    ['Chain of subflow calls forms a cycle', 'CyclicSubflow'],
    ['Element is Unreachable', 'UnreachableElement'],
    ['Wait Event in Trigger', 'TriggerWaitEvent'],
    ['Trigger Flow Callout in Synchronous Path', 'TriggerCallout'],
    ['Variable Used Prior To Initialization', 'UninitializedVariable'],
    ['Potentially Null Value Used Unsafely', 'NullValueError']
]);

const CONSOLIDATED_RULE_DESCRIPTIONS_BY_NAME: Map<string, RuleDescription> = new Map([
    [PREVENT_PASSING_USER_DATA_WITHOUT_SHARING, {
        name: PREVENT_PASSING_USER_DATA_WITHOUT_SHARING,
        description: getMessage('ConsolidatedRuleDescription', 'Without Sharing'),
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    [PREVENT_PASSING_USER_DATA_WITH_SHARING, {
        name: PREVENT_PASSING_USER_DATA_WITH_SHARING,
        description: getMessage('ConsolidatedRuleDescription', 'With Sharing'),
        severityLevel: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    // New FlowScanner rules - Recommended ones (marked as "Yes" in CSV)
    ['DbInLoop', {
        name: 'DbInLoop',
        description: 'This rule detects when there are CRUD flow elements within a loop (RecordLookups, RecordCreates, RecordUpdates, RecordDeletes). This rule does not trigger if the CRUD element is in a fault handler. DB operations should be bulkified by using collections and the "IN" condition. This rule does not follow subflows.',
        severityLevel: SeverityLevel.Critical,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['SameRecordUpdate', {
        name: 'SameRecordUpdate',
        description: 'This rule detects when an AfterSave record trigger modifies the same record. Record modifications should be done in BeforeSave triggers, not AfterSave triggers. This rule follows subflows, so it will detect if the RecordId is passed to a child flow which then modifies a record with that id.',
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['TriggerEntryCriteria', {
        name: 'TriggerEntryCriteria',
        description: 'This rule detects when record trigger flows are missing entry criteria. All record trigger flows should have entry criteria specified in the flow trigger definition rather than solely in the flow\'s own business logic.',
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['DefaultCopy', {
        name: 'DefaultCopy',
        description: 'This rule detects if an element was copied and left with the default "copy" value in the name or label. This can also apply to fields within screen flows. When copying an element, be sure to update the name of all fields.',
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['HardcodedId', {
        name: 'HardcodedId',
        description: 'This rule detects hardcoded IDs within a flow. Hardcoded Ids are a bad practice, and such flows are not appropriate for distribution.',
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['MissingNextValueConnector', {
        name: 'MissingNextValueConnector',
        description: 'This rule detects Loops without nextValue connectors. Loops should always have nextValue connectors, and lack of one usually signifies developer error when connecting the loop element to other elements.',
        severityLevel: SeverityLevel.Critical,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['TriggerWaitEvent', {
        name: 'TriggerWaitEvent',
        description: 'This rule detects when a wait event is reached during trigger execution. Triggers must be performant and cannot contain wait events. For async processing, use scheduled paths within your trigger and async callouts, not wait events. This rule follows subflows.',
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['TriggerCallout', {
        name: 'TriggerCallout',
        description: 'This rule detects when a trigger performs a callout on the synchronous path. Triggers must be performant and may only contain callouts on async scheduled paths. This rule follows subflows.',
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    // Non-recommended rules (marked as "No" in CSV)
    ['MissingFaultHandler', {
        name: 'MissingFaultHandler',
        description: 'This rule detects when elements that can fire fault events are missing fault handlers. The rule currently detects Create Records, Update Records, Delete Records, Action Calls, and Subflows.',
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['UnusedResource', {
        name: 'UnusedResource',
        description: 'This rule detects redundant variables that are not used in the flow. This can be a sign of developer error.',
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['MissingDescription', {
        name: 'MissingDescription',
        description: 'This rule detects if top level flow elements, variables, or decisions are missing description fields',
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['CyclicSubflow', {
        name: 'CyclicSubflow',
        description: 'This rule detects when a subflow calls a parent flow, creating a cyclic flow. The rule will detect cycles of any depth.',
        severityLevel: SeverityLevel.Critical,
        tags: [COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['UnreachableElement', {
        name: 'UnreachableElement',
        description: 'This rule identifies elements that have not been connected to the start element of the flow. Unreachable elements are usually due to incomplete flows or developer error.',
        severityLevel: SeverityLevel.Low,
        tags: [COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    // Rules marked as "Remove: not yet available" in CSV
    ['UninitializedVariable', {
        name: 'UninitializedVariable',
        description: 'This rule detects when a variable is used before it has been initialized. For example, a reference to the return value of a RecordLookup before the record lookup was performed. Violations of this rule result in runtime errors that stop flow execution.',
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }],
    ['NullValueError', {
        name: 'NullValueError',
        description: 'This rule detects when a value that is possibly null has been passed to functions that expect non-null values. For example, passing the return value of a recordLookups flow element to a text template or formula without checking that the return value is not null. Violations of this rule generally results in runtime null pointer exceptions being thrown that interrupt flow execution.',
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }]
]);

export function getConsolidatedRuleNames(): string[] {
    return [...new Set(QUERY_NAMES_TO_CONSOLIDATED_NAMES.values())];
}

export function getConsolidatedRuleName(unconsolidatedName: string): string {
    // istanbul ignore else
    if (QUERY_NAMES_TO_CONSOLIDATED_NAMES.has(unconsolidatedName)) {
        return QUERY_NAMES_TO_CONSOLIDATED_NAMES.get(unconsolidatedName)!;
    } else {
        throw new Error(`Developer error: invalid name ${unconsolidatedName}`);
    }
}

export function getConsolidatedRuleByName(consolidatedName: string): RuleDescription {
    // istanbul ignore else
    if (CONSOLIDATED_RULE_DESCRIPTIONS_BY_NAME.has(consolidatedName)) {
        return CONSOLIDATED_RULE_DESCRIPTIONS_BY_NAME.get(consolidatedName)!;
    } else {
        throw new Error(`Developer rule: No consolidated rule with name ${consolidatedName}`);
    }
}