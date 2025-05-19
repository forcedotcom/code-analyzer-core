import {ESLintRuleStatus} from "./enums";
import {ESLint, Linter, Rule} from "eslint";
import {AsyncFilterFnc, ESLintWorkspace, UserConfigInfo} from "./workspace";
import path from "node:path";
import {BaseRuleset, LegacyBaseConfigFactory} from "./base-config";
import {ESLint8EngineConfig} from "./config";
import {LogLevel} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {Worker} from "node:worker_threads";

export interface ESLintStrategy {
    calculateRuleStatuses(): Promise<Map<string, ESLintRuleStatus>>
    calculateRulesMetadata(): Promise<Map<string, Rule.RuleMetaData>>
    run(ruleNames: string[]): Promise<ESLint.LintResult[]>
}

export type EmitLogEventFcn = (logLevel: LogLevel, msg: string) => void;

export class LegacyESLintStrategy implements ESLintStrategy {
    private readonly workspace: ESLintWorkspace;
    private readonly baseConfigFactory: LegacyBaseConfigFactory;
    private readonly config: ESLint8EngineConfig;
    private readonly emitLogEvent: EmitLogEventFcn;

    private ruleStatuses?: Map<string, ESLintRuleStatus>;

    constructor(workspace: ESLintWorkspace, config: ESLint8EngineConfig, emitLogEvent: EmitLogEventFcn) {
        this.workspace = workspace;
        this.config = config;
        this.baseConfigFactory = new LegacyBaseConfigFactory(config);
        this.emitLogEvent = emitLogEvent;
    }

    /**
     * Calculates the metadata for all available rules
     */
    async calculateRulesMetadata(): Promise<Map<string, Rule.RuleMetaData>> {
        const eslintOptions: ESLint.Options = this.createESLintOptions(BaseRuleset.ALL);
        this.emitLogEvent(LogLevel.Fine, `Calculating metadata for rules with ESLint options: ${JSON.stringify(eslintOptions)}`);
        const ruleModulesMap: Map<string, Rule.RuleModule> = await getAllRuleModules(new LegacyESLintWrapper(eslintOptions));
        const rulesMetadata: Map<string, Rule.RuleMetaData> = new Map();
        for (const [ruleName, ruleModule] of ruleModulesMap) {
            if (ruleModule.meta && !ruleModule.meta.deprecated) { // do not add deprecated rules or rules without metadata
                rulesMetadata.set(ruleName, ruleModule.meta);
            }
        }
        return rulesMetadata;
    }

    /**
     * Calculates the status of all available rules
     *
     * To get the user selected status ("error", "warn", or "off") of every single rule, we have to ask ESLint to
     * calculate the configuration (which contains the rule status) for every file that will be scanned. This is
     * because users can add to their config that they only want certain rules to run for a particular file deep in
     * their project. This is why ESLint only offers a calculateConfigForFile(filePath) method and not a direct
     * getConfig() method. See https://eslint.org/docs/v8.x/integrate/nodejs-api#-eslintcalculateconfigforfilefilepath
     */
    async calculateRuleStatuses(): Promise<Map<string, ESLintRuleStatus>> {
        if (this.ruleStatuses) {
            return this.ruleStatuses;
        }

        const userConfigInfo: UserConfigInfo = this.workspace.getUserConfigInfo();
        this.emitInfoMessageIfDiscoveredEslintConfigFileIsNotBeingUsed(userConfigInfo);
        this.emitInfoMessageIfDiscoveredEslintIgnoreFileIsNotBeingUsed(userConfigInfo);

        const eslintOptions: ESLint.Options = this.createESLintOptions(BaseRuleset.RECOMMENDED);
        const eslint: ESLint = new LegacyESLintWrapper(eslintOptions);
        const filterFcn: AsyncFilterFnc<string> = createFilterFcn(eslint);

        const candidateFiles: string[] = userConfigInfo.userConfigIsEnabled() ?
            await this.workspace.getCandidateFilesForUserConfig(filterFcn) :
            await this.workspace.getCandidateFilesForBaseConfig(filterFcn);

        this.emitLogEvent(LogLevel.Fine, `Calculating rule statuses using files: ${JSON.stringify(candidateFiles)}`);
        this.emitLogEvent(LogLevel.Fine, `Calculating rule statuses with ESLint options: ${JSON.stringify(eslintOptions)}`);
        this.ruleStatuses = await this.calculateRuleStatusesFor(candidateFiles, eslint);

        // Since we have no easy way of turning on a rule that has been explicitly turned off in the config
        // (because we don't know its rule options or parser configuration), we remove these turned off
        // rules entirely so that they can't be selected.
        for (const [ruleName, ruleStatus] of this.ruleStatuses) {
            if (ruleStatus === ESLintRuleStatus.OFF) {
                this.ruleStatuses.delete(ruleName);
            }
        }

        // The ruleStatuses so far only include the rules that are explicitly listed in the recommended base configs
        // and the users config files. We manually add in the other base rules that are not recommended so that they can
        // be selectable even though they are off by default. Note that we do not want to add in any additional rules
        // from users plugins that aren't explicitly configured since we have no easy way of turning them on for the
        // user (since we don't know if their rules require special options), thus we only add in the missing base rules.
        for (const ruleName of await this.getAllBaseRuleNames(filterFcn)) {
            if (!this.ruleStatuses.has(ruleName)) {
                this.ruleStatuses.set(ruleName, ESLintRuleStatus.OFF);
            }
        }

        return this.ruleStatuses;
    }

