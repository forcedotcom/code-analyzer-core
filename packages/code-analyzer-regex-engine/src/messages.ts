import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    ConfigOverview:
        `REGEX ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit:\n` +
        `  https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engine-regex.html#regex-configuration-reference`,

    ConfigFieldDescription_custom_rules:
        `Custom rules to be added to the 'regex' engine of the format custom_rules.{rule_name}.{rule_property_name} = {value} where:\n` +
        `  {rule_name} is the name you would like to give to your custom rule\n` +
        `  {rule_property_name} is the name of one of the rule properties. You may specify the following rule properties:\n` +
        `    'regex'             - The regular expression that triggers a violation when matched against the contents of a file.\n` +
        `    'regex_ignore' - [Optional] The negative pattern - matches that also match this pattern will be excluded.\n` +
        `                          This allows you to exclude false positives by specifying patterns that should NOT be flagged.\n` +
        `                          Example: To match email headers with user input but exclude 'validatedMessageId':\n` +
        `                          regex: /(To|From):\\s*\\$\\([^)]+\\)/gi\n` +
        `                          regex_ignore: /\\$\\(\\s*validatedMessageId\\s*\\)/gi\n` +
        `    'file_extensions'   - The extensions of the files that you would like to test the regular expression against.\n` +
        `    'description'       - A description of the rule's purpose\n` +
        `    'violation_message' - [Optional] The message emitted when a rule violation occurs.\n` +
        `                          This message is intended to help the user understand the violation.\n` +
        `                          Default: 'A match of the regular expression {regex} was found for rule {rule_name}: {description}'\n` +
        `    'severity'          - [Optional] The severity level to apply to this rule by default.\n` +
        `                          Possible values: 1 or 'Critical', 2 or 'High', 3 or 'Moderate', 4 or 'Low', 5 or 'Info'\n` +
        `                          Default: 3\n` +
        `    'tags'              - [Optional] The string array of tag values to apply to this rule by default.\n` +
        `                          Default: ['Recommended']\n` +
        `---- [Example usage]: ---------------------\n` +
        `engines: \n` +
        `  regex:\n` +
        `    custom_rules:\n` +
        `      "NoTodoComments":\n` +
        `        regex: /\\/\\/[ \\t]*TODO/gi\n` +
        `        file_extensions: [".apex", ".cls", ".trigger"]\n` +
        `        description: "Prevents TODO comments from being in apex code."\n` +
        `        violation_message: "A comment with a TODO statement was found. Please remove TODO statements from your apex code."\n` +
        `        severity: "Info"\n` +
        `        tags: ["TechDebt"]\n` +
        `      "DataWeaveEmailHeaderInjection":\n` +
        `        regex: /(To|From|Subject):\\s*\\$\\([^)]+\\)/gi\n` +
        `        regex_ignore: /\\$\\(\\s*validatedMessageId\\s*\\)/gi\n` +
        `        file_extensions: [".dwl"]\n` +
        `        description: "Detects user input in email headers, excluding validated IDs."\n` +
        `        severity: "Critical"\n` +
        `        tags: ["Security"]\n` +
        `-------------------------------------------`,

    UnsupportedEngineName:
        `The RegexEnginePlugin does not support an engine with name '%s'.`,

    TrailingWhitespaceRuleDescription:
        `Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.`,

    TrailingWhitespaceRuleMessage:
        `Found trailing whitespace at the end of a line of code.`,

    MixedIndentationRuleDescription:
        `Identifies lines with both spaces and tabs in the leading indentation. Mixed indentation causes unexpected behavior in multiline strings because the indentation algorithm processes whitespace differently.`,

    MixedIndentationRuleMessage:
        `Leading indentation contains mixed spaces and tabs. To fix this, use either spaces or tabs.`,

    AvoidTermsWithImplicitBiasRuleDescription:
        `"Detects usage of terms that reinforce implicit bias.`,

    AvoidTermsWithImplicitBiasRuleMessage:
        `A term with implicit bias was found. Avoid using any of the following terms: %s`,

    AvoidOldSalesforceApiVersionsRuleDescription:
        `Detects usages of Salesforce API versions that are 3 or more years old.`,

    AvoidOldSalesforceApiVersionsRuleMessage:
        `Found the use of a Salesforce API version that is 3 or more years old. Avoid using an API version that is <= %d.0.`,

    AvoidGetHeapSizeInLoopRuleDescription:
        `Detects usage of Limits.getHeapSize() in loops`,

    AvoidGetHeapSizeInLoopRuleMessage:
        `Found the use of Limits.getHeapSize() in a loop. We recommend you avoid this pattern due to performance and resource reasons.`,

    MinVersionForAbstractVirtualClassesWithPrivateMethodRuleDescription:
        `Detects private methods within abstract/virtual classes when the corresponding API version of the class is less than v61.0.`,

    MinVersionForAbstractVirtualClassesWithPrivateMethodRuleMessage:
        `Found private methods within abstract/virtual classes. Make sure the corresponding API version of the class is at least v61.0.`,

    RuleViolationMessage:
        `A match of the regular expression %s was found for rule '%s': %s`,

    InvalidRuleName:
        `The rule name '%s' defined within the '%s' configuration value is invalid. The rule name must match the regular expression: '%s'`,

    InvalidConfigurationValueWithReason:
        `The '%s' configuration value is invalid. %s`,

    InvalidRegexDueToBadPattern:
        `The value '%s' could not be converted into a regular expression since it does not match the regular expression pattern: %s`,

    InvalidRegexDueToGlobalModifierNotProvided:
        `The value '%s' could not be converted into a regular expression since the required 'g' modifier is missing. Please use '%s' instead.`,

    InvalidRegexDueToError:
        `The value '%s' could not be converted into a regular expression due to the error: %s`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}
