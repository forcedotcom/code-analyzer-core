import {
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {indent, JavaCommandExecutor} from '@salesforce/code-analyzer-engine-api/utils';
import {toExtensionsToLanguageMap, WorkspaceLiaison} from "./utils";
import path from "node:path";
import * as fs from 'node:fs/promises';
import {Language, PMD_ENGINE_NAME, SFCA_RULESETS_TO_MAKE_AVAILABLE, SHARED_RULE_NAMES} from "./constants";
import {
    LanguageSpecificPmdRunData,
    PmdResults,
    PmdRuleInfo,
    PmdViolation,
    PmdWrapperInvoker
} from "./pmd-wrapper";
import {getMessage} from "./messages";
import {PmdEngineConfig} from "./config";
import {RULE_MAPPINGS} from "./pmd-rule-mappings";

export class PmdEngine extends Engine {
    private readonly pmdWrapperInvoker: PmdWrapperInvoker;
    private readonly config: PmdEngineConfig;
    private readonly extensionToLanguageMap: Map<string, Language>;

    private workspaceLiaisonCache: Map<string, WorkspaceLiaison> = new Map();
    private pmdRuleInfoListCache: Map<string, PmdRuleInfo[]> = new Map();

    constructor(config: PmdEngineConfig) {
        super();
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(config.java_command, this.emitLogEvent.bind(this));
        const userProvidedJavaClasspathEntries: string[] = config.java_classpath_entries;
        this.pmdWrapperInvoker = new PmdWrapperInvoker(javaCommandExecutor, userProvidedJavaClasspathEntries, this.emitLogEvent.bind(this));
        this.config = config;
        this.extensionToLanguageMap = toExtensionsToLanguageMap(config.file_extensions);
    }

    getName(): string {
        return PMD_ENGINE_NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(describeOptions.workspace);
        this.emitDescribeRulesProgressEvent(5);

        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison,
            (innerPerc: number) => this.emitDescribeRulesProgressEvent(5 + 90*(innerPerc/100))); // 5 to 95%

        const ruleDescriptions: RuleDescription[] = ruleInfoList.map(toRuleDescription);
        ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(runOptions.workspace);
        const relevantLanguageToFilesMap: Map<Language, string[]> = await workspaceLiaison.getRelevantLanguageToFilesMap();
        this.emitRunRulesProgressEvent(2);

        const ruleInfoList: PmdRuleInfo[] = await this.getPmdRuleInfoList(workspaceLiaison,
            (innerPerc: number) => this.emitRunRulesProgressEvent(2 + 3*(innerPerc/100))); // 2 to 5%

        const selectedRuleInfoList: PmdRuleInfo[] = ruleNames
            .map(ruleName => fetchRuleInfoByRuleName(ruleInfoList, ruleName))
            .filter(ruleInfo => ruleInfo !== null);

        const runDataPerLanguage: Record<string, LanguageSpecificPmdRunData> = {};
        const relevantLanguageIds: Set<string> = new Set(selectedRuleInfoList.map(ruleInfo => ruleInfo.languageId));
        for (const languageId of relevantLanguageIds) {
            const filesToScanForLanguage: string[] = relevantLanguageToFilesMap.get(toLanguageEnum(languageId)) || /* istanbul ignore next */ [];
            if (filesToScanForLanguage.length > 0) {
                runDataPerLanguage[languageId] = {
                    filesToScan: filesToScanForLanguage
                }
            }
        }

        if (Object.keys(runDataPerLanguage).length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }


        const pmdResults: PmdResults = await this.pmdWrapperInvoker.invokeRunCommand(selectedRuleInfoList, runDataPerLanguage,
            (innerPerc: number) => this.emitRunRulesProgressEvent(5 + 93*(innerPerc/100))); // 5 to 98%

        const violations: Violation[] = [];
        for (const pmdViolation of pmdResults.violations) {
            violations.push(this.toViolation(pmdViolation));
        }
        for (const pmdProcessingError of pmdResults.processingErrors) {
            this.emitLogEvent(LogLevel.Error, getMessage('ProcessingErrorForFile', 'PMD', pmdProcessingError.file,
                indent(pmdProcessingError.message)));
        }

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations
        };
    }

    private async getPmdRuleInfoList(workspaceLiaison: WorkspaceLiaison, emitProgress: (percComplete: number) => void): Promise<PmdRuleInfo[]> {
        const cacheKey: string = getCacheKey(workspaceLiaison.getWorkspace());
        if (!this.pmdRuleInfoListCache.has(cacheKey)) {
            const relevantLanguages: Language[] = await workspaceLiaison.getRelevantLanguages();
            const pmdRuleLanguageIds: string[] = relevantLanguages.map(toPmdLanguageId);
            const allCustomRulesets: string[] = [
                ... SFCA_RULESETS_TO_MAKE_AVAILABLE, // Our custom rulesets
                ... this.config.custom_rulesets // The user's custom rulesets
            ]
            const ruleInfoList: PmdRuleInfo[] = relevantLanguages.length === 0 ? [] :
                await this.pmdWrapperInvoker.invokeDescribeCommand(allCustomRulesets, pmdRuleLanguageIds, emitProgress);
            this.pmdRuleInfoListCache.set(cacheKey, ruleInfoList);
        }
        return this.pmdRuleInfoListCache.get(cacheKey)!;
    }

    private getWorkspaceLiaison(workspace?: Workspace) : WorkspaceLiaison {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.workspaceLiaisonCache.has(cacheKey)) {
            this.workspaceLiaisonCache.set(cacheKey,
                new WorkspaceLiaison(workspace, this.config.rule_languages, this.extensionToLanguageMap));
        }
        return this.workspaceLiaisonCache.get(cacheKey)!
    }

    private toViolation(pmdViolation: PmdViolation): Violation {
        const fileExt: string = path.extname(pmdViolation.codeLocation.file).toLowerCase();
        const language: Language = this.extensionToLanguageMap.get(fileExt)!;
        return {
            ruleName: toUniqueRuleName(pmdViolation.rule, language),
            message: pmdViolation.message,
            codeLocations: [{
                file: pmdViolation.codeLocation.file,
                startLine: pmdViolation.codeLocation.startLine,
                startColumn: pmdViolation.codeLocation.startCol,
                endLine: pmdViolation.codeLocation.endLine,
                endColumn: pmdViolation.codeLocation.endCol
            }],
            primaryLocationIndex: 0
        }
    }
}

