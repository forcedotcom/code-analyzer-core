import * as path from "node:path";
import {WorkerTask} from "./worker-task";
import {ESLint} from "eslint";
import {ESLintEngineConfig} from "./config";
import {ESLintContext} from "./eslint-context";
import {createESLint} from "./eslint-wrapper";

export type RunESLintWorkerTaskInput = {
    rulesToRun: string[]
    engineConfig: ESLintEngineConfig,
    eslintContext: ESLintContext
}

export class RunESLintWorkerTask extends WorkerTask<RunESLintWorkerTaskInput, ESLint.LintResult[]> {
    static COMPILED_JS_FILE_PATH: string = path.resolve(__dirname, '..', 'dist', 'run-eslint-worker-task.js');

    constructor() {
        super(RunESLintWorkerTask.COMPILED_JS_FILE_PATH, 'RunESLintWorkerTask');
    }

    protected async exec(input: RunESLintWorkerTaskInput): Promise<ESLint.LintResult[]> {
        const eslint: ESLint = createESLint(input.engineConfig, input.eslintContext.baseDirectory, new Set(input.rulesToRun));
        return await eslint.lintFiles(input.eslintContext.filesToScan);
    }
}
