import {
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
} from "@salesforce/code-analyzer-engine-api";
import * as fsp from "node:fs/promises";
import path from "path";
import { getMessage } from "./messages";
import stylelint, { RuleMeta } from "stylelint";
import { RULE_MAPPINGS } from "./rule-mappings";
import { StylelintRuleStatus } from "./enums";

export class StylelintEngine extends Engine {
    static readonly NAME = "stylelint";

    // *** Consider passing in a configuration object from your engine's plugin if you want to provide user-configuration
    constructor() {
        super();
    }

    getName(): string {
        return StylelintEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(
            __dirname,
            "..",
            "package.json"
        );
        const packageJson: { version: string } = JSON.parse(
            await fsp.readFile(pathToPackageJson, "utf-8")
        );
        return packageJson.version;
    }

    // *** Remove underscore for private naming convention if you need any of the DescribeOptions
    async describeRules(
        _describeOptions: DescribeOptions
    ): Promise<RuleDescription[]> {
        // *** Best Practice - Use RunRulesProgressEvents to keep users informed on the scan progress
        this.emitRunRulesProgressEvent(0);

        // *** Parse out relevant file types if you engine is language-specific
        //const relevantFiles: string[] | undefined;

        const ruleDescriptions: RuleDescription[] = [];
        // Get all available rules from stylelint
        const allRules = stylelint.rules;

        this.emitRunRulesProgressEvent(50);

        for (const [ruleName] of Object.entries(allRules)) {
            const rule = await allRules[ruleName as keyof typeof allRules];
            const ruleMetadata: RuleMeta | undefined = rule.meta;
            if (ruleMetadata) {
                // do not include rules that don't have metadata

                ruleDescriptions.push(
                    toRuleDescription(ruleName, ruleMetadata)
                ); //no rules are turned on by default.
            }
        }

        // *** Best Practice - Set RunRulesProgressEvents to 100 before completing
        this.emitDescribeRulesProgressEvent(100);

        return ruleDescriptions.sort((d1, d2) =>
            d1.name.localeCompare(d2.name)
        );
    }

    // *** ruleNames comes from a describeRules call made just before running
    async runRules(
        _ruleNames: string[],
        _runOptions: RunOptions
    ): Promise<EngineRunResults> {
        // *** Best Practice - Use RunRulesProgressEvents to keep users informed on the scan progress
        this.emitRunRulesProgressEvent(2);

        // *** Get your violations!
        const violations: Violation[] = [];

        // *** Rule Implementation - map any violations to Violations and CodeLocations
        // *** If Violations do not have CodeLocations they will be shown in modal form

        // *** Best Practice - Use messages sparingly to keep users informed
        // *** Ideal for failures, or an announcement
        const one = "1";
        this.emitLogEvent(
            LogLevel.Debug,
            getMessage("TemplateMessage2", one, "2")
        );

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations,
        };
    }
}

function toRuleDescription(
    ruleName: string,
    metadata: RuleMeta
): RuleDescription {
    let severityLevel: SeverityLevel;
    let tags: string[];
    let status: StylelintRuleStatus = StylelintRuleStatus.NULL;

    if (ruleName in RULE_MAPPINGS) {
        status = RULE_MAPPINGS[ruleName].status ?? status;
        severityLevel = status
            ? toSeverityLevel(status)
            : RULE_MAPPINGS[ruleName].severity;
        tags = RULE_MAPPINGS[ruleName].tags;
    } else {
        // Any rule we don't know about from our RULE_MAPPINGS must be a custom rule. Unit tests prevent otherwise.
        severityLevel = toSeverityLevel(status);
        tags = [...toTags(status), COMMON_TAGS.CUSTOM];
    }
    const ruleUrl: string | undefined = metadata.url;

    return {
        name: ruleName,
        severityLevel: severityLevel,
        tags: tags,
        description: ruleName, //stylelint meta doesn't have a description. It can be passed only when we have a config.
        resourceUrls: ruleUrl ? [ruleUrl] : [],
    };
}

export function toSeverityLevel(
    status: StylelintRuleStatus | undefined
): SeverityLevel {
    if (status === StylelintRuleStatus.WARN) {
        // An Stylelint "warn" status is what users typically use to inform them of things without labeling it as a
        // violation to stop their build over. Our Info level severity is the closest to this.
        return SeverityLevel.Info;
    } else if (status === StylelintRuleStatus.ERROR) {
        // The "error" status is typically something users care most about, so we mark these as High severity.
        return SeverityLevel.High;
    } else if (status === StylelintRuleStatus.NULL) {
        // The "null" status are for marking the rules 'off', so we mark these as Low severity.
        return SeverityLevel.Low;
    }
    // All else will give assigned High. Recall that users may override these severities if they wish. All rules are default to error severity: https://stylelint.io/user-guide/configure#severity
    return SeverityLevel.High;
}

export function toTags(status: StylelintRuleStatus | undefined): string[] {
    const tags: string[] = [];
    if (
        status === StylelintRuleStatus.ERROR ||
        status === StylelintRuleStatus.WARN
    ) {
        // Any rule that base config or the user's config has turned on, should be marked as 'Recommended'
        // so that code analyzer will run these rules by default just as stylelint runs these rules.

        tags.push(COMMON_TAGS.RECOMMENDED);
    }
    return tags;
}
