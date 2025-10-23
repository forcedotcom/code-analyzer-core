import {COMMON_TAGS, RuleDescription, SeverityLevel} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from './messages';

// Code Analyzer rule names
enum RuleName {
    CyclicSubflow = 'CyclicSubflow',
    DbInLoop = 'DbInLoop',
    DefaultCopy = 'DefaultCopy',
    HardcodedId = 'HardCodedId',
    MissingDescription = 'MissingDescription',
    MissingFaultHandler = 'MissingFaultHandler',
    MissingNextValueConnector = 'MissingNextValueConnector',
    PreventPassingUserDataIntoElementWithoutSharing = 'PreventPassingUserDataIntoElementWithoutSharing',
    PreventPassingUserDataIntoElementWithSharing = 'PreventPassingUserDataIntoElementWithSharing',
    SameRecordUpdate = 'SameRecorUpdate',
    TriggerCallout = 'TriggerCallout',
    TriggerEntryCriteria = 'TriggerEntryCriteria',
    TriggerWaitEvent = 'TriggerWaitEvent',
    UnreachableElement = 'UnreachableElement',
    UnusedResource = 'UnusedResource'
}

const RULE_DESCRIPTIONS: RuleDescription[] = [
    {
        name: RuleName.CyclicSubflow,
        description: getMessage('CyclicSubflowRuleDescription'),
        severityLevel: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.PERFORMANCE,   COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.DbInLoop,
        description: getMessage('DbInLoopRuleDescription'),
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,   COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.DefaultCopy,
        description: getMessage('DefaultCopyRuleDescription'),
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,    COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.HardcodedId,
        description: getMessage('HardcodedIdRuleDescription'),
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.MissingDescription,
        description: getMessage('MissingDescriptionRuleDescription'),
        severityLevel: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.MissingFaultHandler,
        description: getMessage('MissingFaultHandlerRuleDescription'),
        severityLevel: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.MissingNextValueConnector,
        description: getMessage('MissingNextValueConnectorRuleDescription'),
        severityLevel: SeverityLevel.Critical,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.PreventPassingUserDataIntoElementWithoutSharing,
        description: getMessage('PreventPassingUserDataIntoElementRuleDescription', 'Without Sharing'),
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: ['https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/rules-flow.html#preventpassinguserdataintoelementwithoutsharing']
    },
    {
        name: RuleName.PreventPassingUserDataIntoElementWithSharing,
        description: getMessage('PreventPassingUserDataIntoElementRuleDescription', 'With Sharing'),
        severityLevel: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: ['https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/rules-flow.html#preventpassinguserdataintoelementwithsharing']
    },
    {
        name: RuleName.SameRecordUpdate,
        description: getMessage('SameRecordUpdateRuleDescription'),
        severityLevel: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.TriggerCallout,
        description: getMessage('TriggerCalloutRuleDescription'),
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.TriggerEntryCriteria,
        description: getMessage('TriggerEntryCriteriaRuleDescription'),
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.TriggerWaitEvent,
        description: getMessage('TriggerWaitEventRuleDescription'),
        severityLevel: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.UnreachableElement,
        description: getMessage('UnreachableElementRuleDescription'),
        severityLevel: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    },
    {
        name: RuleName.UnusedResource,
        description: getMessage('UnusedResourceRuleDescription'),
        severityLevel: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML],
        resourceUrls: []
    }
];

const RULE_DESCRIPTIONS_BY_NAME: Map<string, RuleDescription> = new Map(RULE_DESCRIPTIONS.map(rd => [rd.name, rd]));

type FlowScannerQueryAssociation = {
    // The id of the flow scanner query. This is used when selecting which query to run (if it is an optional query).
    queryId : string,

    // The name of the flow scanner query. Unfortunately this is what shows up in the results instead of the id.
    queryName: string,

    // Should be true if the rule is queried by the --optional_queries flag and false if it is in the default preset
    isOptional: boolean

    // The name of the Code Analyzer rule that the query is associated with. Note that multiple queries can be under the same rule.
    ruleName: RuleName
}

