import {ESLintRuleStatus} from "./enums";
import {ESLint, Linter, Rule} from "eslint";
import {ESLintWorkspace} from "./workspace";
import path from "node:path";
import {createJavascriptPlusLwcBaseConfig, createTypescriptBaseConfig} from "./base-config";

export interface ESLintStrategy {
    calculateRuleStatuses(): Promise<Map<string, ESLintRuleStatus>>

    calculateRulesMetadata(): Promise<Map<string, Rule.RuleMetaData>>
}

export class LegacyESLintStrategy implements ESLintStrategy {
    private readonly workspace: ESLintWorkspace;
    private ruleStatuses?: Map<string, ESLintRuleStatus>;

    constructor(workspace: ESLintWorkspace) {
        this.workspace = workspace;
    }

    async calculateRulesMetadata(): Promise<Map<string, Rule.RuleMetaData>> {
        const ruleModulesMap: Map<string, Rule.RuleModule> = await getAllRuleModules(this.createLegacyESLint('all', true));
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

        const candidateFiles: string[] = [...await this.workspace.getJavascriptFiles(),
            ...await this.workspace.getTypescriptFiles()];
        this.ruleStatuses = await this.calculateRuleStatusesFor(candidateFiles,
            this.createLegacyESLint('recommended', true));

        // The ruleStatuses so far only include the rules that are explicitly listed in the recommended base configs
        // and the users config files. We manually add in the other base rules that are not recommended so that they can
        // be selectable even though they are off by default. Note that we do not want to add in any additional rules
        // from users plugins that aren't explicitly configured since we have no easy way of turning them on for the
        // user (since we don't know if their rules require special options), thus we only add in the missing base rules.
        for (const ruleName of await this.getAllBaseRuleNames()) {
            if (!this.ruleStatuses.has(ruleName)) {
                this.ruleStatuses.set(ruleName, ESLintRuleStatus.OFF);
            }
        }

        return this.ruleStatuses;
    }

    private async calculateRuleStatusesFor(files: string[], legacyESLint: ESLint): Promise<Map<string, ESLintRuleStatus>> {
        const configs: Linter.Config[] = await Promise.all(files.map(f => legacyESLint.calculateConfigForFile(f) as Linter.Config));
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

    private createLegacyESLint(allOrRecommended: string, applyUserConfig: boolean, overrideConfig?: Linter.Config): ESLint {
        const options: ESLint.Options = {
            cwd: __dirname, // This is needed to make the base plugins discoverable. Don't worry, user's plugins are also still discovered.
            errorOnUnmatchedPattern: false,
            baseConfig: this.createLegacyBaseConfig(allOrRecommended), // This is applied first (on bottom).
            useEslintrc: applyUserConfig, // This is applied second. TODO: Allow users to turn this off via engine config
            overrideConfigFile: applyUserConfig ? this.workspace.getLegacyConfigFile() : undefined, // This is applied third.
            overrideConfig: overrideConfig // This is applied fourth (on top).
        };
        return new ESLint(options);
    }

    private createLegacyBaseConfig(allOrRecommended: string): Linter.Config {
        const overrides: Linter.ConfigOverride[] = [];
        overrides.push(createJavascriptPlusLwcBaseConfig(allOrRecommended));
        overrides.push(createTypescriptBaseConfig(allOrRecommended));
        return {
            globals: {
                "$A": "readonly",  // Mark as known global for Aura: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/ref_jsapi_dollarA.htm
            },
            overrides: overrides
        };
    }

    private async getAllBaseRuleNames(): Promise<string[]> {
        const candidateFiles: string[] = await this.workspace.getCandidateFilesForBaseConfig();
        return Array.from(
            (await this.calculateRuleStatusesFor(candidateFiles, this.createLegacyESLint('all', false))).keys()
        );
    }
}

async function getAllRuleModules(legacyESLint: ESLint): Promise<Map<string, Rule.RuleModule>> {
    // See https://github.com/eslint/eslint/discussions/18546 to see how we arrived at this implementation.
    const legacyESLintModule: string = path.resolve(path.dirname(require.resolve('eslint')),'eslint','eslint.js');
    const {getESLintPrivateMembers} = await import(legacyESLintModule);
    return getESLintPrivateMembers(legacyESLint).cliEngine.getRules();
}

function getRuleStatusFromRuleEntry(ruleEntry: Linter.RuleEntry): ESLintRuleStatus {
    if (typeof ruleEntry === "number") {
        return ruleEntry === 2 ? ESLintRuleStatus.ERROR : ruleEntry === 1 ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    } else if (typeof ruleEntry === "string") {
        return ruleEntry === "error" ? ESLintRuleStatus.ERROR : ruleEntry === "warn" ? ESLintRuleStatus.WARN : ESLintRuleStatus.OFF;
    }
    return getRuleStatusFromRuleEntry(ruleEntry[0]);
}