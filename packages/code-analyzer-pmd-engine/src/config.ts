import {ConfigDescription, ConfigValueExtractor, ValueValidator} from "@salesforce/code-analyzer-engine-api";
import {indent} from "@salesforce/code-analyzer-engine-api/utils";
import {getMessage} from "./messages";
import {JavaVersionIdentifier} from "./JavaVersionIdentifier";
import {SemVer} from "semver";
import path from "node:path";
import {MINIMUM_JAVA_VERSION, Language, CPD_ENGINE_NAME, PMD_ENGINE_NAME, DEFAULT_FILE_EXTENSIONS} from "./constants";
import fs from "node:fs";

export const PMD_AVAILABLE_LANGUAGES: Language[] = Object.values(Language).filter(l => l !== Language.TYPESCRIPT); // Typescript is available in CPD but not PMD
export const CPD_AVAILABLE_LANGUAGES: Language[] = Object.values(Language);

const DEFAULT_JAVA_COMMAND: string = 'java';

const FILE_EXT_PATTERN: RegExp = /^[.][a-zA-Z0-9]+$/;

export type PmdEngineConfig = {
    // Indicates the specific "java" command to use for the 'pmd' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string

    // !! NOTE !! - HIDDEN UNTIL A USER REQUESTS THIS - ALL LANGUAGES ARE ENABLED BY DEFAULT SO THERE MAY NOT BE A USE CASE FOR THIS YET
    // List of languages associated with the PMD rules to be made available for 'pmd' engine rule selection.
    // The languages that you may choose from are: 'apex', 'html', 'javascript' (or 'ecmascript'), 'visualforce', 'xml'
    // See https://pmd.github.io/pmd/tag_rule_references.html to learn about the PMD rules available for each language.
    rule_languages: Language[]

    // Specifies the list of file extensions to associate to each rule language.
    // The rule(s) associated with a given language will run against all the files in your workspace containing one of
    // the specified file extensions. Each file extension can only be associated to one language. If a specific language
    // is not specified, then a set of default file extensions for that language will be used.
    file_extensions: Record<Language, string[]>

    // List of jar files and/or folders to add the Java classpath when running PMD.
    // Each entry may be given as an absolute path or a relative path to 'config_root'.
    // This field is primarily used to supply custom Java based rule definitions to PMD.
    // See https://pmd.github.io/pmd/pmd_userdocs_extending_writing_java_rules.html
    java_classpath_entries: string[]

    // List of xml ruleset files containing custom PMD rules to be made available for rule selection.
    // Each ruleset must be an xml file that is either::
    //   - on disk (provided as an absolute path or a relative path to 'config_root')
    //   - or a relative resource found on the Java classpath.
    // Not all custom rules can be fully defined within an xml ruleset file. For example, Java based rules may be defined in jar files.
    // In these cases, you will need to also add your additional files to the Java classpath using the 'java_classpath_entries' field.
    // See https://pmd.github.io/pmd/pmd_userdocs_making_rulesets.html
    custom_rulesets: string []
}

export const DEFAULT_PMD_ENGINE_CONFIG: PmdEngineConfig = {
    java_command: DEFAULT_JAVA_COMMAND,
    rule_languages: PMD_AVAILABLE_LANGUAGES, // hidden
    file_extensions: DEFAULT_FILE_EXTENSIONS,
    java_classpath_entries: [],
    custom_rulesets: []
}

export const PMD_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('PmdConfigOverview'),
    fieldDescriptions: {
        java_command: {
            descriptionText: getMessage('SharedConfigFieldDescription_java_command', PMD_ENGINE_NAME),
            valueType: "string",
            defaultValue: null // Using null for doc and since it indicates that the value is calculated based on the environment
        },

        // rule_languages - is excluded here so that it can remain hidden
        // rule_languages WILL REMAIN HIDDEN UNTIL A USER REQUESTS THIS - ALL LANGUAGES ARE ENABLED BY DEFAULT SO THERE MAY NOT BE A USE CASE FOR THIS YET

        file_extensions: {
            descriptionText: getMessage('SharedConfigFieldDescription_file_extensions'),
            valueType: "object",
            defaultValue: DEFAULT_PMD_ENGINE_CONFIG.file_extensions,
        },

        java_classpath_entries: {
            descriptionText: getMessage('PmdConfigFieldDescription_java_classpath_entries'),
            valueType: "array",
            defaultValue: DEFAULT_PMD_ENGINE_CONFIG.java_classpath_entries
        },
        custom_rulesets: {
            descriptionText: getMessage('PmdConfigFieldDescription_custom_rulesets'),
            valueType: "array",
            defaultValue: DEFAULT_PMD_ENGINE_CONFIG.custom_rulesets
        }
    }
}


