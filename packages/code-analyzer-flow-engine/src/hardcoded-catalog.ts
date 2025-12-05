import {COMMON_TAGS, RuleDescription, SeverityLevel} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from './messages';

// Code Analyzer rule names (these match the Python flow scanner query IDs 1:1)
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
        name: RuleName.HardCodedId,
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

export function getDescriptionForRule(ruleName: string): RuleDescription {
    // istanbul ignore else
    if (RULE_DESCRIPTIONS_BY_NAME.has(ruleName)) {
        return RULE_DESCRIPTIONS_BY_NAME.get(ruleName)!;
    } else {
        throw new Error(`Developer error: No rule with name ${ruleName}`);
    }
}
