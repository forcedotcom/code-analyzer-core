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
import {FlowNodeDescriptor, FlowScannerCommandWrapper, FlowScannerExecutionResult, FlowScannerRuleResult} from "./python/FlowScannerCommandWrapper";
import {getDescriptionForRule, getRuleNameFromQueryId, getAllRuleNames, getQueryIdsForRule} from "./hardcoded-catalog";

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
    private targetedFlowsCache: Map<string, string[]> = new Map();
    private workspaceFlowsCache: Map<string, string[]> = new Map();

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
        const hasWorkspaceAndNoTargetedFlows = await this.hasWorkspaceAndNoTargetedFlows(describeOptions?.workspace);
        if (hasWorkspaceAndNoTargetedFlows) {
            this.emitLogEvent(LogLevel.Debug, 'No Flow files have been targeted in the workspace. Returning no flow rules.');
            this.emitDescribeRulesProgressEvent(100);
            return [];
        }
        this.emitDescribeRulesProgressEvent(75);
        const convertedRules: RuleDescription[] = getAllRuleNames().map(getDescriptionForRule);
        this.emitDescribeRulesProgressEvent(100);
        return convertedRules;
    }

    public async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        const targetedFlows: string[] = await this.getTargetedFlows(runOptions.workspace);
        if (targetedFlows.length == 0) {
            return { violations: [] };
        }
        const workspaceFlows: string[] = await this.getWorkspaceFlows(runOptions.workspace);

        const dateTimeStr: string = this.clock.formatToDateTimeString();
        const logFile: string = path.join(runOptions.logFolder, `sfca-flow-${dateTimeStr}.log`);
        this.emitLogEvent(LogLevel.Debug, getMessage('WritingFlowLogToFile', logFile));

        this.emitRunRulesProgressEvent(PRE_INVOCATION_RUN_PERCENT);
        const percentageUpdateHandler = /* istanbul ignore next */ (percentage: number) => {
            this.emitRunRulesProgressEvent(normalizeRelativeCompletionPercentage(percentage));
        }

        const queryIds: string[] = ruleNames.flatMap(getQueryIdsForRule);

        const executionResults: FlowScannerExecutionResult = await this.commandWrapper.runFlowScannerRules(
            runOptions.workingFolder,
            workspaceFlows,
            targetedFlows,
            logFile,
            queryIds,
            percentageUpdateHandler
        );
        const convertedResults: EngineRunResults = toEngineRunResults(executionResults, ruleNames);
        this.emitRunRulesProgressEvent(100);
        return convertedResults;
    }

    private async getTargetedFlows(workspace: Workspace): Promise<string[]> {
        const cacheKey: string = workspace.getWorkspaceId();
        if (!this.targetedFlowsCache.has(cacheKey)) {
            const targetedFlows: string[] = (await workspace.getTargetedFiles()).filter(fileIsFlowFile);
            this.targetedFlowsCache.set(cacheKey, targetedFlows);
        }
        return this.targetedFlowsCache.get(cacheKey)!;
    }

    private async hasWorkspaceAndNoTargetedFlows(workspace: Workspace | undefined): Promise<boolean> {
        return workspace != undefined && (await this.getTargetedFlows(workspace)).length === 0;
    }

    private async getWorkspaceFlows(workspace: Workspace): Promise<string[]> {
        const cacheKey: string = workspace.getWorkspaceId();
        if (!this.workspaceFlowsCache.has(cacheKey)) {
            const workspaceFlows: string[] = (await workspace.getWorkspaceFiles()).filter(fileIsFlowFile);
            this.workspaceFlowsCache.set(cacheKey, workspaceFlows);
        }
        return this.workspaceFlowsCache.get(cacheKey)!;
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

    for (const queryId of Object.keys(flowScannerExecutionResult.results)) {
        const flowScannerRuleResults: FlowScannerRuleResult[] = flowScannerExecutionResult.results[queryId];
        for (const flowScannerRuleResult of flowScannerRuleResults) {
            const ruleName = getRuleNameFromQueryId(flowScannerRuleResult.query_id);

            const flowNodes: FlowNodeDescriptor[] | undefined = flowScannerRuleResult.flow;
            if (flowNodes) { // If flow based violation
                results.violations.push({
                    ruleName,
                    message: flowScannerRuleResult.description,
                    codeLocations: toCodeLocationList(flowNodes),
                    primaryLocationIndex: flowNodes.length - 1,
                    resourceUrls: []
                });
            } else { // else if single element based violation
                results.violations.push({
                    ruleName,
                    message: flowScannerRuleResult.description,
                    codeLocations: [{
                        file: flowScannerRuleResult.filename!,
                        startLine: flowScannerRuleResult.elem_line_no!,
                        startColumn: 1
                    }],
                    primaryLocationIndex: 0,
                    resourceUrls: []
                })
            }
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
