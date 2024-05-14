import * as engApi from "@salesforce/code-analyzer-engine-api"

export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

export enum RuleType {
    Standard= "Standard",
    PathBased = "PathBased",
    UnexpectedError = "UnexpectedError"
}

export interface Rule {
    getName(): string
    getEngineName(): string
    getSeverityLevel(): SeverityLevel
    getType(): RuleType
    getTags(): string[]
    getDescription(): string
    getResourceUrls(): string[]
}

export interface RuleSelection {
    getCount(): number
    getEngineNames(): string[]
    getRulesFor(engineName: string): Rule[]
}


/******* IMPLEMENTATIONS: **************************************************************************/

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

    getType(): RuleType {
        return this.ruleDesc.type as RuleType;
    }

    matchesRuleSelector(ruleSelector: string): boolean {
        const partsToMatch: string[] = ruleSelector.split(':');
        for (const selectorPart of partsToMatch) {
            const partMatched =
                selectorPart == "all"
                || this.getEngineName() == selectorPart
                || this.getName() == selectorPart
                || this.getTags().includes(selectorPart)
                || String(this.getSeverityLevel().valueOf()) == selectorPart;
            if (!partMatched) return false;
        }
        return true;
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
}