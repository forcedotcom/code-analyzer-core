import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    ConfigOverview:
        `ESLINT ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit:\n` +
        `  https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engine-eslint.html#eslint-configuration-reference`,

    ConfigFieldDescription_eslint_config_file:
        `Your project's main ESLint configuration file. May be an absolute path or a path relative to the config_root.\n` +
        `If null and auto_discover_eslint_config is true, then Code Analyzer will attempt to discover/apply it automatically.\n` +
        `We currently support both flat and legacy ESLint configuration files, but will be removing support for legacy eslintrc\n` +
        `ESLint configuration files in the coming months.\n` +
        `See https://eslint.org/docs/latest/use/configure/configuration-files to learn more.`,

    ConfigFieldDescription_eslint_ignore_file:
        `Your project's legacy ".eslintignore" file. May be an absolute path or a path relative to the config_root.\n` +
        `If null and auto_discover_eslint_config is true, then Code Analyzer will attempt to discover/apply it automatically.\n` +
        `Legacy ".eslintignore" files are currently only supported with ESLint v8 when used alongside of legacy ESLint configuration\n` +
        `files. We will be removing support for ESLint v8 and this field in the coming months. Therefore, we recommend that you instead\n` +
        `supply the files that you wish to ignore within a flat ESLint configuration file, specified by the eslint_config_file field.\n` +
        `See https://eslint.org/docs/latest/use/configure/ignore to learn more.`,

    ConfigFieldDescription_auto_discover_eslint_config:
        `Whether to have Code Analyzer automatically discover/apply any ESLint configuration and ignore files from your workspace.`,

    ConfigFieldDescription_disable_javascript_base_config:
        `Whether to turn off the default base configuration that supplies the standard ESLint rules for JavaScript files.\n` +
        `The base configuration for JavaScript files adds the rules from the "eslint:all" configuration to Code Analyzer.\n` +
        `See https://eslint.org/docs/latest/rules for the list of rules.`,

    ConfigFieldDescription_disable_lwc_base_config:
        `Whether to turn off the default base configuration that supplies the LWC rules for JavaScript files.\n` +
        `The base configuration for LWC adds the rules from the "@salesforce/eslint-config-lwc/recommended"\n` +
        `and "plugin:@lwc/lwc-platform/recommended" configurations to Code Analyzer.\n` +
        `See https://github.com/salesforce/eslint-config-lwc and https://www.npmjs.com/package/@lwc/eslint-plugin-lwc-platform.`,

    ConfigFieldDescription_disable_slds_base_config:
        `Whether to turn off the default base configuration that supplies the SLDS rules for Lightning Web Components and Aura Components.\n` +
        `The base configuration for SLDS adds the rules from the "plugin:@salesforce-ux/eslint-plugin-slds/recommended" configuration to Code Analyzer.\n` +
        `See https://www.npmjs.com/package/@salesforce-ux/eslint-plugin-slds`,

    ConfigFieldDescription_disable_typescript_base_config:
        `Whether to turn off the default base configuration that supplies the standard rules for TypeScript files\n` +
        `The base configuration for TypeScript files adds the rules from the "plugin:@typescript-eslint:all" configuration to Code Analyzer.\n` +
        `See https://typescript-eslint.io/rules and https://eslint.org/docs/latest/rules for the lists of rules.`,

    ConfigFieldDescription_disable_react_base_config:
        `Whether to turn off the default base configuration that supplies the React/JSX rules for .jsx and .tsx files\n` +
        `The base configuration for React adds the rules from the "eslint-plugin-react" configuration to Code Analyzer.\n` +
        `See https://www.npmjs.com/package/eslint-plugin-react for the list of rules.`,

    ConfigFieldDescription_file_extensions:
        `Extensions of the files in your workspace that will be used to discover rules.\n` +
        `To associate file extensions to the standard ESLint JavaScript rules, LWC rules, or custom JavaScript-based\n` +
        `rules, add them under the 'javascript' language. To associate file extensions to the standard TypeScript\n` +
        `rules or custom TypeScript-based rules, add them under the 'typescript' language.\n` +
        `To associate file extensions to standard LWC HTML rules, Component (CMP) rules, or custom HTML rules, add them\n` +
        `under the 'html' language. To associate file extensions to CSS or SCSS rules, add them under the 'css' language.\n`+
        `To allow for the discovery of custom rules that are associated with any other language,\n` +
        `then add the associated file extensions under the 'other' language.`,

    UnsupportedEngineName:
        `The ESLintEnginePlugin doesn't support an engine with name '%s'.`,

    InvalidESLintConfigFileName:
        `The '%s' configuration value is invalid. Expected either a flat ESLint configuration file that ends with %s or a known legacy eslintrc ESLint configuration file name from among %s.`,

    InvalidLegacyIgnoreFileName:
        `The '%s' configuration value is invalid. Expected the file name '%s' to be equal to '%s'.`,

    InvalidFileExtensionDueToItBeingListedTwice:
        `The '%s' configuration object is invalid. The file extension '%s' is currently listed under more than one language: %s`,

    ESLintErroredWhenScanningFile:
        `When scanning file '%s' with the eslint engine, ESLint gave the following error:\n%s`,

    ESLintWarnedWhenScanningFile:
        `When scanning file '%s' with the eslint engine, ESLint gave the following warning:\n%s`,

    ESLintThrewExceptionWithUnknownMessage:
        `The eslint engine encountered an unexpected error thrown from '%s':\n%s\n\n` +
        'ESLint options used:\n%s',

    ViolationFoundFromUnregisteredRule:
        `A rule with name '%s' produced a violation, but this rule was not registered with the 'eslint' engine so it will not be included in the results.\n` +
        `This may occur if in your file you are using inline comments to attempt to disable or configure this rule even though it is unknown to ESLint and Code Analyzer.\n` +
        `Ignored Violation:\n%s`,

    UnusedESLintConfigFile:
        `The ESLint configuration file '%s' was found but not applied.\n` +
        `To apply this configuration file, set it as the eslint_config_file value in your Code Analyzer configuration. For example:\n` +
        `  engines:\n` +
        `    eslint:\n` +
        `      eslint_config_file: "%s"\n` +
        `Alternatively, to have Code Analyzer attempt to automatically discover your ESLint configuration file in your workspace, set the auto_discover_eslint_config value to true.`,

    IgnoringLegacyIgnoreFile:
        `Ignoring '%s' since ESLint v9+ doesn't support legacy ignore files.`,

    DetectedLegacyConfig:
        `Using ESLint v8 instead of ESLint v9 because we detected the use of a legacy eslintrc ESLint configuration file or ignore file was detected: %s.\n` +
        `Because ESLint v8 is no longer supported, Code Analyzer will be removing support for legacy eslintrc ESLint configuration files in the coming months.\n` +
        `Therefore, we highly recommend that you migrate your legacy eslintrc configuration to the new flat configuration format as soon as possible.\n` +
        `Learn how at: https://eslint.org/docs/latest/use/configure/migration-guide`,

    ApplyingFlatConfigFile:
        `Applying the flat ESLint configuration file: %s`,

    SkippedAutoDiscoveredExecutableConfigFile:
        `The executable ESLint configuration file '%s' was automatically discovered in your workspace but was NOT applied.\n` +
        `Code Analyzer does not execute automatically discovered configuration files because their top-level JavaScript would run during analysis.\n` +
        `If you trust this file and want to apply it, set it explicitly as the eslint_config_file value in your Code Analyzer configuration.`,

    ExplicitExecutableConfigFileWillExecute:
        `The explicitly configured ESLint configuration file '%s' contains executable JavaScript whose top-level code will run during analysis.\n` +
        `Only apply configuration files that you trust.`,

    UnableToCalculateBaseDirectory:
        `Couldn't calculate base directory for ESLint from the list of relevant targeted files to scan.\n` +
        `This can occur if you are attempting to target files from more than one drive (like C: and D: drives for example).\n` +
        `The list of relevant targeted files:\n%s`,

    ConfigResolutionReplacedPlugin:
        `While attempting to resolve the ESLint configuration array, the plugin reference '%s' was found to be associated with more than one plugin:\n` +
        ` --> %s (from %s)\n` +
        ` --> %s (most likely from %s)\n` +
        `To avoid a conflict, the plugin from the %s has been replaced with %s.`,

    BaseConfigLabel:
        'base config',

    ConfigFileLabel:
        `config file '%s'`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}
