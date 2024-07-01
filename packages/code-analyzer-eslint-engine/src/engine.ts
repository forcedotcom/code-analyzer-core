import {
    ConfigObject,
    DescribeOptions,
    Engine,
    EnginePluginV1,
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel
} from '@salesforce/code-analyzer-engine-api'
import {getMessage} from "./messages";
import {ESLintRuleStatus, ESLintRuleType} from "./enums";
import {Rule} from "eslint";
import {ESLintWorkspace, MissingESLintWorkspace, PresentESLintWorkspace} from "./workspace";
import {ESLintStrategy, LegacyESLintStrategy} from "./strategy";

const DEFAULT_JAVASCRIPT_EXTENSIONS: string[] = ['.js', '.cjs', '.mjs'];
const DEFAULT_TYPESCRIPT_EXTENSIONS: string[] = ['.ts'];

export class ESLintEnginePlugin extends EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return [ESLintEngine.NAME];
    }

    async createEngine(engineName: string, _engineConfig: ConfigObject): Promise<Engine> {
        if (engineName === ESLintEngine.NAME) {
            return new ESLintEngine();
        }
        throw new Error(getMessage('CantCreateEngineWithUnknownEngineName', engineName));
    }
}

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";
    private readonly javascriptExtensions: string[];
    private readonly typescriptExtensions: string[];

    constructor() {
        super();

        // TODO: Once we implement engine config, add this as an option to the engine config
        this.javascriptExtensions = DEFAULT_JAVASCRIPT_EXTENSIONS;
        this.typescriptExtensions = DEFAULT_TYPESCRIPT_EXTENSIONS;
    }

    getName(): string {
        return ESLintEngine.NAME;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const workspace: ESLintWorkspace = describeOptions.workspace?
            new PresentESLintWorkspace(describeOptions.workspace, this.javascriptExtensions, this.typescriptExtensions) :
            new MissingESLintWorkspace(this.javascriptExtensions, this.typescriptExtensions);

        const eslintStrategy: ESLintStrategy = new LegacyESLintStrategy(workspace);

        const ruleStatuses: Map<string, ESLintRuleStatus> = await eslintStrategy.calculateRuleStatuses();
        const rulesMetadata: Map<string, Rule.RuleMetaData> = await eslintStrategy.calculateRulesMetadata();

        const ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, ruleStatus] of ruleStatuses) {
            const ruleMetadata: Rule.RuleMetaData | undefined = rulesMetadata.get(ruleName);
            if (ruleMetadata) { // do not include rules that don't have metadata
                ruleDescriptions.push(toRuleDescription(ruleName, ruleMetadata, ruleStatus));
            }
        }
        return ruleDescriptions.sort((d1, d2) => d1.name.localeCompare(d2.name));
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        // TODO: Implement this. Note that we'll want to cache the eslintStrategy from above and reuse it if the workspace is the same.
        return {
            violations: []
        }
    }
}




function toRuleDescription(name: string, metadata: Rule.RuleMetaData, status: ESLintRuleStatus | undefined): RuleDescription {
    return {
        name: name,
        severityLevel: toSeverityLevel(metadata, status),
        type: RuleType.Standard,
        tags: toTags(metadata, status),
        description: metadata.docs?.description || '',
        resourceUrls: metadata.docs?.url ? [metadata.docs.url] : []
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
        tags.push('Recommended');
    }
    if (metadata.type) {
        tags.push(metadata.type);
    }
    return tags;
}