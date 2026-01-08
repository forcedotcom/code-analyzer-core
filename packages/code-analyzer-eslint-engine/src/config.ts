import {
    ConfigDescription,
    ConfigValueExtractor,
    ValueValidator
} from '@salesforce/code-analyzer-engine-api';
import {getMessage} from "./messages";
import path from "node:path";
import {makeUnique} from "./utils";

export type ESLintEngineConfig = {
    // Your project's main ESLint configuration file. May be provided as a path relative to the config_root.
    // If not supplied, and auto_discover_eslint_config=true, then Code Analyzer will attempt to find and apply it automatically.
    eslint_config_file?: string

    // Your project's ".eslintignore" file. May be provided as a path relative to the config_root.
    // If not supplied, and auto_discover_eslint_config=true, then Code Analyzer will attempt to find and apply it automatically.
    eslint_ignore_file?: string

    // If true then ESLint will attempt to look up and apply any ESLint configuration and ignore files found in your workspace.
    // Default: false
    auto_discover_eslint_config: boolean

    // If true then the base configuration that supplies the standard eslint rules for javascript files will not be applied.
    // Default: false
    disable_javascript_base_config: boolean

    // If true then the base configuration that supplies the lwc rules for javascript files will not be applied.
    // Default: false
    disable_lwc_base_config: boolean

    // If true then the base configuration that supplies the slds rules for html, cmp, and css files will not be applied.
    // Default: false
    disable_slds_base_config: boolean

    // If true then the base configuration that supplies the standard rules for typescript files will not be applied.
    // Default: false
    disable_typescript_base_config: boolean

    // If true then the base configuration that supplies the React/JSX rules will not be applied.
    // Default: true (React support is currently gated; will change to false when released)
    disable_react_base_config: boolean

    // Extensions of the files in your workspace that will be used to discover rules.
    // To associate file extensions to the standard ESLint JavaScript rules, LWC rules, or custom JavaScript-based
    // rules, add them under the 'javascript' language. To associate file extensions to the standard TypeScript
    // rules or custom TypeScript-based rules, add them under the 'typescript' language. To associate file extensions
    // to standard LWC HTML rules, Component (CMP) rules, or custom HTML rules, add them under the 'html' language.
    // To associate file extensions to CSS or SCSS rules, add them under the 'css' language. To allow for the 
    // discovery of custom rules that are associated with any other language, then add the associated file extensions
    // under the 'other' language.
    file_extensions: FileExtensionsObject

    // (INTERNAL USE ONLY) Copy of the code analyzer config root.
    config_root: string
}

export type FileExtensionsObject = {
    javascript: string[],
    typescript: string[],
    html: string[],
    css: string[],
    other: string[]
};

export const DEFAULT_CONFIG: ESLintEngineConfig = {
    eslint_config_file: undefined,
    eslint_ignore_file: undefined,
    auto_discover_eslint_config: false,
    disable_javascript_base_config: false,
    disable_lwc_base_config: false,
    disable_slds_base_config: false,
    disable_typescript_base_config: false,
    disable_react_base_config: true,  // Gated for now - will change to false when released
    file_extensions: {
        javascript: ['.js', '.cjs', '.mjs', '.jsx'],
        typescript: ['.ts', '.tsx'],
        html: ['.html', '.htm', '.cmp'],
        css: ['.css', '.scss'],
        other: []
    },
    config_root: process.cwd() // INTERNAL USE ONLY
}

export const ESLINT_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        eslint_config_file: {
            descriptionText: getMessage('ConfigFieldDescription_eslint_config_file'),
            valueType: "string",
            defaultValue: null
        },
        eslint_ignore_file: {
            descriptionText: getMessage('ConfigFieldDescription_eslint_ignore_file'),
            valueType: "string",
            defaultValue: null
        },
        auto_discover_eslint_config: {
            descriptionText: getMessage('ConfigFieldDescription_auto_discover_eslint_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.auto_discover_eslint_config
        },
        disable_javascript_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_javascript_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_javascript_base_config
        },
        disable_lwc_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_lwc_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_lwc_base_config
        },
        disable_slds_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_slds_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_slds_base_config
        },
        disable_typescript_base_config: {
            descriptionText: getMessage('ConfigFieldDescription_disable_typescript_base_config'),
            valueType: "boolean",
            defaultValue: DEFAULT_CONFIG.disable_typescript_base_config
        },
        // Note: disable_react_base_config is gated and not user-configurable yet
        // TODO: Add to fieldDescriptions when React support is released
        file_extensions: {
            descriptionText: getMessage('ConfigFieldDescription_file_extensions'),
            valueType: "object",
            defaultValue: DEFAULT_CONFIG.file_extensions
        }
    }
}

// See https://eslint.org/docs/latest/use/configure/configuration-files
// We currently do not support Typescript config files are since they require additional setup
export const DISCOVERABLE_FLAT_ESLINT_CONFIG_FILES: string[] =
    ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.mjs'];
export const FLAT_ESLINT_CONFIG_FILE_EXTS: string[] = ['.js', '.cjs', '.mjs'];

// See https://eslint.org/docs/v8.x/use/configure/configuration-files#configuration-file-formats
export const LEGACY_ESLINT_CONFIG_FILES: string[] =
    ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc.json'];

export const LEGACY_ESLINT_IGNORE_FILE: string = '.eslintignore';


