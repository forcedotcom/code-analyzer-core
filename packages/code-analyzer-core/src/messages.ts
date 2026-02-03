import {getMessageFromCatalog, MessageCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : MessageCatalog = {
    ConfigOverview:
        `CODE ANALYZER CONFIGURATION\n` +
        `To learn more about this configuration, visit:\n` +
        `  https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/config-custom.html`,

    ConfigFieldDescription_config_root:
        `The absolute folder path to which all other path values in this configuration may be relative to.\n` +
        `If unspecified, or if specified as null, then the value is automatically chosen to be the parent folder of your Code Analyzer\n` +
        `configuration file if it exists, or the current working directory otherwise.`,

    ConfigFieldDescription_log_folder:
        `Folder where to store log files. May be an absolute path or a path relative to config_root.\n` +
        `If unspecified, or if specified as null, then the value is automatically chosen to be your machine's default temporary directory.`,

    ConfigFieldDescription_log_level:
        `Level at which to log messages to log files.\n` +
        `Possible values are:\n` +
        `  1 or 'Error' - Includes only error messages in the log.\n` +
        `  2 or 'Warn' - Includes warning and error messages in the log.\n` +
        `  3 or 'Info' - Includes informative, warning, and error messages in the log.\n` +
        `  4 or 'Debug' - Includes debug, informative, warning, and error messages in the log.\n` +
        `  5 or 'Fine' - Includes fine detail, debug, informative, warning, and error messages in the log.\n` +
        `If unspecified, or if specified as null, then the 'Debug' log level will be used.`,

    ConfigFieldDescription_rules:
        `Rule override settings of the format rules.{engine_name}.{rule_name}.{property_name} = {override_value} where:\n` +
        `  {engine_name} is the name of the engine containing the rule that you want to override.\n` +
        `  {rule_name} is the name of the rule that you want to override.\n` +
        `  {property_name} can either be:\n` +
        `    'severity' - [Optional] The severity level value that you want to use to override the default severity level for the rule\n` +
        `                 Possible values: 1 or 'Critical', 2 or 'High', 3 or 'Moderate', 4 or 'Low', 5 or 'Info'\n` +
        `    'tags'     - [Optional] The string array of tag values that you want to use to override the default tags for the rule\n` +
        `---- [Example usage]: ---------------------\n` +
        `rules:\n` +
        `  eslint:\n` +
        `    sort-vars:\n` +
        `      severity: "Info"\n` +
        `      tags: ["Recommended", "Suggestion"]\n` +
        `-------------------------------------------`,

    ConfigFieldDescription_engines:
        `Engine specific custom configuration settings of the format engines.{engine_name}.{property_name} = {value} where:\n` +
        `  {engine_name} is the name of the engine containing the setting that you want to override.\n` +
        `  {property_name} is the name of a property that you would like to override.\n` +
        `Each engine may have its own set of properties available to help customize that particular engine's behavior.`,

    ConfigFieldDescription_ignores:
        `Configuration for ignoring files during scanning. Contains the following field:\n` +
        `  'files' - [Optional] An array of file paths, folder paths, or glob patterns specifying which files to skip during analysis.\n` +
        `            Patterns support standard glob syntax:\n` +
        `              * matches any characters within a single directory level\n` +
        `              ** matches any characters across multiple directory levels\n` +
        `              ? matches exactly one character\n` +
        `---- [Example usage]: ---------------------\n` +
        `ignores:\n` +
        `  files:\n` +
        `    - "src/*.cls"           # All .cls files directly in src/\n` +
        `    - "test/*/data.json"    # data.json in any immediate subdirectory of test/\n` +
        `    - "**/*.test.js"        # All .test.js files anywhere\n` +
        `    - "**/node_modules/**"  # Anything inside any node_modules folder\n` +
        `-------------------------------------------`,

    GenericEngineConfigOverview:
        `%s ENGINE CONFIGURATION`,

    UnsupportedNodeVersion:
        `Code Analyzer requires Node v%s or later, but is currently running on Node %s. Please upgrade the version of 'node' on your machine.`,

    EngineConfigFieldDescription_disable_engine:
        `Whether to turn off the '%s' engine so that it is not included when running Code Analyzer commands.`,

    EngineFromFutureApiDetected:
        `The following engines use the engine api version %d: %s.\n` +
        `This version of Code Analyzer only has knowledge of the %d engine api.\n` +
        `Therefore some capabilities from these engines may not fully work with this version of Code Analyzer.`,

    DuplicateEngine:
        `Failed to add engine with name '%s' because an engine with this name has already been added to Code Analyzer.`,

    EngineNameContradiction:
        `Failed to add engine with name '%s' because its getName() method returns a different name of '%s'.`,

    UnexpectedEngineErrorRuleDescription:
        `This rule reports a violation when an unexpected error occurs from engine '%s'.`,

    UnexpectedEngineErrorViolationMessage:
        `The engine with name '%s' threw an unexpected error: %s`,

    UninstantiableEngineErrorRuleDescription:
        `This rule reports a violation when engine '%s' cannot be instantiated.`,

    UninstantiableEngineErrorViolationMessage:
        `The engine with name '%s' could not be instantiated. %s`,

    PluginErrorFromGetAvailableEngineNames:
        `Failed to add engine plugin. The plugin's getAvailableNames method threw an error:\n%s`,

    PluginErrorWhenCreatingEngine:
        `Failed to create engine with name '%s' due to the following error:\n%s`,

    PluginErrorWhenGettingRules:
        `Failed to get rules from engine with name '%s' due to the following error:\n%s`,

    InstructionsToIgnoreErrorAndDisableEngine:
        `If you wish to ignore this error and disable this engine, then update your Code Analyzer configuration with:\n` +
        `engines:\n` +
        `  %s:\n` +
        `    disable_engine: true`,

    FailedToDynamicallyLoadModule:
        `Failed to dynamically load module '%s'. Error: %s`,

    FailedToDynamicallyAddEnginePlugin:
        `Failed to dynamically add engine plugin from module '%s' because the module does not seem to export a 'createEnginePlugin' function.`,

    FailedToGetEngineConfig:
        `Failed to get configuration for engine with name '%s' since this engine has not been added to Code Analyzer.`,

    FailedToGetEngineConfigDescription:
        `Failed to get configuration description for engine with name '%s' since this engine has not been added to Code Analyzer.`,

    EngineDisabled:
        `Did not add engine with name '%s' since the '%s' configuration value is set to true.`,

    EngineAdded:
        `Engine with name '%s' was added to Code Analyzer.`,

    ConfigFileDoesNotExist:
        `The specified configuration file '%s' does not exist.`,

    ConfigFileExtensionUnsupported:
        `The specified configuration file '%s' has an unsupported file extension. Supported extensions are: %s`,

    ConfigContentFailedToParse:
        `Failed to parse the configuration content. Error:\n%s`,

    ConfigContentNotAnObject:
        `The configuration content is invalid since it is of type %s instead of type object.`,

    RulePropertyOverridden:
        `The %s value of rule '%s' of engine '%s' was overridden according to the specified configuration. The old value '%s' was replaced with the new value '%s'.`,

    ConfigPathValueMustBeAbsolute:
        `The '%s' configuration value must be provided as an absolute path location. Update the value '%s' to instead be '%s'.`,

    ConfigValueNotAValidEnumValue: // TODO: We should move this into the SHARED_MESSAGE_CATALOG to replace the 'ConfigValueNotAValidSeverityLevel' message
        `The '%s' configuration value must be one of the following: %s. Instead received: %s`,

    FileOrFolderDoesNotExist:
        `The file or folder '%s' does not exist.`,

    UndefinedCodeLocationComment:
        `Undefined Code Location`,

    AtLeastOneFileOrFolderMustBeIncludedInWorkspace:
        `At least one file or folder must be included in the workspace.`,

    TargetMustLiveWithinWorkspace:
        `The specified target '%s' does not exist underneath any of the specified workspace paths: %s`,

    GatheringRulesFromEngine:
        `Gathering all available rules from engine '%s'.`,

    FinishedGatheringRulesFromEngine:
        `Finished gathering %d available rule(s) from engine '%s'.`,

    RunningWithWorkspace:
        `Running with the following workspace: %s`,

    RunningEngineWithRules:
        `Running engine '%s' with the following rules: %s`,

    FinishedRunningEngine:
        `Finished running engine '%s'.`,

    RuleDoesNotExistInSelection:
        `No rule with name '%s' and engine '%s' exists among the selected rules.`,

    SelectorCannotBeEmpty:
        `Rule selectors can't be empty strings.`,

    SelectorLooksIncorrect:
        `Rule selector '%s' looks incorrect. Make sure that the expression contains no whitespace, the parentheses are balanced, and that all subselectors are joined by a colon (:) or comma (,).`,

    SelectorStartsOrEndsWithOperator:
        `Rule selectors should not start or end with an operator. Selector: '%s'`,

    EngineRunResultsMissing:
        `Couldn't get results for engine '%s' since they're missing from the overall run results. Most likely the engine didn't run.`,

    EngineReturnedMultipleRulesWithSameName:
        `Engine failure. The engine '%s' returned more than one rule with the name '%s'.`,

    EngineReturnedViolationForUnselectedRule:
        `Engine failure. The engine '%s' returned a violation for rule '%s' which was not selected.`,

    EngineReturnedViolationWithEmptyCodeLocationArray:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains an an empty code location array. Rule violations must have at least one code location object.`,

    EngineReturnedViolationWithInvalidPrimaryLocationIndex:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains an out of bounds primary location index value of %d. Expected a non-negative integer that is less than %d.`,

    EngineReturnedViolationWithCodeLocationFileThatDoesNotExist:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains a code location with a file that does not exist: %s`,

    EngineReturnedViolationWithCodeLocationFileAsFolder:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains a code location with a folder instead of a file: %s`,

    EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains a code location with an invalid '%s' value: %d`,

    EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains a code location with the endLine %d before the startLine %d.`,

    EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine:
        `Engine failure. The engine '%s' returned a violation for rule '%s' that contains a code location with the endLine equal to the startLine and the endColumn %d before the startColumn %d.`,

    AllWorkingFoldersKept:
        `Since preserve_all_working_folders config setting is true, all temporary working folders in %s have been kept.`,

    EngineWorkingFolderKeptDueToError:
        `Since the engine '%s' emitted an error, the following temporary working folder will not be removed: %s`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}
