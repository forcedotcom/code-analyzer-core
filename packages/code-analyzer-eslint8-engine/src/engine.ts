import * as fs from 'node:fs/promises';
import path from 'node:path';
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
} from '@salesforce/code-analyzer-engine-api'
import {ESLintRuleStatus, ESLintRuleType} from "./enums";
import {ESLint, Linter, Rule} from "eslint";
import {MissingESLintWorkspace, PresentESLintWorkspace} from "./workspace";
import {EmitLogEventFcn, ESLintStrategy, LegacyESLintStrategy} from "./strategy";
import {ESLint8EngineConfig} from "./config";
import {getMessage} from "./messages";
import {RULE_MAPPINGS} from "./rule-mappings";

export class ESLint8Engine extends Engine {
    static readonly NAME = "eslint";
    private readonly config: ESLint8EngineConfig;
    private readonly eslintStrategyCache: Map<string, ESLintStrategy> = new Map();

    constructor(config: ESLint8EngineConfig) {
        super();
        this.config = config;
    }

    getName(): string {
        return ESLint8Engine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);

        const eslintStrategy: ESLintStrategy = this.getESLintStrategy(describeOptions.workspace);
        this.emitDescribeRulesProgressEvent(10);

        const ruleStatuses: Map<string, ESLintRuleStatus> = await eslintStrategy.calculateRuleStatuses();
        this.emitDescribeRulesProgressEvent(40);

        const rulesMetadata: Map<string, Rule.RuleMetaData> = await eslintStrategy.calculateRulesMetadata();
        this.emitDescribeRulesProgressEvent(80);