export function validateAndNormalizeConfig(configValueExtractor: ConfigValueExtractor): ESLintEngineConfig {
    // disable_react_base_config bypasses validation - React support is gated but we need it for internal testing
    // TODO: Move 'disable_react_base_config' to validateContainsOnlySpecifiedKeys when React support is released
    configValueExtractor.addKeysThatBypassValidation(['disable_react_base_config']);
    configValueExtractor.validateContainsOnlySpecifiedKeys(['eslint_config_file', 'eslint_ignore_file',
        'auto_discover_eslint_config', 'disable_javascript_base_config', 'disable_lwc_base_config',
        'disable_slds_base_config', 'disable_typescript_base_config', 'file_extensions']);

    const eslintConfigValueExtractor: ESLintEngineConfigValueExtractor = new ESLintEngineConfigValueExtractor(configValueExtractor);
    return {
        config_root: configValueExtractor.getConfigRoot(), // INTERNAL USE ONLY
        eslint_config_file: eslintConfigValueExtractor.extractESLintConfigFileValue(),
        eslint_ignore_file: eslintConfigValueExtractor.extractESLintIgnoreFileValue(),
        auto_discover_eslint_config: eslintConfigValueExtractor.extractBooleanValue('auto_discover_eslint_config'),
        disable_javascript_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_javascript_base_config'),
        disable_lwc_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_lwc_base_config'),
        disable_slds_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_slds_base_config'),
        disable_typescript_base_config: eslintConfigValueExtractor.extractBooleanValue('disable_typescript_base_config'),
        // React support is gated - always force to true regardless of customer config
        // TODO: Change to eslintConfigValueExtractor.extractBooleanValue('disable_react_base_config') when released
        disable_react_base_config: true,
        file_extensions:  eslintConfigValueExtractor.extractFileExtensionsValue(),
    };
}

class ESLintEngineConfigValueExtractor {
    private static readonly FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;
    private readonly delegateExtractor: ConfigValueExtractor;

    constructor(delegateExtractor: ConfigValueExtractor) {
        this.delegateExtractor = delegateExtractor;
    }

    extractESLintConfigFileValue(): string | undefined {
        const eslintConfigFileField: string = 'eslint_config_file';
        const eslintConfigFile: string | undefined = this.delegateExtractor.extractFile(eslintConfigFileField, DEFAULT_CONFIG.eslint_config_file);
        if (eslintConfigFile && !(isValidLegacyConfigFileName(eslintConfigFile) || isValidFlatConfigFileName(eslintConfigFile))) {
            throw new Error(getMessage('InvalidESLintConfigFileName',
                this.delegateExtractor.getFieldPath(eslintConfigFileField),
                JSON.stringify(FLAT_ESLINT_CONFIG_FILE_EXTS),
                JSON.stringify(LEGACY_ESLINT_CONFIG_FILES)));
        }
        return eslintConfigFile;
    }

    extractESLintIgnoreFileValue(): string | undefined {
        const eslintIgnoreFileField: string = 'eslint_ignore_file';
        const eslintIgnoreFile: string | undefined = this.delegateExtractor.extractFile(eslintIgnoreFileField, DEFAULT_CONFIG.eslint_ignore_file);
        if (eslintIgnoreFile && path.basename(eslintIgnoreFile) !== LEGACY_ESLINT_IGNORE_FILE) {
            throw new Error(getMessage('InvalidLegacyIgnoreFileName', this.delegateExtractor.getFieldPath(eslintIgnoreFileField),
                path.basename(eslintIgnoreFile), LEGACY_ESLINT_IGNORE_FILE));
        }
        return eslintIgnoreFile;
    }

    extractFileExtensionsValue(): FileExtensionsObject {
        const fileExtensionsExtractor: ConfigValueExtractor = this.delegateExtractor.extractObjectAsExtractor(
            'file_extensions', DEFAULT_CONFIG.file_extensions);
        fileExtensionsExtractor.validateContainsOnlySpecifiedKeys(Object.keys(DEFAULT_CONFIG.file_extensions));

        const extToLangMap: Map<string, string> = new Map(); // To keep track if file extension shows up with more than one language
        const fileExtensionsMap: FileExtensionsObject = {... DEFAULT_CONFIG.file_extensions}; // Start with copy
        for (const language of Object.keys(fileExtensionsMap)) {
            const fileExts: string[] = makeUnique(fileExtensionsExtractor.extractArray(language,
                (element, elementFieldPath) => ValueValidator.validateString(element,
                    elementFieldPath, ESLintEngineConfigValueExtractor.FILE_EXT_PATTERN),
                DEFAULT_CONFIG.file_extensions[language as keyof FileExtensionsObject]
            )!.map(fileExt => fileExt.toLowerCase()));

            // Validate that none of the file extensions already exist in another language
            for (const fileExt of fileExts) {
                if (extToLangMap.has(fileExt) && extToLangMap.get(fileExt) !== language) {
                    throw new Error(getMessage('InvalidFileExtensionDueToItBeingListedTwice',
                        fileExtensionsExtractor.getFieldPath(), fileExt,
                        JSON.stringify([extToLangMap.get(fileExt), language])));
                }
                extToLangMap.set(fileExt, language);
            }

            fileExtensionsMap[language as keyof FileExtensionsObject] = fileExts;
        }
        return fileExtensionsMap;
    }

    extractBooleanValue(field_name: string): boolean {
        return this.delegateExtractor.extractBoolean(field_name, DEFAULT_CONFIG[field_name as keyof ESLintEngineConfig] as boolean)!;
    }
}

function isValidLegacyConfigFileName(eslintConfigFile: string): boolean {
    // For legacy config files, we only allow specific file names so we are confident it is a legacy config file.
    return LEGACY_ESLINT_CONFIG_FILES.includes(path.basename(eslintConfigFile).toLowerCase());
}

function isValidFlatConfigFileName(eslintConfigFile: string): boolean {
    return FLAT_ESLINT_CONFIG_FILE_EXTS.includes(path.extname(eslintConfigFile).toLowerCase());
}
