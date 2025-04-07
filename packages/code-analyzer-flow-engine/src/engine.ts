import path from 'node:path';
import * as fs from 'node:fs/promises';
import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {Clock, RealClock} from '@salesforce/code-analyzer-engine-api/utils';
import {getMessage} from './messages';
import {FlowNodeDescriptor, FlowScannerCommandWrapper, FlowScannerExecutionResult} from "./python/FlowScannerCommandWrapper";
import {getConsolidatedRuleByName, getConsolidatedRuleName, getConsolidatedRuleNames} from "./hardcoded-catalog";

/**
 * An arbitrarily chosen value for how close the engine is to completion before the underlying Flow tool is invoked,
 * expressed as a percentage.
 */
const PRE_INVOCATION_RUN_PERCENT = 10;
/**
 * An arbitrarily chosen value for how close the engine is to completion after the underlying Flow tool has completed,
 * expressed as a percentage.
 */
const POST_INVOCATION_RUN_PERCENT = 90;

export class FlowScannerEngine extends Engine {
    public static readonly NAME: string = 'flow';
    private readonly commandWrapper: FlowScannerCommandWrapper;
    private readonly clock: Clock;
    private relevantFilesCache: Map<string, string[]> = new Map();

    public constructor(commandWrapper: FlowScannerCommandWrapper, clock: Clock = new RealClock()) {
        super();
        this.commandWrapper =  commandWrapper;
        this.clock = clock;
    }

    public getName(): string {
        return FlowScannerEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    public async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        if (describeOptions.workspace && (await this.getRelevantFiles(describeOptions.workspace)).length == 0) {
            this.emitLogEvent(LogLevel.Fine, 'No Flow files have been targeted in the workspace. Returning no flow rules.');
            this.emitDescribeRulesProgressEvent(100);
            return [];
        }
        this.emitDescribeRulesProgressEvent(75);
        const consolidatedNames: string[] = getConsolidatedRuleNames();
        const convertedRules: RuleDescription[] = consolidatedNames.map(getConsolidatedRuleByName);
        this.emitDescribeRulesProgressEvent(100);
        return convertedRules;
    }

    public async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        const relevantFiles: string[] = await this.getRelevantFiles(runOptions.workspace);
        if (relevantFiles.length == 0) {
            return { violations: [] };
        }

        const dateTimeStr: string = this.clock.formatToDateTimeString();
        const logFile: string = path.join(runOptions.logFolder, `sfca-flow-${dateTimeStr}.log`);
        this.emitLogEvent(LogLevel.Debug, getMessage('WritingFlowLogToFile', logFile));

        this.emitRunRulesProgressEvent(PRE_INVOCATION_RUN_PERCENT);
        const percentageUpdateHandler = /* istanbul ignore next */ (percentage: number) => {
            this.emitRunRulesProgressEvent(normalizeRelativeCompletionPercentage(percentage));
        }

        // TODO: Note that currently we are only passing to flow scanner the targeted files, but ideally we should
        // be passing in the relevant workspace files to be the search area from which flow scanner may look for sub flows
        // while we still pass in the targeted flow files.
        const executionResults: FlowScannerExecutionResult = await this.commandWrapper.runFlowScannerRules(
            relevantFiles, logFile, percentageUpdateHandler);
        const convertedResults: EngineRunResults = toEngineRunResults(executionResults, ruleNames);
        this.emitRunRulesProgressEvent(100);
        return convertedResults;
    }

    private async getRelevantFiles(workspace: Workspace): Promise<string[]> {
        const cacheKey: string = workspace.getWorkspaceId();
        if (!this.relevantFilesCache.has(cacheKey)) {
            const relevantFiles: string[] = (await workspace.getTargetedFiles()).filter(fileIsFlowFile);
            this.relevantFilesCache.set(cacheKey, relevantFiles);
        }
        return this.relevantFilesCache.get(cacheKey)!;
    }
}

function fileIsFlowFile(fileName: string): boolean {
    const lowerCaseFileName = fileName.toLowerCase();
    return lowerCaseFileName.endsWith('.flow') || lowerCaseFileName.endsWith('.flow-meta.xml');
}

/**
 * Accepts a percentage indicating the completion percentage of the underlying Flow Scanner tool, and converts it into a
 * percentage representing the completion percentage of the engine as a whole.
 * @param flowPercentage Completion percentage received from the Flow Scanner tool.
 */
// istanbul ignore next
function normalizeRelativeCompletionPercentage(flowPercentage: number): number {
    const percentageSpread: number = POST_INVOCATION_RUN_PERCENT - PRE_INVOCATION_RUN_PERCENT;
    return PRE_INVOCATION_RUN_PERCENT + ((flowPercentage * percentageSpread) / 100);
}

function toEngineRunResults(flowScannerExecutionResult: FlowScannerExecutionResult, requestedRules: string[]): EngineRunResults {
    const requestedRulesSet: Set<string> = new Set(requestedRules);
    const results: EngineRunResults = {
        violations: []
    };

    for (const queryName of Object.keys(flowScannerExecutionResult.results)) {
        const flowScannerRuleResults = flowScannerExecutionResult.results[queryName];
        for (const flowScannerRuleResult of flowScannerRuleResults) {
            const ruleName = getConsolidatedRuleName(flowScannerRuleResult.query_name);
            // Flow runs quickly, and its rule selection is fiddly. So it's easier to just run all the rules,
            // and then throw away results for rules that the user didn't request.
            if (!requestedRulesSet.has(ruleName)) {
                continue;
            }
            const flowNodes: FlowNodeDescriptor[] = flowScannerRuleResult.flow;
            results.violations.push({
                ruleName,
                message: flowScannerRuleResult.description,
                codeLocations: toCodeLocationList(flowNodes),
                primaryLocationIndex: flowScannerRuleResult.flow.length - 1,
                resourceUrls: []
            });
        }
    }
    return results;
}

function toCodeLocationList(flowNodes: FlowNodeDescriptor[]): CodeLocation[] {
    const results: CodeLocation[] = [];
    let previousFullVariable: string = '';
    for (let i = 0; i < flowNodes.length; i++) {
        const fullVariable = `${flowNodes[i].element_name}.${flowNodes[i].influenced_var}`;
        const comment: string = i == 0 ?
            getMessage('FirstNodeComment', fullVariable, flowNodes[i].comment) :
            getMessage('SubsequentNodeComment', previousFullVariable, fullVariable, flowNodes[i].comment);
        results.push({
            file: flowNodes[i].flow_path,
            startLine: flowNodes[i].line_no,
            startColumn: 1,
            comment: comment
        });
        previousFullVariable = fullVariable;
    }
    return results;
}
