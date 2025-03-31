import path from 'node:path';
import fs from 'node:fs';
import {
    CodeLocation,
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    Violation,
    Workspace
} from '@salesforce/code-analyzer-engine-api';
import {JavaCommandExecutor} from '@salesforce/code-analyzer-engine-api/utils';
import {Clock, RealClock} from './utils';
import {getMessage} from './messages';
import {RuntimeSfgeWrapper, SfgeRuleInfo, SfgeRunOptions, SfgeRunResult} from "./sfge-wrapper";
import {SfgeEngineConfig} from "./config";

const SFGE_RELEVANT_FILE_EXTENSIONS = ['.cls'];
const DEV_PREVIEW_TAG: string = 'DevPreview';
const PILOT_TAG: string = 'Pilot';

export class SfgeEngine extends Engine {
    public static readonly NAME: string = 'sfge';
    private readonly config: SfgeEngineConfig;
    private readonly sfgeWrapper: RuntimeSfgeWrapper;

    private sfgeRuleInfoListCache: Map<string, SfgeRuleInfo[]> = new Map();
    private relevantFilesByWorkspaceId: Map<string, string[]> = new Map();

    public constructor(config: SfgeEngineConfig, clock: Clock = new RealClock()) {
        super();
        // TODO: When we support custom Java commands, we'll need to use the config property instead of the hardcoded string here.
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor('java', this.emitLogEvent.bind(this));
        this.sfgeWrapper = new RuntimeSfgeWrapper(javaCommandExecutor, clock, this.emitLogEvent.bind(this));
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
            describeOptions,
            (innerPerc: number) => this.emitDescribeRulesProgressEvent(5 + (90*innerPerc/100)) // 5%-95%
        );