export type CpdEngineConfig = {
    // Indicates the specific "java" command to use for the 'cpd' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string

    // !! NOTE !! - HIDDEN UNTIL A USER REQUESTS THIS - ALL LANGUAGES ARE ENABLED BY DEFAULT SO THERE MAY NOT BE A USE CASE FOR THIS YET
    // List of languages associated with CPD to be made available for 'cpd' engine rule selection.
    // The languages that you may choose from are: 'apex', 'html', 'javascript' (or 'ecmascript'), 'typescript', 'visualforce', 'xml'
    rule_languages: Language[]

    // Specifies the list of file extensions to associate to each rule language.
    // The rule(s) associated with a given language will run against all the files in your workspace containing one of
    // the specified file extensions. Each file extension can only be associated to one language. If a specific language
    // is not specified, then a set of default file extensions for that language will be used.
    file_extensions: Record<Language, string[]>

    // Specifies the minimum tokens threshold for each rule language.
    // The minimum tokens threshold is the number of tokens required to be in a duplicate block of code in order to be
    // reported as a violation. The concept of a token may be defined differently per language, but in general it is a
    // distinct basic element of source code. For example, this could be language specific keywords, identifiers,
    // operators, literals, and more. See https://docs.pmd-code.org/latest/pmd_userdocs_cpd.html to learn more.
    // If a value for a language is unspecified, then the default value of 100 will be used for that language.
    minimum_tokens: Record<Language, number>

    // Indicates whether to ignore multiple copies of files of the same name and length.
    skip_duplicate_files: boolean
}

const DEFAULT_MINIMUM_TOKENS: number = 100;

export const DEFAULT_CPD_ENGINE_CONFIG: CpdEngineConfig = {
    java_command: DEFAULT_JAVA_COMMAND,
    rule_languages: CPD_AVAILABLE_LANGUAGES, // hidden
    file_extensions: DEFAULT_FILE_EXTENSIONS,
    minimum_tokens: CPD_AVAILABLE_LANGUAGES.reduce((obj, lang: Language) => {
        obj[lang] = DEFAULT_MINIMUM_TOKENS;
        return obj;
    }, {} as Record<Language, number>),
    skip_duplicate_files: false
}

export const CPD_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('CpdConfigOverview'),
    fieldDescriptions: {
        java_command: {
            descriptionText: getMessage('SharedConfigFieldDescription_java_command', CPD_ENGINE_NAME),
            valueType: "string",
            defaultValue: null // Using null for doc and since it indicates that the value is calculated based on the environment
        },

        // rule_languages - is excluded here so that it can remain hidden
        // rule_languages WILL REMAIN HIDDEN UNTIL A USER REQUESTS THIS - ALL LANGUAGES ARE ENABLED BY DEFAULT SO THERE MAY NOT BE A USE CASE FOR THIS YET

        file_extensions: {
            descriptionText: getMessage('SharedConfigFieldDescription_file_extensions'),
            valueType: "object",
            defaultValue: DEFAULT_CPD_ENGINE_CONFIG.file_extensions,
        },

        minimum_tokens: {
            descriptionText: getMessage('CpdConfigFieldDescription_minimum_tokens'),
            valueType: "object",
            defaultValue: DEFAULT_CPD_ENGINE_CONFIG.minimum_tokens,
        },
        skip_duplicate_files: {
            descriptionText: getMessage('CpdConfigFieldDescription_skip_duplicate_files'),
            valueType: "boolean",
            defaultValue: DEFAULT_CPD_ENGINE_CONFIG.skip_duplicate_files,
        }
    }
}


