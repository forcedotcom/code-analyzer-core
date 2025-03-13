import path from 'node:path';
import fs from 'node:fs';
import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions,
    Workspace
} from '@salesforce/code-analyzer-engine-api';
import {JavaCommandExecutor} from '@salesforce/code-analyzer-engine-api/utils';
import {
    RuntimeSfgeWrapper,
    SfgeRuleInfo
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

    public override runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        return Promise.resolve({
            violations: []
        });
    }
}

function getCacheKey(workspace?: Workspace): string {
    return workspace ? workspace.getWorkspaceId() : process.cwd();
}

async function workspaceContainsSfgeRelevantFiles(workspace: Workspace): Promise<boolean> {
    const expandedFiles: string[] = await workspace.getExpandedFiles();
    return SFGE_RELEVANT_FILE_EXTENSIONS.some(extension => expandedFiles.some(file => file.endsWith(extension)));
}

function toRuleDescription(sfgeRuleInfo: SfgeRuleInfo): RuleDescription {
    return {
        name: sfgeRuleInfo.name,
        severityLevel: sfgeRuleInfo.severity,
        tags: [sfgeRuleInfo.category.replaceAll(' ', '')],
        description: sfgeRuleInfo.description,
        resourceUrls: [sfgeRuleInfo.url]
    }
}