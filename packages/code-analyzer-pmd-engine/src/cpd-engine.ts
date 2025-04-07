import {
    CodeLocation,
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
import {CPD_ENGINE_NAME, Language} from "./constants";
import {getMessage} from "./messages";
import {toExtensionsToLanguageMap, WorkspaceLiaison} from "./utils";
import {CPD_AVAILABLE_LANGUAGES, CpdEngineConfig} from "./config";
import {
    CpdBlockLocation,
    CpdLanguageRunResults,
    CpdMatch,
    CpdRunInputData,
    CpdRunResults,
    CpdWrapperInvoker
} from "./cpd-wrapper";
import path from "node:path";
import fs from "node:fs/promises";

const RULE_NAME_PREFIX: string = 'DetectCopyPasteFor';

export class CpdEngine extends Engine {
    private readonly cpdWrapperInvoker: CpdWrapperInvoker;
    private readonly config: CpdEngineConfig;
    private readonly extensionToLanguageMap: Map<string, Language>;

    private workspaceLiaisonCache: Map<string, WorkspaceLiaison> = new Map();

    constructor(config: CpdEngineConfig) {
        super();
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor(config.java_command, this.emitLogEvent.bind(this));
        this.cpdWrapperInvoker = new CpdWrapperInvoker(javaCommandExecutor, this.emitLogEvent.bind(this));
        this.config = config;
        this.extensionToLanguageMap = toExtensionsToLanguageMap(config.file_extensions);
    }

    getName(): string {
        return CPD_ENGINE_NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(describeOptions.workspace);
        this.emitDescribeRulesProgressEvent(33);
        const relevantLanguages: Language[] = await workspaceLiaison.getRelevantLanguages();
        const ruleDescriptions: RuleDescription[] = relevantLanguages.map(createRuleForLanguage);
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const workspaceLiaison: WorkspaceLiaison = this.getWorkspaceLiaison(runOptions.workspace);
        const relevantLanguageToFilesMap: Map<Language, string[]> = await workspaceLiaison.getRelevantLanguageToFilesMap();
        this.emitRunRulesProgressEvent(2);

        const inputData: CpdRunInputData = {
            runDataPerLanguage: {},
            skipDuplicateFiles: this.config.skip_duplicate_files
        }

        const relevantLanguages: Set<Language> = new Set(ruleNames.map(getLanguageFromRuleName));
        for (const language of relevantLanguages) {
            const filesToScanForLanguage: string[] = relevantLanguageToFilesMap.get(language) || [];
            if (filesToScanForLanguage.length > 0) {
                inputData.runDataPerLanguage[toCpdLanguageId(language)] = {
                    filesToScan: filesToScanForLanguage,
                    minimumTokens: this.config.minimum_tokens[language]
                }
            }
        }

        if (Object.keys(inputData.runDataPerLanguage).length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        this.emitRunRulesProgressEvent(5);

        const cpdRunResults: CpdRunResults = await this.cpdWrapperInvoker.invokeRunCommand(inputData,
            (innerPerc: number) => this.emitRunRulesProgressEvent(5 + 93*(innerPerc/100))); // 5 to 98%

        const violations: Violation[] = [];
        for (const cpdLanguageId in cpdRunResults) {
            const language: Language = toLanguageEnum(cpdLanguageId);
            const cpdLanguageRunResults: CpdLanguageRunResults = cpdRunResults[cpdLanguageId];
            for (const cpdMatch of cpdLanguageRunResults.matches) {
                violations.push(toViolation(language, cpdMatch));
            }
            for (const cpdProcessingError of cpdLanguageRunResults.processingErrors) {
                /* istanbul ignore next */
                if (cpdProcessingError.detail == '[TERMINATING_EXCEPTION]') {
                    this.emitLogEvent(LogLevel.Error, getMessage('CpdTerminatingExceptionThrown', language,
                        indent(cpdProcessingError.message)));
                } else {
                    this.emitLogEvent(LogLevel.Error, getMessage('ProcessingErrorForFile', 'CPD', cpdProcessingError.file,
                        indent(cpdProcessingError.message)));
                }
            }
        }

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations
        };
    }

    private getWorkspaceLiaison(workspace?: Workspace) : WorkspaceLiaison {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.workspaceLiaisonCache.has(cacheKey)) {
            this.workspaceLiaisonCache.set(cacheKey,
                new WorkspaceLiaison(workspace, this.config.rule_languages as Language[], this.extensionToLanguageMap));
        }
        return this.workspaceLiaisonCache.get(cacheKey)!
    }
}

function createRuleForLanguage(language: Language): RuleDescription {
    const languageTag: string = language.charAt(0).toUpperCase() + language.slice(1);

    // We agreed that html and xml can be noisy and are less important for users to be made aware of duplicate code
    // so we will be just adding Recommended tag to programming languages: apex, javascript, typescript, and visualforce
    const recommendedLanguages: Set<Language> = new Set([Language.APEX, Language.JAVASCRIPT, Language.TYPESCRIPT, Language.VISUALFORCE]);

    return {
        name: getRuleNameFromLanguage(language),
        severityLevel: SeverityLevel.Info,
        tags: [
            ... (recommendedLanguages.has(language) ? [COMMON_TAGS.RECOMMENDED] : []),
            COMMON_TAGS.CATEGORIES.DESIGN,
            languageTag],
        description: getMessage('DetectCopyPasteForLanguageRuleDescription', language),
        resourceUrls: ['https://docs.pmd-code.org/latest/pmd_userdocs_cpd.html#refactoring-duplicates']
    }
}

function getRuleNameFromLanguage(language: Language) {
    return RULE_NAME_PREFIX + makeFirstCharUpperCase(language);
}

function makeFirstCharUpperCase(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getLanguageFromRuleName(ruleName: string): Language {
    const language: string = ruleName.slice(RULE_NAME_PREFIX.length).toLowerCase();
    if (!(CPD_AVAILABLE_LANGUAGES as string[]).includes(language)) {
        throw new Error(`Unexpected error: The rule '${ruleName}' does not map to a supported CPD language: ${JSON.stringify(CPD_AVAILABLE_LANGUAGES)}`);
    }
    return language as Language;
}

function getCacheKey(workspace?: Workspace) {
    return workspace? workspace.getWorkspaceId() : process.cwd();
}

function toCpdLanguageId(language: Language): string {
    // We must convert 'javascript' to 'ecmascript' since CPD actually uses 'ecmascript' as the identifier instead of 'javascript'
    return language == Language.JAVASCRIPT ? 'ecmascript' : language;
}

function toLanguageEnum(cpdLanguageId: string): Language {
    // We must convert 'ecmascript' back to 'javascrijpt'
    return cpdLanguageId == 'ecmascript' ? Language.JAVASCRIPT : cpdLanguageId as Language;
}

function toViolation(language: Language, cpdMatch: CpdMatch): Violation {
    return {
        ruleName: getRuleNameFromLanguage(language),
        message: getMessage('DetectCopyPasteForLanguageViolationMessage',
            language, cpdMatch.numBlocks, cpdMatch.numTokensInBlock, cpdMatch.numNonemptyLinesInBlock),
        primaryLocationIndex: 0,
        codeLocations: cpdMatch.blockLocations.map(toCodeLocation)
    }
}

function toCodeLocation(blockLocation: CpdBlockLocation): CodeLocation {
    return {
        file: blockLocation.file,
        startLine: blockLocation.startLine,
        startColumn: blockLocation.startCol,
        endLine: blockLocation.endLine,
        endColumn: blockLocation.endCol
    }
}
