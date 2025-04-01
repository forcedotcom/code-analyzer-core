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
    ['Flow: SystemModeWithSharing recordUpdates selector', PREVENT_PASSING_USER_DATA_WITH_SHARING]
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