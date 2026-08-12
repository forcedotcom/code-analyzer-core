import {indent} from '@salesforce/code-analyzer-engine-api/utils';
import {ChildProcessWithoutNullStreams, spawn} from 'node:child_process';
import path from 'node:path';
import {getMessage} from "../messages";

type ProcessStdOutFn = (stdoutMsg: string) => void;
const NO_OP = () => {};

const PATH_TO_FLOW_SCANNER_ROOT = path.join(__dirname, '..', '..', 'FlowScanner');

export class PythonCommandExecutor {
    private readonly pythonCommand: string;

    public constructor(pythonCommand: string) {
        this.pythonCommand = pythonCommand;
    }

    public async exec(pythonCmdArgs: string[], processStdout: ProcessStdOutFn = NO_OP): Promise<void> {
        return new Promise<void>((res, rej) => {
            const stderrMessages: string[] = [];

            const pythonProcess: ChildProcessWithoutNullStreams = spawn(this.pythonCommand, pythonCmdArgs, {
                // Pin the child's working directory to the trusted bundled FlowScanner root. When python is
                // invoked with '-m flow_scanner', CPython places the process's cwd at sys.path[0], ahead of
                // PYTHONPATH. Inheriting the CLI's cwd (the scanned repo) would let a repo-planted
                // `flow_scanner` package shadow the bundled scanner and execute attacker code (CWE-427). All
                // file arguments the wrapper passes are absolute, so pinning cwd here is behavior-preserving.
                cwd: PATH_TO_FLOW_SCANNER_ROOT,
                env: {
                    ...process.env,
                    PYTHONPATH: PATH_TO_FLOW_SCANNER_ROOT
                }
            });

            pythonProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if(msg.length > 0) { // Not sure why stdout spits out empty lines sometimes, but we ignore them nonetheless
                    msg.split("\n").map(line => processStdout(line));
                }
            });

            pythonProcess.stderr.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if(msg.length > 0) { // Not sure why stderr spits out empty lines sometimes, but we ignore them nonetheless
                    stderrMessages.push(msg);
                }
            });

            pythonProcess.on('close', (code: number) => {
                if (code === 0) {
                    res();
                } else {
                    const pythonCommandWithArgs: string = [this.pythonCommand, ...pythonCmdArgs].join(' ');
                    const indentedStdErr: string = indent(stderrMessages.join('\n'), '    | ');
                    rej(new Error(getMessage('PythonCommandError', pythonCommandWithArgs, code, indentedStdErr)));
                }
            });
        });
    }
}
