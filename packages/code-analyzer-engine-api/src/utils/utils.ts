import * as tmp from 'tmp';
import {promisify} from "node:util";
import {getMessage} from "../messages";
import path from "node:path";
import {LogLevel} from "../events";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";

tmp.setGracefulCleanup();
// istanbul ignore next
const tmpDirAsync = promisify((options: tmp.DirOptions, cb: tmp.DirCallback) => tmp.dir(options, cb));

/**
 * Creates a temporary directory that eventually cleans up after itself
 * @param parentTempDir - if supplied, then a temporary folder is placed directly underneath this parent folder.
 */
// istanbul ignore next
export async function createTempDir(parentTempDir?: string) : Promise<string> {
    return tmpDirAsync({dir: parentTempDir, keep: false, unsafeCleanup: true});
}

type ProcessStdOutFcn = (stdOutMsg: string) => void;
const NO_OP = () => {};

export class JavaCommandExecutor {
    private readonly javaCommand: string;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(javaCommand: string = 'java', emitLogEvent: (logLevel: LogLevel, message: string) => void = () => {}) {
        this.javaCommand = javaCommand;
        this.emitLogEvent = emitLogEvent;
    }

    async exec(javaCmdArgs: string[], javaClassPaths: string[] = [], processStdOut: ProcessStdOutFcn = NO_OP): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const stderrMessages: string[] = [];
            // istanbul ignore next
            const allJavaArgs: string[] = javaClassPaths.length == 0 ? javaCmdArgs :
                ['-cp', javaClassPaths.join(path.delimiter), ... javaCmdArgs];

            this.emitLogEvent(LogLevel.Fine, `Calling command: ${this.javaCommand} ` +
                allJavaArgs.map(arg => arg.startsWith('-') ? arg : `"${arg}"`).join(' '));

            const javaProcess: ChildProcessWithoutNullStreams = spawn(this.javaCommand, allJavaArgs);

            javaProcess.stdout.on('data', (data: Buffer) => {
                const msg: string = data.toString().trim();
                if(msg.length > 0) { // Not sure why stdout spits out empty lines, but we ignore them nonetheless
                    try {
                        msg.split("\n").map(line => processStdOut(line));
                    } catch (err) {
                        // istanbul ignore next
                        reject(err);
                    }
                }
            });
            javaProcess.stderr.on('data', (data: Buffer) => {
                stderrMessages.push(`${data.toString().trim()}`);
            });

            javaProcess.on('close', (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    const javaCommandWithArgs: string = [this.javaCommand, ...allJavaArgs].join(' ');
                    const indentedStdErr: string = indent(stderrMessages.join('\n'), '    | ');
                    reject(new Error(getMessage('JavaCommandError', javaCommandWithArgs, code, indentedStdErr)));
                }
            });
        });
    }
}

export function indent(value: string, indentation = '    '): string {
    return indentation + value.replaceAll('\n', `\n${indentation}`);
}