export async function validateAndNormalizePmdConfig(configValueExtractor: ConfigValueExtractor,
                                                    javaVersionIdentifier: JavaVersionIdentifier): Promise<PmdEngineConfig> {
    configValueExtractor.addKeysThatBypassValidation(['rule_languages']); // because rule_languages is currently hidden
    configValueExtractor.validateContainsOnlySpecifiedKeys(['file_extensions', 'java_command', 'java_classpath_entries', 'custom_rulesets']);

    const pmdConfigValueExtractor: PmdConfigValueExtractor = new PmdConfigValueExtractor(configValueExtractor,
        javaVersionIdentifier);

    const javaClasspathEntries: string[] = pmdConfigValueExtractor.extractJavaClasspathEntries();
    return {
        java_command: await pmdConfigValueExtractor.extractJavaCommand(),
        rule_languages: pmdConfigValueExtractor.extractRuleLanguages(),
        file_extensions: pmdConfigValueExtractor.extractFileExtensions(),
        java_classpath_entries: pmdConfigValueExtractor.extractJavaClasspathEntries(),
        custom_rulesets: pmdConfigValueExtractor.extractCustomRulesets(javaClasspathEntries)
    }
}

export async function validateAndNormalizeCpdConfig(configValueExtractor: ConfigValueExtractor,
                                                    javaVersionIdentifier: JavaVersionIdentifier): Promise<CpdEngineConfig> {
    configValueExtractor.addKeysThatBypassValidation(['rule_languages']); // because rule_languages is currently hidden
    configValueExtractor.validateContainsOnlySpecifiedKeys(['file_extensions', 'java_command', 'minimum_tokens', 'skip_duplicate_files']);

    const cpdConfigValueExtractor: CpdConfigValueExtractor = new CpdConfigValueExtractor(configValueExtractor,
        javaVersionIdentifier);

    return {
        java_command: await cpdConfigValueExtractor.extractJavaCommand(),
        rule_languages: cpdConfigValueExtractor.extractRuleLanguages(),
        file_extensions: cpdConfigValueExtractor.extractFileExtensions(),
        minimum_tokens: cpdConfigValueExtractor.extractMinimumTokens(),
        skip_duplicate_files: cpdConfigValueExtractor.extractSkipDuplicateFiles()
    }
}

// Abstract class to extraction code for shared fields for PMD and CPD engines, like 'java_command' and 'rule_languages'.
abstract class SharedConfigValueExtractor {
    protected readonly configValueExtractor: ConfigValueExtractor;
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    protected constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        this.configValueExtractor = configValueExtractor;
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    // The list of all possible languages that can be chosen within the rule_languages array
    protected abstract getAllPossibleRuleLanguages(): Language[];

    // The default return value for rule_languages
    protected abstract getDefaultRuleLanguages(): Language[];

    async extractJavaCommand(): Promise<string> {
        const javaCommand: string | undefined = this.configValueExtractor.extractString('java_command');
        if (!javaCommand) {
            return await this.attemptToAutoDetectJavaCommand();
        }

        try {
            await this.validateJavaCommandContainsValidVersion(javaCommand);
        } catch (err) {
            throw new Error(getMessage('InvalidUserSpecifiedJavaCommand',
                this.configValueExtractor.getFieldPath('java_command'), (err as Error).message));
        }
        return javaCommand;
    }

    private async attemptToAutoDetectJavaCommand(): Promise<string> {
        const commandsToAttempt: string[] = [
            // Environment variables specifying JAVA HOME take precedence (if they exist)
            ...['JAVA_HOME', 'JRE_HOME', 'JDK_HOME'].filter(v => process.env[v]) // only keep vars that have a non-empty defined value
                .map(v => path.join(process.env[v]!, 'bin', 'java')),

            // Attempt to just use the default java command that might be already on the path as a last attempt
            DEFAULT_JAVA_COMMAND
        ];

        const errorMessages: string[] = [];
        for (const possibleJavaCommand of commandsToAttempt) {
            try {
                // Yes we want to have an await statement in a loop in this case since we want to try one at a time
                await this.validateJavaCommandContainsValidVersion(possibleJavaCommand);
                return possibleJavaCommand;
            } catch (err) {
                errorMessages.push((err as Error).message);
            }
        }
        const consolidatedErrorMessages: string = errorMessages.map((msg: string, idx: number) =>
            indent(`Attempt ${idx + 1}:\n${indent(msg)}`, '  | ')).join('\n');
        throw new Error(getMessage('CouldNotLocateJava',
            MINIMUM_JAVA_VERSION,
            consolidatedErrorMessages,
            this.configValueExtractor.getFieldPath('java_command'),
            this.configValueExtractor.getFieldPath('disable_engine')));
    }

