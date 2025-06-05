import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    EventType,
    LogLevel,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace,
} from '@salesforce/code-analyzer-engine-api'
import {ESLint, Linter} from "eslint";
import {RulesMeta} from "@eslint/core";
import {ESLintEngineConfig} from "./config";
import {UserConfigInfo, UserConfigState} from "./user-config-info";
import {getMessage} from "./messages";
import {ESLintWorkspace} from "./workspace";
import {RULE_MAPPINGS} from "./rule-mappings";
import {indent} from '@salesforce/code-analyzer-engine-api/utils';
import {RunESLintWorkerTask, RunESLintWorkerTaskInput} from "./run-eslint-worker-task";
import {ESLintContext, ESLintContextFactory, ESLintRuleStatus} from "./eslint-context";

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";

    // Keeping this public so that tests can modify the _runInCurrentThreadInsteadofNewThread property if needed
    readonly _runESLintWorkerTask: RunESLintWorkerTask;

    private readonly engineConfig: ESLintEngineConfig;
    private readonly delegateV8Engine: Engine;
    private readonly contextFactory: ESLintContextFactory;
    private userConfigInfoCache: Map<string, UserConfigInfo> = new Map();
    private eslintContextCache: Map<string, ESLintContext> = new Map();

    constructor(engineConfig: ESLintEngineConfig, delegateV8Engine: Engine) {
        super();
        this.engineConfig = engineConfig;
        this.delegateV8Engine = delegateV8Engine;
        this.contextFactory = new ESLintContextFactory();
        this._runESLintWorkerTask = new RunESLintWorkerTask();
        for (const eventType of Object.values(EventType)) { // Forward events from composed classes
            this.delegateV8Engine.onEvent(eventType, this.emitEvent.bind(this));
            this.contextFactory.onEvent(eventType, this.emitEvent.bind(this));
            this._runESLintWorkerTask.onEvent(eventType, this.emitEvent.bind(this));
        }
    }

    getName(): string {
        return ESLintEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);

        const userConfigInfo: UserConfigInfo = this.getUserConfigInfo(describeOptions.workspace);
        this.emitLogEvent(LogLevel.Fine, `Detected the following state regarding the user's ESLint configuration: ${userConfigInfo}`);

        if (userConfigInfo.getState() === UserConfigState.LEGACY_USER_CONFIG) {
            this.emitLogEvent(LogLevel.Warn, getMessage('DetectedLegacyConfig',
                userConfigInfo.getChosenUserConfigFile() ?? /* istanbul ignore next */ userConfigInfo.getChosenUserIgnoreFile()!));
            return this.delegateV8Engine.describeRules(describeOptions);
        }

        if (userConfigInfo.getChosenUserConfigFile()) {
            this.emitLogEvent(LogLevel.Debug, getMessage('ApplyingFlatConfigFile', userConfigInfo.getChosenUserConfigFile()!));
        } else if (userConfigInfo.getDiscoveredConfigFile()) {
            this.emitLogEvent(LogLevel.Info, getMessage('UnusedESLintConfigFile',
                makeRelativeTo(process.cwd(), userConfigInfo.getDiscoveredConfigFile()!),
                makeRelativeTo(this.engineConfig.config_root, userConfigInfo.getDiscoveredConfigFile()!)));
        }
        if (userConfigInfo.getChosenUserIgnoreFile()) {
            this.emitLogEvent(LogLevel.Warn, getMessage('IgnoringLegacyIgnoreFile', userConfigInfo.getChosenUserIgnoreFile()!));
        }

        this.emitDescribeRulesProgressEvent(10);
        const context: ESLintContext = await this.getESLintContext(describeOptions.workspace); // TODO: Add additional progress events while calculating the context

        this.emitDescribeRulesProgressEvent(90);
        let ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, ruleState] of Object.entries(context.ruleInfo)) {
            // If a user's configuration has a rule explicitly turned off, then since we have no way of turning
            // it back on in our final configuration (because we don't know what rule parameters to use) then we simply
            // prevent these rules from showing up and being selectable.
            if (ruleState.status === ESLintRuleStatus.OFF) {
                continue;
            }
            // Only include rules that have metadata and that are not deprecated
            if (ruleState.meta && !ruleState.meta.deprecated) {
                ruleDescriptions.push(toRuleDescription(ruleName, ruleState.meta, ruleState.status));
            }
        }
        this.emitDescribeRulesProgressEvent(95);
        ruleDescriptions = ruleDescriptions.sort((d1, d2) => d1.name.localeCompare(d2.name));

        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        const userConfigInfo: UserConfigInfo = this.getUserConfigInfo(runOptions.workspace);
        if (userConfigInfo.getState() === UserConfigState.LEGACY_USER_CONFIG) {
            return this.delegateV8Engine.runRules(ruleNames, runOptions);
        }

        const context: ESLintContext = await this.getESLintContext(runOptions.workspace);
        this.emitRunRulesProgressEvent(30);

        if (context.filesToScan.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        // The ESLint.lintFiles method can be expensive. It seems to run everything synchronously which can block
        // the main node thread preventing the display from being updated with progress updates. To work around this
        // we do the heavy lifting with a background worker thread. This requires the input/output to that thread to be
        // serializable. After getting the ESLintContext (which is serializable) we now can just hand over the remaining
        // pieces needed via a serializable RunESLintWorkerTaskInput and then execute.
        const runTaskInput: RunESLintWorkerTaskInput = {
            rulesToRun: ruleNames,
            engineConfig: this.engineConfig,
            eslintContext: context
        }
        const lintResults: ESLint.LintResult[] = await this._runESLintWorkerTask.run(runTaskInput); // TODO: See if we can add in progress events when ESLint is running (maybe with a custom plugin?)
        this.emitRunRulesProgressEvent(95);

        const engineResults: EngineRunResults = {
            violations: this.toViolations(lintResults)
        };
        this.emitRunRulesProgressEvent(100);
        return engineResults;
    }

    private toViolations(eslintResults: ESLint.LintResult[]): Violation[] {
        const violations: Violation[] = [];
        for (const eslintResult of eslintResults) {
            for (const resultMsg of eslintResult.messages) {
                if (!resultMsg.ruleId) { // If there is no ruleName, this is how ESLint indicates something else went wrong (like a parse error).
                    this.handleEslintErrorOrWarning(eslintResult.filePath, resultMsg);
                    continue;
                }
                const violation: Violation = toViolation(eslintResult.filePath, resultMsg);
                violations.push(violation);
            }
        }
        return violations;
    }

    private handleEslintErrorOrWarning(file: string, resultMsg: Linter.LintMessage) {
        /* istanbul ignore else */
        if (resultMsg.fatal) {
            this.emitLogEvent(LogLevel.Error, getMessage('ESLintErroredWhenScanningFile', file, indent(resultMsg.message)));
        } else {
            this.emitLogEvent(LogLevel.Warn, getMessage('ESLintWarnedWhenScanningFile', file, indent(resultMsg.message)));
        }
    }

    private getUserConfigInfo(workspace?: Workspace): UserConfigInfo {
        const cacheKey: string = workspace?.getWorkspaceId() ?? process.cwd();
        if (!this.userConfigInfoCache.has(cacheKey)) {
            this.userConfigInfoCache.set(cacheKey, new UserConfigInfo(this.engineConfig, workspace));
        }
        return this.userConfigInfoCache.get(cacheKey)!;
    }

    private async getESLintContext(workspace?: Workspace): Promise<ESLintContext> {
        const cacheKey: string = workspace?.getWorkspaceId() ?? process.cwd();
        if (!this.eslintContextCache.has(cacheKey)) {
            const userConfigInfo: UserConfigInfo = this.getUserConfigInfo(workspace);
            const eslintWorkspace: ESLintWorkspace = ESLintWorkspace.from(workspace,
                this.engineConfig.config_root, this.engineConfig.file_extensions, userConfigInfo.getChosenUserConfigFile());
            const context: ESLintContext = await this.contextFactory.calculateESLintContext(this.engineConfig, eslintWorkspace,
                userConfigInfo.getChosenUserConfigFile());
            this.eslintContextCache.set(cacheKey, context);
        }
        return this.eslintContextCache.get(cacheKey)!;
    }
}


