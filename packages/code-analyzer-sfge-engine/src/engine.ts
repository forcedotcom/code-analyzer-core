import path from 'node:path';
import fs from 'node:fs';
import {
    CodeLocation,
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions,
    Violation,
    Workspace
} from '@salesforce/code-analyzer-engine-api';
import {JavaCommandExecutor} from '@salesforce/code-analyzer-engine-api/utils';
import {getMessage} from './messages';
import {
    RuntimeSfgeWrapper,
    SfgeRuleInfo,
    SfgeRunResult
} from "./sfge-wrapper";
import {SfgeEngineConfig} from "./config";

const SFGE_RELEVANT_FILE_EXTENSIONS = ['.cls'];

export class SfgeEngine extends Engine {
    public static readonly NAME: string = 'sfge';
    private readonly config: SfgeEngineConfig;
    private readonly sfgeWrapper: RuntimeSfgeWrapper;

    private sfgeRuleInfoListCache: Map<string, SfgeRuleInfo[]> = new Map();

    public constructor(config: SfgeEngineConfig) {
        super();
        // TODO: When we support custom Java commands, we'll need to use the config property instead of the hardcoded string here.
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor('java', this.emitLogEvent.bind(this));
        this.sfgeWrapper = new RuntimeSfgeWrapper(javaCommandExecutor, this.emitLogEvent.bind(this));
        this.config = config;
    }

    public override getName(): string {
        return SfgeEngine.NAME;
    }

    public override async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.promises.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    public override async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(5);

        const ruleInfoList: SfgeRuleInfo[] = await this.getSfgeRuleInfoList(
            describeOptions.workspace,
            (innerPerc: number) => this.emitDescribeRulesProgressEvent(5 + (90*innerPerc/100)) // 5%-95%
        );

        const ruleDescriptions: RuleDescription[] = ruleInfoList.map(toRuleDescription);
        ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    public override async runRules(selectedRuleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(2);

        const allRulesInfoList: SfgeRuleInfo[] = await this.getSfgeRuleInfoList(
            runOptions.workspace,
            (innerPerc: number) => this.emitRunRulesProgressEvent(2 + 3*(innerPerc/100)) // 2%-5%
        );

        const selectedRuleInfoList: SfgeRuleInfo[] = allRulesInfoList
            .filter(ruleInfo => selectedRuleNames.some(name => name.toLowerCase() === ruleInfo.name.toLowerCase()));

        if (selectedRuleInfoList.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        const sfgeResults: SfgeRunResult[] = await this.sfgeWrapper.invokeRunCommand(
            selectedRuleInfoList,
            runOptions.workspace,
            (innerPerc: number, message?: string) => this.emitRunRulesProgressEvent(5 + 93*innerPerc/100, message) // 5%-98%
        );

        const violations: Violation[] = [];
        for (const sfgeViolation of sfgeResults) {
            violations.push(this.toViolation(sfgeViolation));
        }

        this.emitRunRulesProgressEvent(100);
        return {
            violations
        };
    }

    private async getSfgeRuleInfoList(workspace: Workspace|undefined, emitProgress: (percComplete: number) => void): Promise<SfgeRuleInfo[]> {
        const cacheKey: string = getCacheKey(workspace);
        if (!this.sfgeRuleInfoListCache.has(cacheKey)) {
            if (workspace && !(await workspaceContainsSfgeRelevantFiles(workspace))) {
                this.sfgeRuleInfoListCache.set(cacheKey, []);
            } else {
                const ruleInfoList: SfgeRuleInfo[] = await this.sfgeWrapper.invokeDescribeCommand(emitProgress);
                this.sfgeRuleInfoListCache.set(cacheKey, ruleInfoList);
            }
        }
        return this.sfgeRuleInfoListCache.get(cacheKey)!;
    }

    private toViolation(sfgeViolation: SfgeRunResult): Violation {
        const codeLocations: CodeLocation[] = [{
            file: sfgeViolation.sourceFileName,
            startLine: sfgeViolation.sourceLineNumber,
            startColumn: sfgeViolation.sourceColumnNumber
        }];
        if (sfgeViolation.sinkFileName) {
            codeLocations.push({
                file: sfgeViolation.sinkFileName,
                startLine: sfgeViolation.sinkLineNumber!,
                startColumn: sfgeViolation.sinkColumnNumber!
            });
        }
        return {
            ruleName: sfgeViolation.ruleName,
            message: sfgeViolation.message,
            codeLocations,
            primaryLocationIndex: 0
        };
    }
}

function getCacheKey(workspace?: Workspace): string {
    return workspace ? workspace.getWorkspaceId() : process.cwd();
}

async function workspaceContainsSfgeRelevantFiles(workspace: Workspace): Promise<boolean> {
    const expandedFiles: string[] = await workspace.getExpandedFiles();
    return SFGE_RELEVANT_FILE_EXTENSIONS.some(extension => expandedFiles.some(file => file.toLowerCase().endsWith(extension)));
}

function toRuleDescription(sfgeRuleInfo: SfgeRuleInfo): RuleDescription {
    return {
        name: sfgeRuleInfo.name,
        severityLevel: sfgeRuleInfo.severity,
        tags: [COMMON_TAGS.LANGUAGES.APEX, sfgeRuleInfo.category.replaceAll(' ', '')],
        description: getMessage('DeveloperPreviewRuleNotification', sfgeRuleInfo.description),
        resourceUrls: [] // TODO: Once URLs are in their v5 state, start using them here.
    }
}