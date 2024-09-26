import path from 'node:path';
import {PythonCommandExecutor} from './PythonCommandExecutor';


export interface FlowTestCommandWrapper {
    getFlowTestRuleDescriptions(): Promise<FlowTestRuleDescriptor[]>;
}

/**
 * The format used by FlowTest to describe the Queries (FlowTest's term for what we'd call rules) it can run.
 */
export type FlowTestRuleDescriptor = {
    /**
     * A machine-readable ID consisting of a unique string. E.g., "FlowSecurity.SystemModeWithSharing.recordCreates.data".
     */
    query_id: string;
    /**
     * A human-readable name consisting of a unique string. E.g., "Flow: SystemModeWithSharing recordCreates data".
     */
    query_name: string;
    /**
     * A string indicating relative severity. either {@code Flow_Low_Severity}, {@code Flow_Moderate_Severity}, or {@code Flow_High_Severity}.
     */
    severity: string;
    /**
     * A string describing the specific case the query identifies.
     */
    query_description: string;
    /**
     * A URL for help text.
     */
    help_url: string;
    /**
     * Not a property we care about.
     */
    query_version: string;
    /**
     * A string-wrapped boolean indicating whether the rule is security-related.
     */
    is_security: string;
}

const PATH_TO_PIPX_PYZ = path.join(__dirname, '..', '..', 'pipx.pyz');
const PATH_TO_FLOWTEST_ROOT = path.join(__dirname, '..', '..', 'FlowTest');

export class RunTimeFlowTestCommandWrapper implements FlowTestCommandWrapper {
    private readonly pythonCommandExecutor: PythonCommandExecutor;

    public constructor(pythonCommand: string) {
        this.pythonCommandExecutor = new PythonCommandExecutor(pythonCommand);
    }

    public async getFlowTestRuleDescriptions(): Promise<FlowTestRuleDescriptor[]> {
        const pythonArgs: string[] = [
            PATH_TO_PIPX_PYZ,
            'run',
            '--no-cache',
            '--spec',
            PATH_TO_FLOWTEST_ROOT,
            '--',
            'flowtest',
            '-p'
        ];

        let stdout: string = '';
        const processStdout = (stdoutMsg: string) => {
            stdout += stdoutMsg;
        }
        await this.pythonCommandExecutor.exec(pythonArgs, processStdout);
        return JSON.parse(stdout) as FlowTestRuleDescriptor[];
    }
}