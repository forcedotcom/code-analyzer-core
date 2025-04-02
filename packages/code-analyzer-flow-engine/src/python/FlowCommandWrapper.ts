import {createTempDir} from '@salesforce/code-analyzer-engine-api/utils';
import {PythonCommandExecutor} from './PythonCommandExecutor';
import {getMessage} from '../messages';
import path from "node:path";
import fs from "node:fs";

export interface FlowCommandWrapper {
    runFlowRules(flowFilesToScan: string[], absLogFilePath: string, completionPercentageHandler: (percentage: number) => void): Promise<FlowExecutionResult>;
}

export type FlowExecutionResult = {
    results: Record<string, FlowRuleResult[]>
}

export type FlowRuleResult = {
    flow: FlowNodeDescriptor[];
    query_name: string;
    severity: string;
    counter?: number;
    description: string;
    elem_name: string;
    field: string;
}

export type FlowNodeDescriptor = {
    influenced_var: string;
    influencer_var: string;
    element_name: string;
    comment: string;
    flow_path: string;
    line_no: number;
    source_text: string;
}

const STATUS_DELIMITER = '**STATUS:';

export class RunTimeFlowCommandWrapper implements FlowCommandWrapper {
    private readonly pythonCommandExecutor: PythonCommandExecutor;

    public constructor(pythonCommand: string) {
        this.pythonCommandExecutor = new PythonCommandExecutor(pythonCommand);
    }

    public async runFlowRules(flowFilesToScan: string[], absLogFilePath: string,
                                  completionPercentageHandler: (percentage: number) => void): Promise<FlowExecutionResult> {
        const tempDir: string = await createTempDir();
        const flowFilesToScanFile: string = path.join(tempDir, 'flowFilesToScan.txt');
        await fs.promises.writeFile(flowFilesToScanFile, flowFilesToScan.join('\n'), 'utf-8');

        const flowResultsFile: string = path.join(tempDir, 'flowResultsFile.json')
        const commandName = 'flowtest'; //pythonModuleName set by internal team

        const pythonArgs: string[] = [
            '-m',
            commandName,
            '--debug',
            '--log_file',
            absLogFilePath,
            '--infile',
            flowFilesToScanFile,
            '--json',
            flowResultsFile
        ];

        const processStdout = (stdoutMsg: string) => {
            // If the message doesn't start with our status delimiter, then we don't care.
            if (!stdoutMsg.startsWith(STATUS_DELIMITER)) {
                return;
            }
            // Rip off the status delimiter and then attempt to parse a Float out of the status update.
            const percentageFlowsScanned: number = parseFloat(stdoutMsg.slice(STATUS_DELIMITER.length));
            // If we successfully parsed a Float, pass it through the completion percentage processor.
            if (!Number.isNaN(percentageFlowsScanned)) {
                completionPercentageHandler(percentageFlowsScanned);
            }
        }

        await this.pythonCommandExecutor.exec(pythonArgs, processStdout);

        const outputFileContents: string = await fs.promises.readFile(flowResultsFile, 'utf-8');

        let parsedResults: object;
        try {
            parsedResults = JSON.parse(outputFileContents);
        } catch (_err) {
            throw new Error(getMessage('ResultsFileNotValidJson', outputFileContents));
        }

        if (!this.executionResultsAreValid(parsedResults)) {
            throw new Error(getMessage('CouldNotParseExecutionResults', JSON.stringify(parsedResults)));
        }

        return parsedResults;
    }

    private executionResultsAreValid(executionResults: object): executionResults is FlowExecutionResult {
        if (!('results' in executionResults) || typeof executionResults.results !== 'object') {
            return false;
        }
        const results: object = executionResults.results as object;

        for (const key of Object.keys(results)) {
            const result: unknown = results[key as keyof object];
            /* istanbul ignore next */
            if (!Array.isArray(result)) {
                return false;
            }
            for (const ruleResult of result) {
                /* istanbul ignore next */
                if (!this.ruleResultIsValid(ruleResult)) {
                    return false;
                }
            }
        }
        return true;
    }

    /* istanbul ignore next */
    private ruleResultIsValid(ruleResult: object): ruleResult is FlowRuleResult {
        if (!('query_name' in ruleResult) || typeof ruleResult.query_name !== 'string') {
            return false;
        }
        if (!('severity' in ruleResult) || typeof ruleResult.severity !== 'string') {
            return false;
        }
        if (!('description' in ruleResult) || typeof ruleResult.description !== 'string') {
            return false;
        }
        if (!('elem' in ruleResult) || typeof ruleResult.elem !== 'string') {
            return false;
        }
        if (!('elem_name' in ruleResult) || typeof ruleResult.elem_name !== 'string') {
            return false;
        }
        if (!('field' in ruleResult) || typeof ruleResult.field !== 'string') {
            return false;
        }
        if (!('flow' in ruleResult) || !(Array.isArray(ruleResult.flow))) {
            return false;
        }
        const flowNodes: object[] = ruleResult.flow;
        for (const flowNode of flowNodes) {
            if (!this.flowNodeIsValid(flowNode)) {
                return false;
            }
        }
        return true;
    }

    /* istanbul ignore next */
    private flowNodeIsValid(flowNode: object): flowNode is FlowNodeDescriptor {
        if (!('influenced_var' in flowNode) || typeof flowNode.influenced_var !== 'string') {
            return false;
        }
        if (!('influencer_var' in flowNode) || typeof flowNode.influencer_var !== 'string') {
            return false;
        }
        if (!('element_name' in flowNode) || typeof flowNode.element_name !== 'string') {
            return false;
        }
        if (!('comment' in flowNode) || typeof flowNode.comment !== 'string') {
            return false;
        }
        if (!('flow_path' in flowNode) || typeof flowNode.flow_path !== 'string') {
            return false;
        }
        if (!('line_no' in flowNode) || typeof flowNode.line_no !== 'number') {
            return false;
        }
        return 'source_text' in flowNode && typeof flowNode.source_text === 'string';
    }
}
