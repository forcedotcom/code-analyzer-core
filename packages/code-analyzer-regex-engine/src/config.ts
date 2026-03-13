import {
    COMMON_TAGS,
    ConfigDescription,
    ConfigValueExtractor,
    SeverityLevel,
    ValueValidator
} from "@salesforce/code-analyzer-engine-api"
import {getMessage} from "./messages";
import {convertToRegex} from "./utils";

export type RegexEngineConfig = {
    custom_rules: RegexRules
}

export const REGEX_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        custom_rules: {
            descriptionText: getMessage('ConfigFieldDescription_custom_rules'),
            valueType: "object",
            defaultValue: {}
        }
    }
}

export type RegexRules = {
    [ruleName: string] : RegexRule
}

export type RegexRule = {
    // The regular expression that triggers a violation when matched against the contents of a file.
    regex: string;

    // [Optional] The negative pattern - matches that also match this pattern will be excluded from violations.
    // This allows you to exclude false positives by specifying patterns that should NOT be flagged.
    // Example: regex: /(To|From):\s*\$\([^)]+\)/ with pattern_not_regex: /\$\(validatedMessageId\)/
    pattern_not_regex?: string;

    // The extensions of the files that you would like to test the regular expression against.
    // If not defined, or equal to null, then all text-based files of any file extension will be tested.
    file_extensions?: string[];

    // A description of the rule's purpose.
    description: string;

    // [Optional] The message emitted when a rule violation occurs. This message is intended to help the user understand the violation.
    // Default: `A match of the regular expression <regex> was found for rule '<ruleName>': <description>`
    violation_message: string;

    // [Optional] The string array of tag values to apply to this rule by default.
    // Default: ['Recommended']
    tags: string[];

    // [Optional] The severity level to apply to this rule by default.
    // Possible values: 1 or 'Critical', 2 or 'High', 3 or 'Moderate', 4 or 'Low', 5 or 'Info'
    // Default: 'Moderate'
    severity: SeverityLevel;

    // [Optional] If the corresponding -meta.xml file should be included for analysis
    // INTERNAL USE ONLY (NOT EXPOSED TO USER CONFIG)
    include_metadata?: boolean;
}

export const FILE_EXT_PATTERN: RegExp = /^([.][a-zA-Z0-9-_]+)+$/;
export const RULE_NAME_PATTERN: RegExp = /^[A-Za-z@][A-Za-z_0-9@\-/]*$/;
export const REGEX_STRING_PATTERN: RegExp = /^\/(.*)\/(.*)$/;

export const DEFAULT_SEVERITY_LEVEL: SeverityLevel = SeverityLevel.Moderate;

export function validateAndNormalizeConfig(valueExtractor: ConfigValueExtractor): RegexEngineConfig {
    valueExtractor.validateContainsOnlySpecifiedKeys(['custom_rules']);
    const customRulesExtractor: ConfigValueExtractor = valueExtractor.extractObjectAsExtractor('custom_rules');
    const customRules: RegexRules = {};
    for (const ruleName of customRulesExtractor.getKeys()) {
        if (!RULE_NAME_PATTERN.test(ruleName)){
            throw new Error(getMessage('InvalidRuleName', ruleName, customRulesExtractor.getFieldPath(), RULE_NAME_PATTERN.toString()));
        }
        const ruleExtractor: ConfigValueExtractor = customRulesExtractor.extractRequiredObjectAsExtractor(ruleName);
        const description: string = ruleExtractor.extractRequiredString('description');
        const rawRegexString: string = ruleExtractor.extractRequiredString('regex');
        const regexString: string = validateRegexString(rawRegexString, ruleExtractor.getFieldPath('regex'));
        const rawPatternNotRegex: string | undefined = ruleExtractor.extractString('pattern_not_regex');
        const patternNotRegexString: string | undefined = rawPatternNotRegex
            ? validateRegexString(rawPatternNotRegex, ruleExtractor.getFieldPath('pattern_not_regex'))
            : undefined;
        const rawFileExtensions: string[] | undefined = ruleExtractor.extractArray('file_extensions',
            (element, fieldPath) => ValueValidator.validateString(element, fieldPath, FILE_EXT_PATTERN));

        customRules[ruleName] = {
            regex: regexString,
            description: description,
            violation_message: ruleExtractor.extractString('violation_message',
                getDefaultRuleViolationMessage(regexString, ruleName, description))!,
            severity: ruleExtractor.extractSeverityLevel('severity', DEFAULT_SEVERITY_LEVEL)!,
            tags: ruleExtractor.extractArray('tags', ValueValidator.validateString, [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CUSTOM])!,
            ...(rawFileExtensions ? { file_extensions: normalizeFileExtensions(rawFileExtensions) } : {}),
            ...(patternNotRegexString ? { pattern_not_regex: patternNotRegexString } : {}),
        }
    }
    return {
        custom_rules: customRules
    };
}

function getDefaultRuleViolationMessage(regexString: string, ruleName: string, description: string): string {
    return getMessage('RuleViolationMessage', regexString, ruleName, description)
}

function validateRegexString(value: string, fieldName: string): string {
    try {
        return convertToRegex(value).toString();
    } catch (err) {

        const errMsg: string = err instanceof Error ? err.message : /* istanbul ignore next */ String(err);
        throw new Error(getMessage('InvalidConfigurationValueWithReason', fieldName, errMsg), {cause: err});
    }
}

function normalizeFileExtensions(rawFileExts: string[]): string[] {
    return [... new Set(rawFileExts.map(ext => ext.toLowerCase()))];
}