    private async validateJavaCommandContainsValidVersion(javaCommand: string): Promise<void> {
        let version: SemVer | null;
        try {
            version = await this.javaVersionIdentifier.identifyJavaVersion(javaCommand);
        } catch (err) {
            /* istanbul ignore next */
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('JavaVersionCheckProducedError', javaCommand, indent(errMsg, '  | ')));
        }
        if (!version) {
            throw new Error(getMessage('UnrecognizableJavaVersion', javaCommand));
        } else if (version.compare(MINIMUM_JAVA_VERSION) < 0) {
            throw new Error(getMessage('JavaBelowMinimumVersion', javaCommand, version.toString(), MINIMUM_JAVA_VERSION));
        }
    }

    extractRuleLanguages(): Language[] {
        let ruleLanguages: string[] | undefined = this.configValueExtractor.extractArray('rule_languages',
            ValueValidator.validateString);
        if (ruleLanguages === undefined) {
            return this.getDefaultRuleLanguages();
        }

        // Make unique and convert to lowercase
        const ruleLanguagesSet: Set<string> = new Set(ruleLanguages.map(l => l.toLowerCase()));

        // Provide support for 'ecmascript' which is a supported alias of 'javascript'
        if (ruleLanguagesSet.has('ecmascript')) {
            ruleLanguagesSet.delete('ecmascript');
            ruleLanguagesSet.add('javascript');
        }

        // Validate each language is supported
        ruleLanguages = [...ruleLanguagesSet];
        for (const ruleLanguage of ruleLanguages) {
            if (!(this.getAllPossibleRuleLanguages() as string[]).includes(ruleLanguage)) {
                throw new Error(getMessage('InvalidRuleLanguage',
                    this.configValueExtractor.getFieldPath('rule_languages'),
                    ruleLanguage,
                    toAvailableLanguagesText(this.getAllPossibleRuleLanguages())));
            }
        }
        return ruleLanguages.sort() as Language[];
    }

    extractFileExtensions(): Record<Language, string[]> {
        const fileExtensionsExtractor: ConfigValueExtractor = this.configValueExtractor.extractObjectAsExtractor(
            'file_extensions', DEFAULT_FILE_EXTENSIONS);
        fileExtensionsExtractor.validateContainsOnlySpecifiedKeys(Object.keys(DEFAULT_FILE_EXTENSIONS));

        const extToLangMap: Map<string, Language> = new Map(); // To keep track if file extension shows up with more than one language
        const fileExtensionsMap: Record<Language, string[]> = {... DEFAULT_FILE_EXTENSIONS}; // Start with copy
        for (const language of Object.keys(fileExtensionsMap) as Language[]) {
            const fileExts: string[] = makeUniqueCaseInsensitive(fileExtensionsExtractor.extractArray(language,
                (element, elementFieldPath) => ValueValidator.validateString(element,
                    elementFieldPath, FILE_EXT_PATTERN),
                DEFAULT_FILE_EXTENSIONS[language]
            )!);

            // Validate that none of the file extensions already exist in another language
            for (const fileExt of fileExts.map(fileExt => fileExt.toLowerCase())) {
                if (extToLangMap.has(fileExt) && extToLangMap.get(fileExt) !== language) {
                    throw new Error(getMessage('InvalidFileExtensionDueToItBeingListedTwice',
                        fileExtensionsExtractor.getFieldPath(), fileExt,
                        JSON.stringify([extToLangMap.get(fileExt), language])));
                }
                extToLangMap.set(fileExt, language);
            }

            fileExtensionsMap[language] = fileExts;
        }
        return fileExtensionsMap;
    }
}

