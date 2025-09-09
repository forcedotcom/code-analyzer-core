import * as path from "node:path";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import {Serializable, Worker} from "node:worker_threads";
import {EngineEventEmitter, Event} from "@salesforce/code-analyzer-engine-api";

/**
 * Generalized Abstract WorkerTask that makes it easy to create a task that can run in a background worker thread.
 * Note that unless _runInCurrentThreadInsteadofNewThread is set to true, it is assumed that the concrete class that
 * extends from this abstract class has been compiled to javascript and the constructor has passed in the location to
 * its javascript file.
 */
export abstract class WorkerTask<Input extends Serializable, Output extends Serializable> extends EngineEventEmitter {
    private readonly taskJsFilePath: string;
    private readonly taskClassName: string;
    private workerScriptFileCache: Map<string, string> = new Map();

    /**
     * Internal use and testing use only:
     * This is set to true when the worker thread executes this task, but it can also be set to true in our typescript
     * unit tests so that we do not need to do a compile step before running our tests.
     */
    _runInCurrentThreadInsteadofNewThread: boolean = false;

    /**
     * All classes that extend from WorkerTask must use this constructor to pass in the required information for creating a worker script file.
     * @param taskJsFilePath The absolute path to the js file (typically inside the dist directory) which can be used in an import statement.
     * @param taskClassName The exported class name of the task which can be used an import statement and in a new statement.
     * @protected
     */
    protected constructor(taskJsFilePath: string, taskClassName: string) {
        super();
        this.taskJsFilePath = taskJsFilePath;
        this.taskClassName = taskClassName;
    }

    /**
     * All classes that extend from WorkerTask must implement an exec method here which receives serializable input and returns serializable output
     * @param input The serializable input to the task
     * @protected
     */
    protected abstract exec(input?: Input): Promise<Output>

    /**
     * Runs the task
     * If _runInCurrentThreadInsteadofNewThread is set to true then it uses the current thread. Otherwise, it creates
     * a worker script to run the task in a background worker thread.
     * @param taskInput The serializable input to the task
     */
    async run(taskInput?: Input, workingFolder?: string): Promise<Output> {
        if (this._runInCurrentThreadInsteadofNewThread) {
            return this.exec(taskInput);
        }

        const worker: Worker = new Worker(await this.getWorkerScriptFile(workingFolder), { workerData: { input: taskInput } });

        return new Promise((resolve, reject) => {
            worker.on('message', (msg: Event | {type: "output", output: Output}) => {
                if (msg.type === "output") {
                    resolve(msg.output);
                } else {
                    this.emitEvent(msg);
                }
            });
            /* istanbul ignore next */
            worker.on('error', (err: Error) => reject(err));
            /* istanbul ignore next */
            worker.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`The worker task '${this.taskClassName}' associated with '${this.taskJsFilePath}' exited with a non zero exit code: ${code}`));
                }
            });
        });
    }

    private async getWorkerScriptFile(workingFolder: string = os.tmpdir()): Promise<string> {
        /* istanbul ignore if */
        if (this.workerScriptFileCache.has(workingFolder)) {
            return this.workerScriptFileCache.get(workingFolder)!;
        }

        // We must use common JS since the taskJsFilePath points to a transpiled common JS file
        const workerScriptFile = path.join(workingFolder, `${this.taskClassName}_worker_script.cjs`);
        const workerScriptFileContents: string =
            `const { parentPort, workerData } = require("node:worker_threads");\n` +
            `const engineApi = require("${require.resolve("@salesforce/code-analyzer-engine-api").replace(/\\/g, '\\\\')}");\n` +
            `const { ${this.taskClassName} } = require("${this.taskJsFilePath.replace(/\\/g, '\\\\')}");\n` + //  Need to escape slashes in strings for windows paths
            `(async () => {\n` +
            `    const input = workerData.input;\n` +
            `    const task = new ${this.taskClassName}();\n` +
            `    for (const eventType of Object.values(engineApi.EventType)) {\n` +
            `        task.onEvent(eventType, (evt) => {\n` +
            `            parentPort.postMessage(evt);\n` +
            `        });\n` +
            `    }\n` +
            `    task._runInCurrentThreadInsteadofNewThread = true;\n` + // Important. Without this line we would have an infinite loop.
            `    const output = await task.run(input);\n` +
            `    parentPort.postMessage({type: "output", output: output});\n` +
            `})();\n`;

        await fsp.writeFile(workerScriptFile, workerScriptFileContents, 'utf-8');
        this.workerScriptFileCache.set(workingFolder, workerScriptFile);
        return workerScriptFile;
    }
}