        let ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, ruleStatus] of ruleStatuses) {
            const ruleMetadata: Rule.RuleMetaData | undefined = rulesMetadata.get(ruleName);
            if (ruleMetadata) { // do not include rules that don't have metadata
                ruleDescriptions.push(toRuleDescription(ruleName, ruleMetadata, ruleStatus));
            }
        }
        ruleDescriptions = ruleDescriptions.sort((d1, d2) => d1.name.localeCompare(d2.name));
        this.emitDescribeRulesProgressEvent(100);

        return ruleDescriptions;
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);

        const eslintStrategy: ESLintStrategy = this.getESLintStrategy(runOptions.workspace);
        this.emitRunRulesProgressEvent(30);

        const eslintResults: ESLint.LintResult[] = await eslintStrategy.run(ruleNames);
        this.emitRunRulesProgressEvent(95);

        const engineResults: EngineRunResults = {violations: this.toViolations(eslintResults, new Set(ruleNames))};
        this.emitRunRulesProgressEvent(100);

        return engineResults
    }

    private getESLintStrategy(workspace?: Workspace): ESLintStrategy {
        const emitLogEventFcn: EmitLogEventFcn = (l, m) => this.emitLogEvent(l, m);
        if (!workspace) {
            return new LegacyESLintStrategy(new MissingESLintWorkspace(this.config), this.config, emitLogEventFcn);
        }
        const strategyKey: string = workspace.getWorkspaceId();
        if(!this.eslintStrategyCache.has(strategyKey)) {
            this.eslintStrategyCache.set(strategyKey,
                new LegacyESLintStrategy(new PresentESLintWorkspace(workspace, this.config), this.config, emitLogEventFcn));
        }
        return this.eslintStrategyCache.get(strategyKey)!;
    }

    private toViolations(eslintResults: ESLint.LintResult[], ruleNames: Set<string>): Violation[] {
        const violations: Violation[] = [];
        for (const eslintResult of eslintResults) {
            for (const resultMsg of eslintResult.messages) {
                const ruleName = resultMsg.ruleId;
                if(!ruleName) { // If there is no ruleName, this is how ESLint indicates something else went wrong (like a parse error).
                    this.handleEslintErrorOrWarning(eslintResult.filePath, resultMsg);
                    continue;
                }
                const violation: Violation = toViolation(eslintResult.filePath, resultMsg);

                /* istanbul ignore else */
                if (ruleNames.has(ruleName)) {
                    violations.push(violation);
                } else {
                    // This may be possible if a user tries to suppress an eslint rule in their code that isn't available. We just ignore it but debug it just in case.
                    this.emitLogEvent(LogLevel.Debug, getMessage('ViolationFoundFromUnregisteredRule', ruleName, JSON.stringify(violation,null,2)))
                }
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
}

function toRuleDescription(ruleName: string, metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): RuleDescription {
    let severityLevel: SeverityLevel;
    let tags: string[];

    if (ruleName in RULE_MAPPINGS) {
        severityLevel = RULE_MAPPINGS[ruleName].severity;
        tags = RULE_MAPPINGS[ruleName].tags;
    } else { // Any rule we don't know about from our RULE_MAPPINGS must be a custom rule. Unit tests prevent otherwise.
        severityLevel = toSeverityLevel(metadata, status);
        tags = [... toTags(metadata, status), COMMON_TAGS.CUSTOM];
    }

    let ruleUrl: string | undefined = metadata.docs?.url;
    // Currently, each lwc-platform rule's url points to internal an internal git.soma repo which is not accessible
    // to external users, so we remove them.
    // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/151
    // TODO: Remove this check once the lwc-platform rules are fixed and we have updated our dependency
    if (ruleUrl && ruleUrl.includes("://git.soma")) {
        ruleUrl = undefined
    }
    return {
        name: ruleName,
        severityLevel: severityLevel,
        tags: tags,
        description: metadata.docs?.description || '',
        resourceUrls: ruleUrl ? [ruleUrl] : []
    }
}

function toSeverityLevel(metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): SeverityLevel {
    if (status === ESLintRuleStatus.WARN) {
        // An ESLint "warn" status is what users typically use to inform them of things without labeling it as a
        // violation to stop their build over. Our Info level severity is the closest to this.
        return SeverityLevel.Info;
    } else if (metadata.type === ESLintRuleType.PROBLEM) {
        // The "problem" category is typically something users care most about, so we mark these as High severity.
        return SeverityLevel.High;
    } else if (metadata.type === ESLintRuleType.LAYOUT) {
        // The "layout" category is more for cosmetic issues only, so we mark these as Low severity.
        return SeverityLevel.Low;
    }
    // All else will give assigned Moderate. Recall that users may override these severities if they wish.
    return SeverityLevel.Moderate;
}

function toTags(metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): string[] {
    const tags: string[] = [];
    if (status === ESLintRuleStatus.ERROR || status === ESLintRuleStatus.WARN) {
        // Any rule that base config or the user's config has turned on, should be marked as 'Recommended'
        // so that code analyzer will run these rules by default just as eslint runs these rules.
        tags.push(COMMON_TAGS.RECOMMENDED);
    }
    if (metadata.type ==  ESLintRuleType.LAYOUT) {
        tags.push(COMMON_TAGS.CATEGORIES.CODE_STYLE);
    } else if (metadata.type == ESLintRuleType.PROBLEM) {
        tags.push(COMMON_TAGS.CATEGORIES.ERROR_PRONE);
    } else if (metadata.type == ESLintRuleType.SUGGESTION) {
        tags.push(COMMON_TAGS.CATEGORIES.BEST_PRACTICES);
    }

    // Unfortunately eslint 8.57.x doesn't provide any insights into what rules are associated with specific languages
    // or file extensions. Even the base rules are re-used with typescript, so we can't just look to see if the rule
    // name has "@typescript" or not.
    // TODO: Soon we will introduce a RULE_MAPPINGS (sort of like how we do with PMD) so we can set all the rule
    //       language tags and also add in "Custom" tags where necessary.
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

function indent(text: string, indentLength: number = 4): string {
    return text.replace(/^/gm, ' '.repeat(indentLength));
}
