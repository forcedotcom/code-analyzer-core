import {ESLintWorkspace} from "./workspace";
import {ESLint, Linter} from "eslint";
import {builtinRules} from "eslint/use-at-your-own-risk";
import {ESLintEngineConfig} from "./config";
import {RulesMeta} from "@eslint/core";
import {ESLintOptionsFactory, ESLintWrapper} from "./eslint-wrapper";
import {EngineEventEmitter, EventType} from "@salesforce/code-analyzer-engine-api";

export enum ESLintRuleStatus {
    ERROR = 2,
    WARN = 1,
    OFF = 0
}

export type ESLintContext = {
    baseDirectory: string,
    userConfigFile?: string,
    filesToScan: string[],
    ruleInfo: {
        [ruleName: string]: {
            status: ESLintRuleStatus,
            meta?: RulesMeta
        }
    }
}

export class ESLintContextFactory extends EngineEventEmitter {
    private readonly eslintOptionsFactory: ESLintOptionsFactory;
    constructor() {
        super();
        this.eslintOptionsFactory = new ESLintOptionsFactory();
        for (const eventType of Object.values(EventType)) { // Forward events from composed classes
            this.eslintOptionsFactory.onEvent(eventType, this.emitEvent.bind(this));
        }
    }

    async calculateESLintContext(engineConfig: ESLintEngineConfig, eslintWorkspace: ESLintWorkspace,
                                 userConfigFile: string | undefined, emitProgress: (perc:number)=>void): Promise<ESLintContext> {
        const baseDirectory: string = await eslintWorkspace.getBaseDirectory();
        const eslintOptions: ESLint.Options = await this.eslintOptionsFactory.createESLintOptions(engineConfig, baseDirectory, userConfigFile);
        const eslint: ESLint = new ESLintWrapper(eslintOptions);
        emitProgress(5);

        const context: ESLintContext = {
            baseDirectory: baseDirectory,
            userConfigFile: userConfigFile,
            filesToScan: await eslintWorkspace.getFilesToScan(eslint),
            ruleInfo: {}
        }
        emitProgress(10);

        // Calculate configs for files
        let numFilesProcessed: number = 0;
        const numFilesToScan: number = context.filesToScan.length;
        const calculatedConfigs: Linter.Config[] = await Promise.all(context.filesToScan.map(async (f) => {
            const config = await eslint.calculateConfigForFile(f) as Linter.Config;
            emitProgress(10 + 75*(++numFilesProcessed / numFilesToScan)); // 10% to 85%
            return config;
        }));

        // Calculate rule statuses
        for (const calculatedConfig of calculatedConfigs) {
            const rulesRecord: Partial<Linter.RulesRecord> = calculatedConfig?.rules ?? {};
            for (const [ruleName, ruleEntry] of Object.entries(rulesRecord)) {
                /* istanbul ignore if */
                if (!ruleEntry) {
                    continue;
                }
                const newStatus: ESLintRuleStatus = getRuleStatusFromRuleEntry(ruleEntry);
                const existingStatus: ESLintRuleStatus | undefined = context.ruleInfo[ruleName]?.status;
                if (existingStatus === undefined || existingStatus < newStatus) {
                    context.ruleInfo[ruleName] = {
                        status: newStatus
                    };
                }
            }
        }
        emitProgress(90);

        // Walk through all configs, looking for plugins so that we can pull all the relevant rules from the plugins
        for (const calculatedConfig of calculatedConfigs) {
            for (const [pluginName, pluginConfig] of Object.entries(calculatedConfig?.plugins ?? /* istanbul ignore next */ {})) {
                for (const [shortRuleName, ruleDefinition] of Object.entries(pluginConfig.rules ?? /* istanbul ignore next */ {})) {
                    const ruleName: string = pluginName + '/' + shortRuleName;
                    if (ruleName in context.ruleInfo) {
                        context.ruleInfo[ruleName].meta = ruleDefinition.meta;
                    }
                }
            }
        }
        emitProgress(95);

        // Until ESLint 9 has moved the bundled rules into its own plugin, then we must use this to get the metadata
        // for the built-in rules.
        for (const [ruleName, ruleDefinition] of builtinRules) {
            if (ruleName in context.ruleInfo) {
                context.ruleInfo[ruleName].meta = ruleDefinition.meta;
            }
        }

        emitProgress(100);
        return context;
    }
}

function getRuleStatusFromRuleEntry(ruleEntry: Linter.RuleEntry): ESLintRuleStatus {
    if (typeof ruleEntry === "number") {
        return ruleEntry === 2 ? ESLintRuleStatus.ERROR :
            ruleEntry === 1 ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    } else /* istanbul ignore if */ if (typeof ruleEntry === "string") {
        // I believe ESLint 9 normalizes the ruleEntry to always be numbers when we invoke calculateConfigForFile
        // but just in case things change, we should keep this branch of code that handles the string case for safety.
        return ruleEntry.toLowerCase() === "error" ? ESLintRuleStatus.ERROR :
            ruleEntry.toLowerCase() === "warn" ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    }

    // Rules are typically defined with an array of options where the first option is the severity status of the rule.
    // So this is actually the default case:
    return getRuleStatusFromRuleEntry(ruleEntry[0]);
}