function toRuleDescription(ruleName: string, metadata: RulesMeta, status: ESLintRuleStatus): RuleDescription {
    let severityLevel: SeverityLevel;
    let tags: string[];

    if (ruleName in RULE_MAPPINGS) {
        severityLevel = RULE_MAPPINGS[ruleName].severity;
        tags = RULE_MAPPINGS[ruleName].tags;
    } else { // Any rule we don't know about from our RULE_MAPPINGS must be a custom rule. Unit tests prevent otherwise.
        severityLevel = toSeverityLevelForCustomRule(metadata, status);
        tags = toTagsForCustomRule(metadata);
    }

    let ruleUrl: string | undefined = metadata.docs?.url;
    // Currently, each lwc-platform rule's url points to internal an internal git.soma repo which is not accessible
    // to external users, so we remove them. See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/151
    // TODO: Remove this check once the lwc-platform rules are fixed and we have updated our dependency
    if (ruleUrl && ruleUrl.includes("://git.soma")) {
        ruleUrl = undefined;
    }
    return {
        name: ruleName,
        severityLevel: severityLevel,
        tags: tags,
        description: metadata.docs?.description || '',
        resourceUrls: ruleUrl ? [ruleUrl] : []
    }
}

function toSeverityLevelForCustomRule(metadata: RulesMeta, status: ESLintRuleStatus): SeverityLevel {
    if (status === ESLintRuleStatus.WARN) {
        // An ESLint "warn" status is what users typically use to inform them of things without labeling it as a
        // violation to stop their build over. Our Info level severity is the closest to this.
        return SeverityLevel.Info;
    } else if (metadata.type === "problem") {
        // The "problem" category is typically something users care most about, so we mark these as High severity.
        return SeverityLevel.High;
    } else if (metadata.type === "layout") {
        // The "layout" category is more for cosmetic issues only, so we mark these as Low severity.
        return SeverityLevel.Low;
    }
    // All else will give assigned Moderate. Recall that users may override these severities if they wish.
    return SeverityLevel.Moderate;
}

