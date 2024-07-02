import * as engApi from "@salesforce/code-analyzer-engine-api";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from "node:os";
import * as yaml from 'js-yaml';
import {getMessage} from "./messages";
import {toAbsolutePath} from "./utils"
import {SeverityLevel} from "./rules";

export const FIELDS = {
    CONFIG_FOLDER: 'config_folder',
    LOG_FOLDER: 'log_folder',
    CUSTOM_ENGINE_PLUGIN_MODULES: 'custom_engine_plugin_modules',
    RULES: 'rules',
    ENGINES: 'engines',
    SEVERITY: 'severity',
    TAGS: 'tags'
} as const;

export type RuleOverride = {
    severity?: SeverityLevel
    tags?: string[]
}

type TopLevelConfig = {
    // The absolute folder path where other paths values in the config may be relative to.
    // Default: The location of the config file if supplied and the current working directory otherwise.
    config_folder: string

    // Folder where the user would like to store log files. May be relative to config_folder.
    // Default: The default temporary directory on the user's machine.
    log_folder: string

    // List of EnginePlugin modules to be dynamically added. Paths may be relative to the config_folder.
    custom_engine_plugin_modules: string[]

    // Rule override entries of the format rules.<engine_name>.<rule_name>.<property_name> = <override_value>
    rules: Record<string, Record<string, RuleOverride>>

    // Engine specific configuration entries of the format engines.<engine_name>.<engine_specific_property> = <value>
    engines: Record<string, engApi.ConfigObject>
}

const DEFAULT_CONFIG: TopLevelConfig = {
    config_folder: process.cwd(),
    log_folder: os.tmpdir(),
    custom_engine_plugin_modules: [],
    rules: {},
    engines: {}
};

export class CodeAnalyzerConfig {
    private readonly config: TopLevelConfig;

    public static withDefaults() {
        return new CodeAnalyzerConfig(DEFAULT_CONFIG);
    }

    public static fromFile(file: string) {
        file = toAbsolutePath(file);
        if (!fs.existsSync(file)) {
            throw new Error(getMessage('ConfigFileDoesNotExist', file));
        }
        const fileContents: string = fs.readFileSync(file, 'utf8');

        const fileExt : string = path.extname(file).toLowerCase();

        if (fileExt == '.json') {
            return CodeAnalyzerConfig.fromJsonString(fileContents, path.dirname(file));
        }  else if (fileExt == '.yaml' || fileExt == '.yml') {
            return CodeAnalyzerConfig.fromYamlString(fileContents, path.dirname(file));
        } else {
            throw new Error(getMessage('ConfigFileExtensionUnsupported', file, 'json,yaml,yml'))
        }
    }

    public static fromJsonString(jsonString: string, configFolder?: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => JSON.parse(jsonString));
        return CodeAnalyzerConfig.fromObject(data, configFolder);
    }

    public static fromYamlString(yamlString: string, configFolder?: string): CodeAnalyzerConfig {
        const data: object = parseAndValidate(() => yaml.load(yamlString));
        return CodeAnalyzerConfig.fromObject(data, configFolder);
    }

    public static fromObject(data: object, configFolder?: string): CodeAnalyzerConfig {
        configFolder = extractConfigFolderValue(data, configFolder);
        const config: TopLevelConfig = {
            config_folder: configFolder,
            log_folder: extractLogFolderValue(data, configFolder),
            custom_engine_plugin_modules: extractCustomEnginePluginModules(data),
            rules: extractRulesValue(data),
            engines: extractEnginesValue(data)
        }
        return new CodeAnalyzerConfig(config);
    }

    private constructor(config: TopLevelConfig) {
        this.config = config;
    }

    public getLogFolder(): string {
        return this.config.log_folder;
    }

    public getConfigFolder(): string {
        return this.config.config_folder;
    }

    public getCustomEnginePluginModules(): string[] {
        return this.config.custom_engine_plugin_modules;
    }

    public getRuleOverridesFor(engineName: string): Record<string, RuleOverride> {
        return this.config.rules[engineName] || {};
    }

    public getRuleOverrideFor(engineName: string, ruleName: string): RuleOverride {
        return this.getRuleOverridesFor(engineName)[ruleName] || {};
    }

    public getEngineConfigFor(engineName: string): engApi.ConfigObject {
        // Each engine should have access to the config folder location and its own engine specific config, so that it
        // can resolve any relative paths in its engine specific config with this location. Thus, we always add the
        // config folder to the engine specific config.
        const configToGiveToEngine: engApi.ConfigObject = this.config.engines[engineName] || {};
        configToGiveToEngine.config_folder = this.getConfigFolder();
        return configToGiveToEngine;
    }
}

function extractConfigFolderValue(data: object, configFolder?: string): string {
    if (!(FIELDS.CONFIG_FOLDER in data)) {
        return configFolder || DEFAULT_CONFIG.config_folder;
    }
    configFolder = toAbsolutePath(validateType('string', data[FIELDS.CONFIG_FOLDER], FIELDS.CONFIG_FOLDER));
    if (!fs.existsSync(configFolder)) {
        throw new Error(getMessage('ConfigValueFolderMustExist', FIELDS.CONFIG_FOLDER, configFolder));
    } else if (!fs.statSync(configFolder).isDirectory()) {
        throw new Error(getMessage('ConfigValueMustBeFolder', FIELDS.CONFIG_FOLDER, configFolder));
    } else if (data[FIELDS.CONFIG_FOLDER] !== configFolder) {
        throw new Error(getMessage('ConfigValueMustBeAbsolutePath', FIELDS.CONFIG_FOLDER, configFolder));
    }
    return configFolder;
}