        const ruleDescriptions: RuleDescription[] = ruleInfoList.map(toRuleDescription);
        ruleDescriptions.sort((rd1, rd2) => rd1.name.localeCompare(rd2.name));
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    public override async runRules(selectedRuleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(2);

        if (selectedRuleNames.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        await this.validateWorkspaceCompleteness(runOptions.workspace);

        const allRulesInfoList: SfgeRuleInfo[] = await this.getSfgeRuleInfoList(
            runOptions,
            (innerPerc: number) => this.emitRunRulesProgressEvent(2 + 3*(innerPerc/100)) // 2%-5%
        );

        const selectedRuleInfoList: SfgeRuleInfo[] = allRulesInfoList
            .filter(ruleInfo => selectedRuleNames.some(name => name.toLowerCase() === ruleInfo.name.toLowerCase()));

        if (selectedRuleInfoList.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        const relevantFiles: string[] = await this.getRelevantFilesInWorkspace(runOptions.workspace);

        const sfgeRunOptions: SfgeRunOptions = {
            heapSizeArg: this.config.java_max_heap_size,
            logFolder: runOptions.logFolder,
            disableLimitReachedViolations: this.config.disable_limit_reached_violations,
            threadCount: this.config.java_thread_count,
            threadTimeout: this.config.java_thread_timeout
        };

        const sfgeResults: SfgeRunResult[] = await this.sfgeWrapper.invokeRunCommand(
            selectedRuleInfoList,
            relevantFiles, // TODO: WHEN WE ADD PATH-START TARGETING, THIS NEEDS TO CHANGE.
            relevantFiles,
            sfgeRunOptions,
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

    private async validateWorkspaceCompleteness(workspace: Workspace): Promise<void> {
        const allRelevantFiles: string[] = await this.getRelevantFilesInWorkspace(workspace);
        const knownRelevantFileCountByDirectory: Map<string, number> = new Map();

        for (const relevantFile of allRelevantFiles) {
            const dirName: string = path.dirname(relevantFile);
            const knownRelevantFilesInDirectory: number = knownRelevantFileCountByDirectory.get(dirName) ?? 0;
            knownRelevantFileCountByDirectory.set(dirName, knownRelevantFilesInDirectory + 1);
        }

        for (const [dirName, knownRelevantFileCount] of knownRelevantFileCountByDirectory.entries()) {
            const dirEntries: string[] = await fs.promises.readdir(dirName);
            const allRelevantFileCount: number = dirEntries.filter(isFileRelevantToSfge).length;
            if (allRelevantFileCount !== knownRelevantFileCount) {
                this.emitLogEvent(LogLevel.Warn, getMessage('WorkspaceAppearsIncomplete',
                    allRelevantFileCount - knownRelevantFileCount,
                    dirName));
            }
        }
    }

    private async getSfgeRuleInfoList(options: DescribeOptions|RunOptions, emitProgress: (percComplete: number) => void): Promise<SfgeRuleInfo[]> {
        const workspace: Workspace|undefined = options.workspace;
        const logFolder: string = options.logFolder;
        const cacheKey: string = getCacheKey(workspace);
        if (!this.sfgeRuleInfoListCache.has(cacheKey)) {
            if (workspace && (await this.getRelevantFilesInWorkspace(workspace)).length === 0) {
                this.sfgeRuleInfoListCache.set(cacheKey, []);
            } else {
                const ruleInfoList: SfgeRuleInfo[] = await this.sfgeWrapper.invokeDescribeCommand(emitProgress, logFolder);
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
        const violation: Violation = {
            ruleName: sfgeViolation.ruleName,
            message: sfgeViolation.message,
            codeLocations,
            primaryLocationIndex: 0
        };
        return this.adjustCodeLocationsIfNeeded(violation);
    }

    private async getRelevantFilesInWorkspace(workspace: Workspace): Promise<string[]> {
        if (!this.relevantFilesByWorkspaceId.has(workspace.getWorkspaceId())) {
            const relevantFiles: string[] = (await workspace.getExpandedFiles()).filter(isFileRelevantToSfge);
            this.relevantFilesByWorkspaceId.set(workspace.getWorkspaceId(), relevantFiles);
        }
        return this.relevantFilesByWorkspaceId.get(workspace.getWorkspaceId())!;
    }

    private adjustCodeLocationsIfNeeded(unadjustedViolation: Violation): Violation {
        const unadjustedCodeLocations: CodeLocation[] = unadjustedViolation.codeLocations;
        const adjustedCodeLocations: CodeLocation[] = [];
        let locationsChanged: boolean = false;
        for (const unadjustedCodeLocation of unadjustedCodeLocations) {
            const adjustedCodeLocation: CodeLocation = {
                file: unadjustedCodeLocation.file,
                startLine: unadjustedCodeLocation.startLine,
                startColumn: unadjustedCodeLocation.startColumn
            };
            if (adjustedCodeLocation.startLine < 1) {
                adjustedCodeLocation.startLine = 1;
                locationsChanged = true;
            }
            if (adjustedCodeLocation.startColumn < 1) {
                adjustedCodeLocation.startColumn = 1;
                locationsChanged = true;
            }
            adjustedCodeLocations.push(adjustedCodeLocation);
        }
        const adjustedViolation: Violation = {
            ruleName: unadjustedViolation.ruleName,
            message: unadjustedViolation.message,
            codeLocations: adjustedCodeLocations,
            primaryLocationIndex: unadjustedViolation.primaryLocationIndex
        }
        if (locationsChanged) {
            this.emitLogEvent(LogLevel.Fine, getMessage('ViolationLocationFudged', JSON.stringify(unadjustedViolation), JSON.stringify(adjustedViolation)));
        }
        return adjustedViolation;
    }
}

function getCacheKey(workspace?: Workspace): string {
    return workspace ? workspace.getWorkspaceId() : process.cwd();
}

function isFileRelevantToSfge(fileName: string): boolean {
    return SFGE_RELEVANT_FILE_EXTENSIONS.some(extension => fileName.toLowerCase().endsWith(extension));
}

function toRuleDescription(sfgeRuleInfo: SfgeRuleInfo): RuleDescription {
    const tags: string[] = [DEV_PREVIEW_TAG, sfgeRuleInfo.category.replaceAll(' ', '')];
    if (sfgeRuleInfo.isPilot) {
        tags.push(PILOT_TAG);
    }
    tags.push(COMMON_TAGS.LANGUAGES.APEX);
    return {
        name: sfgeRuleInfo.name,
        severityLevel: sfgeRuleInfo.severity,
        tags,
        description: getMessage('DeveloperPreviewRuleNotification', sfgeRuleInfo.description),
        resourceUrls: [] // TODO: Once URLs are in their v5 state, start using them here.
    }
}