    /**
     * Runs the rules against the workspace
     *
     * Note that the strategy is to start with all the rules and then apply an override config object which disables
     * any rules that are not specified to run. This strategy is practically the only one that works since turning rules
     * off does not require any knowledge of the parser or rule parameters (whereas turning rules on does).
     * @param ruleNames The list of rules to run.
     */
    async run(ruleNames: string[]): Promise<ESLint.LintResult[]> {
        const overrideConfig: Linter.LegacyConfig = await this.createConfigThatTurnsOffUnselectedRules(ruleNames);
        const eslintOptions: ESLint.Options = this.createESLintOptions(BaseRuleset.ALL, overrideConfig);
        const eslint: ESLint = new LegacyESLintWrapper(eslintOptions);
        const filterFcn: AsyncFilterFnc<string> = createFilterFcn(eslint);

        const filesToScan: string[] = await this.workspace.getFilesToScan(filterFcn);

        this.emitLogEvent(LogLevel.Fine, `Running the ESLint.lintFiles method on files: ${JSON.stringify(filesToScan)}`);
        this.emitLogEvent(LogLevel.Fine, `Running the ESLint.lintFiles method with ESLint options: ${JSON.stringify(eslintOptions)}`);

        const worker: Worker = new Worker(path.resolve(__dirname,'..', 'worker-scripts', 'run-eslint.mjs'), {
            workerData: {
                filesToScan: filesToScan,
                eslintOptions: eslintOptions
            }
        });
        return new Promise((resolve, reject) => {
            worker.on('message', resolve);
            /* istanbul ignore next */
            worker.on('error', (err: Error) => reject(wrapESLintError(err, 'ESLint.lintFiles', eslintOptions)));
            /* istanbul ignore next */
            worker.on('exit', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Worker exited with code ${code}`))
                }
            });
        });
    }

    private async createConfigThatTurnsOffUnselectedRules(ruleNames: string[]) : Promise<Linter.LegacyConfig> {
        const setOfRulesThatShouldBeOn: Set<string> = new Set(ruleNames);
        const allRuleNames: string[] = Array.from((await this.calculateRuleStatuses()).keys());
        const rulesRecord: Linter.RulesRecord = {};
        for (const ruleName of allRuleNames) {
            if (!setOfRulesThatShouldBeOn.has(ruleName)) {
                rulesRecord[ruleName] = 'off';
            }
        }
        return { rules: rulesRecord };
    }

    private async calculateRuleStatusesFor(files: string[], eslint: ESLint): Promise<Map<string, ESLintRuleStatus>> {
        const configs: Linter.Config[] = await Promise.all(files.map(f => eslint.calculateConfigForFile(f) as Linter.Config));
        const ruleStatuses: Map<string, ESLintRuleStatus> = new Map();
        for (const config of configs) {
            /* istanbul ignore next */
            if (!config.rules) {
                continue;
            }
            const rulesRecord: Linter.RulesRecord = config.rules as Linter.RulesRecord;
            for (const ruleName of Object.keys(rulesRecord)) {
                const newStatus: ESLintRuleStatus = getRuleStatusFromRuleEntry(rulesRecord[ruleName]);
                const existingStatus: ESLintRuleStatus | undefined = ruleStatuses.get(ruleName);
                if (!existingStatus || existingStatus < newStatus) {
                    ruleStatuses.set(ruleName, newStatus);
                }
            }
        }
        return ruleStatuses;
    }

    private createESLintOptions(baseRuleset: BaseRuleset, overrideConfig?: Linter.LegacyConfig): ESLint.Options {
        const userConfigInfo: UserConfigInfo = this.workspace.getUserConfigInfo();
        return {
            cwd: this.getBaseDirForOptions(),
            errorOnUnmatchedPattern: false,
            reportUnusedDisableDirectives: 'off',
            baseConfig: this.baseConfigFactory.createBaseConfig(baseRuleset) as Linter.Config,   // This is applied first (on bottom).
            useEslintrc: this.config.auto_discover_eslint_config,                                // This is applied second.
            overrideConfigFile: userConfigInfo.getUserConfigFile(),                              // This is applied third.
            overrideConfig: overrideConfig as Linter.Config,                                     // This is applied fourth (on top).
            ignorePath: userConfigInfo.getUserIgnoreFile()
        } as ESLint.Options;
    }

    private async getAllBaseRuleNames(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        const candidateFiles: string[] = await this.workspace.getCandidateFilesForBaseConfig(filterFcn);
        const eslintForBaseRuleNameDiscovery: ESLint = new LegacyESLintWrapper({
            cwd: this.getBaseDirForOptions(),
            baseConfig: this.baseConfigFactory.createBaseConfig(BaseRuleset.ALL),
            useEslintrc: false
        } as ESLint.Options);
        const allBaseRuleStatuses: Map<string, ESLintRuleStatus> =
            await this.calculateRuleStatusesFor(candidateFiles, eslintForBaseRuleNameDiscovery);
        const baseRulesThatAreOn: string[] = [];
        for (const [ruleName, status] of allBaseRuleStatuses) {
            if (status !== ESLintRuleStatus.OFF) {
                baseRulesThatAreOn.push(ruleName);
            }
        }
        return baseRulesThatAreOn;
    }

    private emitInfoMessageIfDiscoveredEslintConfigFileIsNotBeingUsed(userConfigInfo: UserConfigInfo): void {
        const configFileFound: string | undefined = userConfigInfo.getAutoDiscoveredConfigFile();
        if (this.config.eslint_config_file === undefined && !this.config.auto_discover_eslint_config && configFileFound) {
            this.emitLogEvent(LogLevel.Info, getMessage('UnusedEslintConfigFile',
                makeRelativeTo(process.cwd(), configFileFound),
                makeRelativeTo(this.config.config_root, configFileFound)));
        }
    }

    private emitInfoMessageIfDiscoveredEslintIgnoreFileIsNotBeingUsed(userConfigInfo: UserConfigInfo): void {
        const ignoreFileFound: string | undefined = userConfigInfo.getAutoDiscoveredIgnoreFile();
        if (this.config.eslint_ignore_file === undefined && !this.config.auto_discover_eslint_config && ignoreFileFound) {
            this.emitLogEvent(LogLevel.Info, getMessage('UnusedEslintIgnoreFile',
                makeRelativeTo(process.cwd(), ignoreFileFound),
                makeRelativeTo(this.config.config_root, ignoreFileFound)));
        }
    }

    private getBaseDirForOptions(): string {
        // With ESLint 8 (legacy config) there is no winning here. If we use any of our own base configs then we
        // need to set the base dir as __dirname so that our base plugins are discoverable. But doing so makes it so
        // that although user's plugins are discoverable, the "files" in an overrides section is based on the wrong
        // base path. So if users have issues with their custom config, then we can at least tell them to turn off
        // all of our base configs so that it switches back to using cwd() as the base directory (default of eslint).
        // This is the best we can do. In most cases, as long as users don't use "overrides" then we can still give them
        // decent merge abilities with our base config and their custom config. Note that this will be resolved with
        // ESLint 9's flat config because the plugins aren't discovered... they are loaded ahead of time.
        // See https://github.com/forcedotcom/code-analyzer/issues/1807
        return this.usingAnyBaseConfig() ? __dirname : process.cwd();
    }

    private usingAnyBaseConfig(): boolean {
        return !(this.config.disable_javascript_base_config &&
            this.config.disable_lwc_base_config &&
            this.config.disable_typescript_base_config);
    }
}

function makeRelativeTo(absFolderPath: string, absFilePath: string): string {
    absFolderPath = absFolderPath.endsWith(path.sep) ?
        /* istanbul ignore next */ absFolderPath : absFolderPath + path.sep;
    return absFilePath.startsWith(absFolderPath) ?
        absFilePath.slice(absFolderPath.length) : /* istanbul ignore next */  absFilePath;
}

async function getAllRuleModules(legacyESLint: ESLint): Promise<Map<string, Rule.RuleModule>> {
    // See https://github.com/eslint/eslint/discussions/18546 to see how we arrived at this implementation.
    const legacyESLintModule: string = path.resolve(path.dirname(require.resolve('eslint')),'eslint','eslint.js')
        .replaceAll('\\', '/');
    const {getESLintPrivateMembers} = await import(`file://${legacyESLintModule}`);
    return getESLintPrivateMembers(legacyESLint).cliEngine.getRules();
}

function getRuleStatusFromRuleEntry(ruleEntry: Linter.RuleEntry): ESLintRuleStatus {
    if (typeof ruleEntry === "number") {
        return ruleEntry === 2 ? ESLintRuleStatus.ERROR :
            ruleEntry === 1 ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    } else if (typeof ruleEntry === "string") {
        return ruleEntry.toLowerCase() === "error" ? ESLintRuleStatus.ERROR :
            ruleEntry.toLowerCase() === "warn" ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    }

    // Rules are typically defined with an array of options where the first option is the severity status of the rule.
    // So this is actually the default case:
    return getRuleStatusFromRuleEntry(ruleEntry[0]);
}

function createFilterFcn(eslint: ESLint): AsyncFilterFnc<string> {
    return async (file: string) => !(await eslint.isPathIgnored(file));
}

/**
 * Wrapper around the ESLint class to help throw more useful error messages.
 */
class LegacyESLintWrapper extends ESLint {
    private readonly options: ESLint.Options;

    constructor(options: ESLint.Options) {
        try {
            super(options);
            this.options = options;
        } catch (error) {
            throw wrapESLintError(error, 'ESLint', options);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    override async calculateConfigForFile(filePath: string): Promise<any> {
        try {
            return await super.calculateConfigForFile(filePath);
        } catch (error) {
            throw wrapESLintError(error, `ESLint.calculateConfigForFile(${filePath})`, this.options);
        }

    }

    override async isPathIgnored(filePath: string): Promise<boolean> {
        try {
            return await super.isPathIgnored(filePath);
        } catch (error) { /* istanbul ignore next */
            throw wrapESLintError(error, `ESLint.isPathIgnored(${filePath})`, this.options);
        }
    }
}

function wrapESLintError(rawError: unknown, fcnCallStr: string, options: ESLint.Options): Error {
    const rawErrMsg: string = rawError instanceof Error ? rawError.message : /* istanbul ignore next */
        String(rawError);
    const wrappedErrMsg: string = rawErrMsg.includes('conflict') ?
        getMessage('ESLintThrewExceptionWithPluginConflictMessage', fcnCallStr, rawErrMsg, JSON.stringify(options,null,2))
        : getMessage('ESLintThrewExceptionWithUnknownMessage', fcnCallStr, rawErrMsg, JSON.stringify(options,null,2));
    return new Error(wrappedErrMsg, {cause: rawError});
}
