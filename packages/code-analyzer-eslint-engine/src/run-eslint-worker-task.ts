import * as path from "node:path";
import {WorkerTask} from "./worker-task";
import {ESLint, Linter, Rule} from "eslint";
import {ESLintEngineConfig} from "./config";
import {ESLintContext} from "./eslint-context";
import {ESLintOptionsFactory, ESLintWrapper} from "./eslint-wrapper";
import {EventType} from "@salesforce/code-analyzer-engine-api";

export type RunESLintWorkerTaskInput = {
    rulesToRun: string[]
    engineConfig: ESLintEngineConfig,
    eslintContext: ESLintContext,
    progressRange: [number, number],
    includeFixes?: boolean,
    includeSuggestions?: boolean
}

export class RunESLintWorkerTask extends WorkerTask<RunESLintWorkerTaskInput, ESLint.LintResult[]> {
    static readonly COMPILED_JS_FILE_PATH: string = path.resolve(__dirname, '..', 'dist', 'run-eslint-worker-task.js');
    private readonly eslintOptionsFactory: ESLintOptionsFactory;

    constructor() { // Zero input argument constructor is required since this is called from the generated worker script file.
        super(RunESLintWorkerTask.COMPILED_JS_FILE_PATH, 'RunESLintWorkerTask');
        this.eslintOptionsFactory = new ESLintOptionsFactory();
        for (const eventType of Object.values(EventType)) { // Forward events from composed class
            this.eslintOptionsFactory.onEvent(eventType, this.emitEvent.bind(this));
        }
    }

    protected async exec(input: RunESLintWorkerTaskInput): Promise<ESLint.LintResult[]> {
        const rulesToRunSet: Set<string> = new Set(input.rulesToRun);

        const eslintOptions: ESLint.Options = await this.eslintOptionsFactory.createESLintOptions(
            input.engineConfig, input.eslintContext.baseDirectory, input.eslintContext.userConfigFile);

        // Add in a custom plugin that does not do anything other than monitor the progress of the files being scanned
        const numFilesToScan: number = input.eslintContext.filesToScan.length;
        const progressRuleName: string = this.addProgressPlugin(eslintOptions, numFilesToScan, input.progressRange);

        // Using a ruleFilter ensures that we only run the rules that the user has selected. This approach is much
        // cleaner than adding in another overrideConfig that turns off rules and saves us on some post-processing.
        eslintOptions.ruleFilter = (arg: {ruleId: string}) =>
            arg.ruleId === progressRuleName || rulesToRunSet.has(arg.ruleId);

        const eslint: ESLint = new ESLintWrapper(eslintOptions);
        return await eslint.lintFiles(input.eslintContext.filesToScan);
    }

    private addProgressPlugin(eslintOptions: ESLint.Options, numFilesToScan: number, progressRange: [number, number]): string {
        const pluginRef: string = 'engineProgressPlugin';
        const shortRuleName: string = 'emitProgressRule';
        const fullRuleName: string = `${pluginRef}/${shortRuleName}`;

        let numFilesThatHaveBeenScanned: number = 0;
        const fileScannedCallback = () => {
            const ratioComplete: number = ++numFilesThatHaveBeenScanned/numFilesToScan;
            this.emitRunRulesProgressEvent(progressRange[0] + (progressRange[1]-progressRange[0])*(ratioComplete));
        }
        const progressPlugin: ESLint.Plugin = {
            rules: {
                [shortRuleName]: {
                    create(_context: Rule.RuleContext) {
                        // Using a callback since the "this" pointer would be different if we tried using it directly here
                        fileScannedCallback();
                        return {}; // No-op
                    }
                }
            }
        }

        // Add in configuration to existing overrideConfig
        const usersConfigArray: Linter.Config[] = Array.isArray(eslintOptions.overrideConfig) ? eslintOptions.overrideConfig :
            (eslintOptions.overrideConfig ? /* istanbul ignore next */ [eslintOptions.overrideConfig] : []);
        eslintOptions.overrideConfig = [
            ... usersConfigArray,
            {
                plugins: {
                    [pluginRef]: progressPlugin
                },
                rules: {
                    [fullRuleName]: ['error']
                }
            }
        ];

        return fullRuleName;
    }
}