const QUERY_ASSOCIATIONS: FlowScannerQueryAssociation[]  = [
    // ==== QUERIES FROM THE DEFAULT PRESET (which we can't turn off when running flow scanner) ====
    {
        queryId: "FlowSecurity.SystemModeWithSharing.recordCreates.data",
        queryName: "Flow: SystemModeWithSharing recordCreates data",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithSharing.recordDeletes.selector",
        queryName: "Flow: SystemModeWithSharing recordDeletes selector",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithSharing.recordLookups.selector",
        queryName: "Flow: SystemModeWithSharing recordLookups selector",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithSharing.recordUpdates.data",
        queryName: "Flow: SystemModeWithSharing recordUpdates data",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithSharing.recordUpdates.selector",
        queryName: "Flow: SystemModeWithSharing recordUpdates selector",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithoutSharing.recordCreates.data",
        queryName: "Flow: SystemModeWithoutSharing recordCreates data",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithoutSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithoutSharing.recordDeletes.selector",
        queryName: "Flow: SystemModeWithoutSharing recordDeletes selector",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithoutSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithoutSharing.recordLookups.selector",
        queryName: "Flow: SystemModeWithoutSharing recordLookups selector",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithoutSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithoutSharing.recordUpdates.data",
        queryName: "Flow: SystemModeWithoutSharing recordUpdates data",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithoutSharing
    },
    {
        queryId: "FlowSecurity.SystemModeWithoutSharing.recordUpdates.selector",
        queryName: "Flow: SystemModeWithoutSharing recordUpdates selector",
        isOptional: false,
        ruleName: RuleName.PreventPassingUserDataIntoElementWithoutSharing
    },

    // ==== OPTIONAL QUERIES (which we can choose to run) ====
    {
        queryId: "CyclicSubflow",
        queryName: "Chain of subflow calls forms a cycle",
        isOptional: true,
        ruleName: RuleName.CyclicSubflow
    },
    {
        queryId: "DbInLoop",
        queryName: "Database Operation In Loop",
        isOptional: true,
        ruleName: RuleName.DbInLoop
    },
    {
        queryId: "DefaultCopy",
        queryName: "Default Copy Label",
        isOptional: true,
        ruleName: RuleName.DefaultCopy
    },
    {
        queryId: "HardcodedId",
        queryName: "Hardcoded Id",
        isOptional: true,
        ruleName: RuleName.HardcodedId
    },
    {
        queryId: "MissingDescription",
        queryName: "Missing Description",
        isOptional: true,
        ruleName: RuleName.MissingDescription
    },
    {
        queryId: "MissingFaultHandler",
        queryName: "Missing Fault Handler",
        isOptional: true,
        ruleName: RuleName.MissingFaultHandler
    },
    {
        queryId: "MissingNextValueConnector",
        queryName: "Loop Element Without nextValueConnector",
        isOptional: true,
        ruleName: RuleName.MissingNextValueConnector
    },
    {
        queryId: "SameRecordUpdate",
        queryName: "Same Record Update In Trigger",
        isOptional: true,
        ruleName: RuleName.SameRecordUpdate
    },
    {
        queryId: "TriggerCallout",
        queryName: "Trigger Flow Callout in Synchronous Path",
        isOptional: true,
        ruleName: RuleName.TriggerCallout
    },
    {
        queryId: "TriggerEntryCriteria",
        queryName: "Record Trigger With No Entry Criteria",
        isOptional: true,
        ruleName: RuleName.TriggerEntryCriteria
    },
    {
        queryId: "TriggerWaitEvent",
        queryName: "Wait Event in Trigger",
        isOptional: true,
        ruleName: RuleName.TriggerWaitEvent
    },
    {
        queryId: "UnreachableElement",
        queryName: "Element is Unreachable",
        isOptional: true,
        ruleName: RuleName.UnreachableElement
    },
    {
        queryId: "UnusedResource",
        queryName: "Unused Resource",
        isOptional: true,
        ruleName: RuleName.UnusedResource
    }
]

const QUERY_ASSOCIATIONS_BY_NAME : Map<string, FlowScannerQueryAssociation> = new Map(QUERY_ASSOCIATIONS.map(qa => [qa.queryName, qa]));

export function getAllRuleNames(): string[] {
    return Object.values(RuleName);
}

export function getRuleNameFromQueryName(queryName: string): string {
    // istanbul ignore else
    if (QUERY_ASSOCIATIONS_BY_NAME.has(queryName)) {
        return QUERY_ASSOCIATIONS_BY_NAME.get(queryName)!.ruleName;
    } else {
        throw new Error(`Developer error: invalid query name ${queryName}`);
    }
}

export function getOptionalQueryIdsForRule(ruleName: string): string[] {
    const queryIds: string[] = [];
    for (const queryAssociation of QUERY_ASSOCIATIONS) {
        if (queryAssociation.isOptional && queryAssociation.ruleName === ruleName) {
            queryIds.push(queryAssociation.queryId);
        }
    }
    return queryIds;
}

export function getDescriptionForRule(ruleName: string): RuleDescription {
    // istanbul ignore else
    if (RULE_DESCRIPTIONS_BY_NAME.has(ruleName)) {
        return RULE_DESCRIPTIONS_BY_NAME.get(ruleName)!;
    } else {
        throw new Error(`Developer rule: No rule with name ${ruleName}`);
    }
}