function toRuleDescription(pmdRuleInfo: PmdRuleInfo): RuleDescription {
    const language: Language = toLanguageEnum(pmdRuleInfo.languageId);
    const uniqueRuleName: string = toUniqueRuleName(pmdRuleInfo.name, language);

    let severityLevel: SeverityLevel;
    let tags: string[];

    const customRulesetNameTags: string[] = pmdRuleInfo.ruleSets.map(rs => rs.replaceAll(' ', '')).filter(
        tag => !Object.values(COMMON_TAGS.CATEGORIES).includes(tag) && !tag.startsWith("AppExchange_"));

    if (uniqueRuleName in RULE_MAPPINGS) {
        severityLevel = RULE_MAPPINGS[uniqueRuleName].severity;
        // For the tags, we start with the overridden tags from the RULE_MAPPINGS and add in the customRulesetNameTags
        // since we want to allow users to reference the existing standard rules in their custom ruleset
        // files and still get the benefit of us adding in a tag for the name of their custom ruleset.
        tags = [...RULE_MAPPINGS[uniqueRuleName].tags, ...customRulesetNameTags];
    } else { // Any rule we don't know about from our RULE_MAPPINGS must be a custom rule. Unit tests prevent otherwise.
        severityLevel = toSeverityLevel(pmdRuleInfo.priority);
        const languageTag: string = language.charAt(0).toUpperCase() + language.slice(1);
        tags = [COMMON_TAGS.RECOMMENDED, ...customRulesetNameTags, languageTag, COMMON_TAGS.CUSTOM];
    }

    return {
        name: uniqueRuleName,
        severityLevel: severityLevel,
        tags: tags,
        description: pmdRuleInfo.description,
        resourceUrls: pmdRuleInfo.externalInfoUrl ? [pmdRuleInfo.externalInfoUrl] : [] // TODO: Eventually we'll want to add in well architected links
    };
}

function toUniqueRuleName(ruleName: string, ruleLanguage: Language): string {
    if (ruleName in SHARED_RULE_NAMES && ruleLanguage !== Language.APEX) {
        return `${ruleName}-${ruleLanguage}`;
    }
    return ruleName;
}

/* istanbul ignore next */
function toSeverityLevel(pmdRulePriority: string): SeverityLevel {
    if (pmdRulePriority === "High") {
        return SeverityLevel.High;
    } else if (pmdRulePriority === "Medium") {
        return SeverityLevel.Moderate;
    } else if (pmdRulePriority === "Low") {
        return SeverityLevel.Low;

    // The following don't seem to show up in the standard rules, but are documented as options available to users
    } else if (pmdRulePriority === "Medium High") {
        return SeverityLevel.Moderate;
    } else if (pmdRulePriority === "Medium Low") {
        return SeverityLevel.Low;
    }

    throw new Error("Unsupported priority: " + pmdRulePriority);
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}

function fetchRuleInfoByRuleName(ruleInfoList: PmdRuleInfo[], uniqueRuleName: string) : PmdRuleInfo|null {
    // Note that some pmd rule names that were shared among languages were converted to contain a "-<language>" suffix.
    // So we need to map these names (like "WhileLoopsMustUseBraces-javascript") back into "WhileLoopsMustUseBraces" for the "javascript" language.
    const langSeparator: number = uniqueRuleName.indexOf('-');
    let pmdRuleLanguage: Language | undefined = undefined;
    let pmdRuleName: string = uniqueRuleName;
    if (langSeparator > 0) {
        pmdRuleName = uniqueRuleName.substring(0, langSeparator);
        pmdRuleLanguage = uniqueRuleName.substring(langSeparator + 1) as Language;
    } else if (pmdRuleName in SHARED_RULE_NAMES) {
        // It is also important that if a shared name is given like "WhileLoopsMustUseBraces" that we explicitly look
        // for its default language (the first in the array) so we don't pick up the rules for the other shared languages
        // by mistake. That is, if "WhileLoopsMustUseBraces" is for java but "WhileLoopsMustUseBraces-javascript" is for
        // javascript, so we don't want to select the javascript rule here.
        pmdRuleLanguage = SHARED_RULE_NAMES[pmdRuleName][0];
    }

    return ruleInfoList.find(ruleInfo =>
        ruleInfo.name === pmdRuleName && (pmdRuleLanguage === undefined || toLanguageEnum(ruleInfo.languageId) === pmdRuleLanguage)
    ) || null;
}

function toPmdLanguageId(language: Language): string {
    // We must convert 'javascript' to 'ecmascript' since PMD actually uses 'ecmascript' as the identifier instead of 'javascript'
    return language == Language.JAVASCRIPT ? 'ecmascript' : language;
}

function toLanguageEnum(pmdRuleLanguage: string): Language {
    // We must convert 'ecmascript' back to 'javascript'
    return pmdRuleLanguage == 'ecmascript' ? Language.JAVASCRIPT : pmdRuleLanguage as Language;
}