class PmdConfigValueExtractor extends SharedConfigValueExtractor {
    constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        super(configValueExtractor, javaVersionIdentifier);
    }

    extractJavaClasspathEntries(): string[] {
        const entries: string[] = this.configValueExtractor.extractArray('java_classpath_entries',
            (entry: unknown, entryField: string) => ValueValidator.validatePath(entry, entryField,
                [this.configValueExtractor.getConfigRoot()]),
            DEFAULT_PMD_ENGINE_CONFIG.java_classpath_entries)!;
        for (let i= 0; i < entries.length; i++) {
            if (path.extname(entries[i]).toLowerCase() !== '.jar' && !fs.statSync(entries[i]).isDirectory()) {
                throw new Error(getMessage('InvalidJavaClasspathEntry',
                    this.configValueExtractor.getFieldPath('java_classpath_entries') + `[${i}]`));
            }
        }
        return [... new Set(entries)]; // Converting to set and back to array to remove duplicates
    }

    extractCustomRulesets(javaClassPathEntries: string[]): string[] {
        const customRulesets: string[] =  this.configValueExtractor.extractArray('custom_rulesets',
            ValueValidator.validateString, DEFAULT_PMD_ENGINE_CONFIG.custom_rulesets)!;

        const possibleParentFolders: string [] = [
            this.configValueExtractor.getConfigRoot(),
            ... javaClassPathEntries.filter(entry => !entry.toLowerCase().endsWith('.jar')) // folder based entries
        ]

        for (let i=0; i < customRulesets.length; i++) {
            try {
                // Using the validatePath method to simply help resolve relative paths on disk to absolute paths on disk
                customRulesets[i] = ValueValidator.validatePath(customRulesets[i],
                    this.configValueExtractor.getFieldPath('custom_rulesets') + `[${i}]`,
                    [this.configValueExtractor.getConfigRoot(),...possibleParentFolders]);
            } catch (_err) {
                // If the ruleset isn't found on disk, then at this point we could ideally attempt to validate that it
                // exists in one of the jar files, but that would be expensive. Instead, we will rely on our pmd-wrapper
                // (which is called when describing rules) to finish validation when we add in the ruleset on the Java
                // side - at which point our try/catch statement will provide a nice error message.
            }
        }
        return [... new Set(customRulesets)]; // Converting to set and back to array to remove duplicates
    }

    protected getAllPossibleRuleLanguages(): Language[] {
        return PMD_AVAILABLE_LANGUAGES;
    }

    protected getDefaultRuleLanguages(): Language[] {
        return DEFAULT_PMD_ENGINE_CONFIG.rule_languages;
    }
}

class CpdConfigValueExtractor extends SharedConfigValueExtractor {
    constructor(configValueExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        super(configValueExtractor, javaVersionIdentifier);
    }

    protected getAllPossibleRuleLanguages(): Language[] {
        return CPD_AVAILABLE_LANGUAGES;
    }

    protected getDefaultRuleLanguages(): Language[] {
        return DEFAULT_CPD_ENGINE_CONFIG.rule_languages;
    }

    extractMinimumTokens(): Record<Language, number> {
        const minimumTokensExtractor: ConfigValueExtractor = this.configValueExtractor.extractObjectAsExtractor(
            'minimum_tokens', DEFAULT_CPD_ENGINE_CONFIG.minimum_tokens);

        minimumTokensExtractor.validateContainsOnlySpecifiedKeys(CPD_AVAILABLE_LANGUAGES);

        const minimumTokensMap: Record<Language, number> = {... DEFAULT_CPD_ENGINE_CONFIG.minimum_tokens}; // Start with copy
        for (const language of CPD_AVAILABLE_LANGUAGES) {
            const minimumTokensValue: number = minimumTokensExtractor.extractNumber(language, DEFAULT_CPD_ENGINE_CONFIG.minimum_tokens[language])!;
            if (minimumTokensValue <= 0 || Math.floor(minimumTokensValue) != minimumTokensValue) {
                throw new Error(getMessage('InvalidPositiveInteger', minimumTokensExtractor.getFieldPath(language)));
            }
            minimumTokensMap[language] = minimumTokensValue;
        }
        return minimumTokensMap;
    }

    extractSkipDuplicateFiles(): boolean {
        return this.configValueExtractor.extractBoolean('skip_duplicate_files', DEFAULT_CPD_ENGINE_CONFIG.skip_duplicate_files)!;
    }
}

function toAvailableLanguagesText(languages: string[]): string {
    return languages.map(lang => `'${lang}'`)
        .join(', ').replace(`'javascript'`, `'javascript' (or 'ecmascript')`);
}

export function makeUniqueCaseInsensitive(arr: string[]): string[] {
    const seen = new Set<string>();
    return arr.filter((str) => {
        const lowerStr = str.toLowerCase();
        if (seen.has(lowerStr)) {
            return false;
        }
        seen.add(lowerStr);
        return true;
    });
}