function toTagsForCustomRule(metadata: RulesMeta): string[] {
    const tags: string[] = [COMMON_TAGS.RECOMMENDED];
    if (metadata.type === "layout") {
        tags.push(COMMON_TAGS.CATEGORIES.CODE_STYLE);
    } else if (metadata.type === "problem") {
        tags.push(COMMON_TAGS.CATEGORIES.ERROR_PRONE);
    } else if (metadata.type === "suggestion") {
        tags.push(COMMON_TAGS.CATEGORIES.BEST_PRACTICES);
    }
    tags.push(COMMON_TAGS.CUSTOM);
    // Unfortunately ESLint doesn't provide any insights into what rules are associated with specific languages
    // or file extensions, so we cannot add in language tags for custom rules.
    return tags;
}


function toViolation(file: string, resultMsg: Linter.LintMessage): Violation {
    // Note: If in the future we add in some sort of suggestion or fix field on Violation, then we might want to
    // leverage the fix and/or suggestions field on the LintMessage object.
    // See: https://eslint.org/docs/v8.x/integrate/nodejs-api#-lintmessage-type
    return {
        ruleName: resultMsg.ruleId as string,
        message: resultMsg.message,
        codeLocations: [{
            file: file,
            startLine: normalizeStartValue(resultMsg.line),
            startColumn: normalizeStartValue(resultMsg.column),
            endLine: normalizeEndValue(resultMsg.endLine),
            endColumn: normalizeEndValue(resultMsg.endColumn),
        }],
        primaryLocationIndex: 0
    };
}

function normalizeStartValue(startValue: number): number {
    // Sometimes rules contain a negative number if the line/column is unknown, so we force 1 in that case
    return Math.max(startValue, 1);
}

function normalizeEndValue(endValue: number | undefined): number | undefined {
    // Sometimes rules contain a negative number if the line/column is unknown, so we force undefined in that case
    /* istanbul ignore next */
    return endValue && endValue > 0 ? endValue : undefined;
}


function makeRelativeTo(absFolderPath: string, absFilePath: string): string {
    absFolderPath = absFolderPath.endsWith(path.sep) ?
        /* istanbul ignore next */ absFolderPath : absFolderPath + path.sep;
    return absFilePath.startsWith(absFolderPath) ?
        absFilePath.slice(absFolderPath.length) : /* istanbul ignore next */  absFilePath;
}
