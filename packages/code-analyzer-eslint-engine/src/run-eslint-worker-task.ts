import * as path from "node:path";
import {WorkerTask} from "./worker-task";
import {ESLint} from "eslint";
import {ESLintEngineConfig} from "./config";
import {ESLintContext} from "./eslint-context";
import {ESLintFactory} from "./eslint-wrapper";
import {EventType} from "@salesforce/code-analyzer-engine-api";

export type RunESLintWorkerTaskInput = {
    rulesToRun: string[]
    engineConfig: ESLintEngineConfig,
    eslintContext: ESLintContext
}

export class RunESLintWorkerTask extends WorkerTask<RunESLintWorkerTaskInput, ESLint.LintResult[]> {
    static readonly COMPILED_JS_FILE_PATH: string = path.resolve(__dirname, '..', 'dist', 'run-eslint-worker-task.js');
    private readonly eslintFactory: ESLintFactory;

    constructor() { // Zero input argument constructor is required since this is called from the generated worker script file.
        super(RunESLintWorkerTask.COMPILED_JS_FILE_PATH, 'RunESLintWorkerTask');
        this.eslintFactory = new ESLintFactory();
        for (const eventType of Object.values(EventType)) { // Forward events from composed class
            this.eslintFactory.onEvent(eventType, this.emitEvent.bind(this));
        }
    }

    protected async exec(input: RunESLintWorkerTaskInput): Promise<ESLint.LintResult[]> {
        const eslint: ESLint = await this.eslintFactory.createESLint(
            input.engineConfig, input.eslintContext.baseDirectory, input.eslintContext.userConfigFile, new Set(input.rulesToRun));
        return await eslint.lintFiles(input.eslintContext.filesToScan);
    }
}
