import * as engApi from "@salesforce/code-analyzer-engine-api";
import { getMessage } from "./messages";
import { Selector } from "./selectors";
import { OutputFormat, RuleSelectionFormatter } from "./output-format";

/**
 * Enum of rule severity levels
 */
export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

/**
 * Describes a specific rule from an engine
 */
export interface Rule {
    /** Returns the name of the rule */
    getName(): string

    /** Returns the name of the engine from which the rule comes from */
    getEngineName(): string

    /** Returns the {@link SeverityLevel} associated with the rule */
    getSeverityLevel(): SeverityLevel

    /** Returns an array of tags associated with the rule that can be used in rule selection */
    getTags(): string[]

    /** Returns a string describing what the rule does */
    getDescription(): string

    /** Returns an array of urls associated with resources to learn more about the rule */
    getResourceUrls(): string[]
}

/**
 * Class associated with a specific selection of rules
 */
export interface RuleSelection {
    /** Returns the number of rules selected */
    getCount(): number

    /** Returns the names of the engines that have at least one rule selected */
    getEngineNames(): string[]

    /**
     * Returns an array {@link Rule} instances associated with the rules that have been selected for the specified engine
     * @param engineName the name of the engine to return selected rules for
     */
    getRulesFor(engineName: string): Rule[]

    /**
     * Returns a specific {@link Rule} from a rule selection based on its engine and name.
     * @param engineName the name of the engine associated with the selected rule
     * @param ruleName the name of the selected rule that you wish to return
     */
    getRule(engineName: string, ruleName: string): Rule

    /**
    * Returns a formatted string of the rules using the specified {@link OutputFormat}
    * @param format {@link OutputFormat} to format the rules to
    */
    toFormattedOutput(format: OutputFormat): string
}


/******* IMPLEMENTATIONS: *************************************************************************/

export class RuleImpl implements Rule {
    private readonly engineName: string
    private readonly ruleDesc: engApi.RuleDescription;

    constructor(engineName: string, ruleDesc: engApi.RuleDescription) {
        this.engineName = engineName;
        this.ruleDesc = ruleDesc;
    }

    getDescription(): string {
        return this.ruleDesc.description;
    }

    getEngineName(): string {
        return this.engineName;
    }

    getName(): string {
        return this.ruleDesc.name;
    }

    getResourceUrls(): string[] {
        return this.ruleDesc.resourceUrls;
    }

    getSeverityLevel(): SeverityLevel {
        // Currently the engApi.SeverityLevel has the same enum values as core's SeverityLevel.
        // If this ever changes, then we'll need to update this method mapping one to the other.
        return this.ruleDesc.severityLevel as SeverityLevel;
    }

    getTags(): string[] {
        return this.ruleDesc.tags;
    }

    matchesRuleSelector(ruleSelector: Selector): boolean {
        const sevNumber: number = this.getSeverityLevel().valueOf();
        const sevName: string = SeverityLevel[sevNumber];
        const tags: string[] = this.getTags().map(t => t.toLowerCase());
        const isDevPreviewApexGuru: boolean = tags.includes('devpreviewapexguru');
        let selectables: string[];
        if (isDevPreviewApexGuru) {
            // DevPreviewApexGuru rules are opt-in: only selectable by engine name, rule name, or explicit tag.
            // 'all' and severity are intentionally excluded so broad selectors (e.g. 'all', '4', 'Low') don't pull them in.
            selectables = [
                this.getEngineName().toLowerCase(),
                this.getName().toLowerCase(),
                ...tags
            ];
        } else {
            selectables = [
                "all",
                this.getEngineName().toLowerCase(),
                this.getName().toLowerCase(),
                sevName.toLowerCase(),
                String(sevNumber),
                ...tags
            ];
        }
        return ruleSelector.matchesSelectables(selectables);
    }
}

abstract class AbstractEngineErrorRule implements Rule {
    protected readonly engineName: string;

    protected constructor(engineName: string) {
        this.engineName = engineName;
    }

    public abstract getDescription(): string;

    public getEngineName(): string {
        return this.engineName;
    }

    public abstract getName(): string;

    public getResourceUrls(): string[] {
        return [];
    }

    public getSeverityLevel(): SeverityLevel {
        return SeverityLevel.Critical;
    }

    public getTags(): string[] {
        return [];
    }
}

export class UnexpectedEngineErrorRule extends AbstractEngineErrorRule {
    constructor(engineName: string) {
        super(engineName);
    }

    override getDescription(): string {
        return getMessage('UnexpectedEngineErrorRuleDescription', this.engineName);
    }

    override getName(): string {
        return "UnexpectedEngineError";
    }
}

export class UninstantiableEngineErrorRule extends  AbstractEngineErrorRule {
    constructor(engineName: string) {
        super(engineName);
    }

    public override getDescription(): string {
        return getMessage('UninstantiableEngineErrorRuleDescription', this.engineName);
    }

    public override getName(): string {
        return 'UninstantiableEngineError';
    }
}

export class RuleSelectionImpl implements RuleSelection {
    private readonly ruleMap: Map<string, Rule[]> = new Map();

    addRule(rule: Rule) {
        const engineName = rule.getEngineName();
        if (!this.ruleMap.has(engineName)) {
            this.ruleMap.set(engineName, []);
        }
        this.ruleMap.get(engineName)!.push(rule);
    }

    getCount(): number {
        let count = 0;
        for (const rules of this.ruleMap.values()) {
            count += rules.length
        }
        return count;
    }

    getEngineNames(): string[] {
        return Array.from(this.ruleMap.keys());
    }

    getRulesFor(engineName: string): Rule[] {
        return this.ruleMap.get(engineName) || [];
    }

    getRule(engineName: string, ruleName: string): Rule {
        for (const rule of this.getRulesFor(engineName)) {
            if (rule.getName() == ruleName) {
                return rule;
            }
        }
        throw new Error(getMessage('RuleDoesNotExistInSelection', ruleName, engineName));
    }

    toFormattedOutput(format: OutputFormat): string {
        return RuleSelectionFormatter.forFormat(format).format(this);
    }
}
