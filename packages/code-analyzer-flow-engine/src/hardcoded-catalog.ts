import {COMMON_TAGS, RuleDescription, SeverityLevel} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from './messages';

// Code Analyzer rule names
//   Good news: The python flow scanner query ids now happen to be the exact same names as our code analyzer rule names
//   so we no longer need to keep a map between the two.
enum RuleName {
    CyclicSubflow = 'CyclicSubflow',
    DbInLoop = 'DbInLoop',
    DefaultCopy = 'DefaultCopy',
    HardcodedId = 'HardcodedId',
    MissingDescription = 'MissingDescription',
    MissingFaultHandler = 'MissingFaultHandler',
    MissingNextValueConnector = 'MissingNextValueConnector',
    PreventPassingUserDataIntoElementWithoutSharing = 'PreventPassingUserDataIntoElementWithoutSharing',
    PreventPassingUserDataIntoElementWithSharing = 'PreventPassingUserDataIntoElementWithSharing',
    SameRecordUpdate = 'SameRecordUpdate',
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
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,   COMMON_TAGS.LANGUAGES.XML],
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

export function getAllRuleNames(): string[] {
    return Object.values(RuleName);
}

export function getRuleNameFromQueryId(queryId: string): string {
    // Good news: The python flow scanner query ids now happen to be the exact same names as our code analyzer rule names
    //  so we no longer need to keep a map between the two. But leaving this helper just in case we need it again in the
    //  future.

    // istanbul ignore else
    if (Object.values(RuleName).includes(queryId as RuleName)) {
        return queryId;
    } else {
        throw new Error(`Developer error: invalid query id ${queryId}`);
    }
}

export function getQueryIdsForRule(ruleName: string): string[] {
    // It used to be that a single Code Analyzer rule could map to multiple flow scanner query ids. But now
    // they are mapped 1-to-1 and happen to be the exact same names. But keeping the output as a string array
    // just in case things change in the future.
    const queryIds: string[] = [ruleName];
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