function extractLogFolderValue(data: object, configFolder: string): string {
    if (!(FIELDS.LOG_FOLDER in data)) {
        return DEFAULT_CONFIG.log_folder;
    }
    const rawLogFolder: string = validateType('string', data[FIELDS.LOG_FOLDER], FIELDS.LOG_FOLDER);
    let logFolder: string = toAbsolutePath(rawLogFolder, configFolder); // First assume it is relative to the config folder
    if (!fs.existsSync(logFolder)) {
        logFolder = toAbsolutePath(rawLogFolder); // Otherwise just try to resolve without config folder
        if (!fs.existsSync(logFolder)) {
            throw new Error(getMessage('ConfigValueFolderMustExist', FIELDS.LOG_FOLDER, logFolder));
        }
    }
    if (!fs.statSync(logFolder).isDirectory()) {
        throw new Error(getMessage('ConfigValueMustBeFolder', FIELDS.LOG_FOLDER, logFolder));
    }
    return logFolder;
}

function extractCustomEnginePluginModules(data: object): string[] {
    if (!(FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES in data)) {
        return DEFAULT_CONFIG.custom_engine_plugin_modules;
    }
    return validateStringArray(data[FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES], FIELDS.CUSTOM_ENGINE_PLUGIN_MODULES);
}

function extractRulesValue(data: object): Record<string, Record<string, RuleOverride>> {
    if (!(FIELDS.RULES in data)) {
        return DEFAULT_CONFIG.rules;
    }
    const extractedValue: Record<string, Record<string, RuleOverride>> = {};
    const rulesObj: object = validateObject(data[FIELDS.RULES], FIELDS.RULES);
    for (const engineName of Object.keys(rulesObj)) {
        extractedValue[engineName] = extractRuleOverridesFor(rulesObj, engineName);
    }
    return extractedValue;
}

function extractRuleOverridesFor(rulesObj: object, engineName: string): Record<string, RuleOverride> {
    const extractedValue: Record<string, RuleOverride> = {};
    const ruleOverridesObj: object = validateObject(rulesObj[engineName as keyof typeof rulesObj],
        `${FIELDS.RULES}.${engineName}`);
    for (const ruleName of Object.keys(ruleOverridesObj)) {
        extractedValue[ruleName] = extractRuleOverrideFor(ruleOverridesObj, engineName, ruleName);
    }
    return extractedValue;
}

function extractRuleOverrideFor(ruleOverridesObj: object, engineName: string, ruleName: string): RuleOverride {
    const extractedValue: RuleOverride = {};
    const ruleOverrideObj: object = validateObject(ruleOverridesObj[ruleName as keyof typeof ruleOverridesObj],
        `${FIELDS.RULES}.${engineName}.${ruleName}`);
    if (FIELDS.SEVERITY in ruleOverrideObj) {
        extractedValue.severity = validateSeverityValue(ruleOverrideObj[FIELDS.SEVERITY],
            `${FIELDS.RULES}.${engineName}.${ruleName}.${FIELDS.SEVERITY}`);
    }
    if (FIELDS.TAGS in ruleOverrideObj ) {
        extractedValue.tags = validateStringArray(ruleOverrideObj[FIELDS.TAGS],
            `${FIELDS.RULES}.${engineName}.${ruleName}.${FIELDS.TAGS}`);
    }
    return extractedValue;
}

function validateObject(value: unknown, valueKey: string): object {
    return validateType<object>('object', value, valueKey);
}

function validateType<T>(expectedType: string, value: unknown, valueKey: string): T {
    if (typeOf(value) !== expectedType) {
        throw new Error(getMessage('ConfigValueMustBeOfType', valueKey, expectedType, typeOf(value)));
    }
    return value as T;
}

function validateSeverityValue(value: unknown, valueKey: string): SeverityLevel {
    // Note that Object.values(SeverityLevel) returns [1,2,3,4,5,"Critical","High","Moderate","Low","Info"]
    if ((typeof value !== 'string' && typeof value !== 'number')
        || !Object.values(SeverityLevel).includes(value as string | number)) {
        throw new Error(getMessage('ConfigValueNotAValidSeverityLevel', valueKey,
            JSON.stringify(Object.values(SeverityLevel)), JSON.stringify(value)));
    }
    if (typeof value === 'string') {
        // We can't type cast to enum from a string, so instead we choose the enum based on the string as a key.
        value = SeverityLevel[value as keyof typeof SeverityLevel];
    }
    // We can type cast to enum safely from a number
    return value as SeverityLevel;
}

function validateStringArray(value: unknown, valueKey: string): string[] {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        throw new Error(getMessage('ConfigValueNotAValidStringArray', valueKey, JSON.stringify(value)));
    }
    return value as string[];
}

function extractEnginesValue(data: object): Record<string, engApi.ConfigObject> {
    if (!(FIELDS.ENGINES in data)) {
        return DEFAULT_CONFIG.engines;
    }
    const engineSettingsObj: object = validateObject(data[FIELDS.ENGINES], FIELDS.ENGINES);
    for (const [engineName, settingsForEngine] of Object.entries(engineSettingsObj)) {
        validateObject(settingsForEngine, `${FIELDS.ENGINES}.${engineName}`);
    }
    return engineSettingsObj as Record<string, engApi.ConfigObject>;
}

function parseAndValidate(parseFcn: () => unknown): object {
    let data;
    try {
        data = parseFcn();
    } catch (err) {
        throw new Error(getMessage('ConfigContentFailedToParse', (err as Error).message), { cause: err });
    }
    if (typeOf(data) !== 'object') {
        throw new Error(getMessage('ConfigContentNotAnObject', typeOf(data)));
    }
    return data as object;
}

function typeOf(value: unknown) {
    return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}