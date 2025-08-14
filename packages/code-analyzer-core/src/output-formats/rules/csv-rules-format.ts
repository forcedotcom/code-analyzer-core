import { stringify as stringifyToCsv } from "csv-stringify/sync";
import { Options as CsvOptions } from "csv-stringify";
import { RuleSelectionFormatter } from "../../output-format";
import { Rule, RuleSelection } from "../../rules";

export class CsvRulesFormatter implements RuleSelectionFormatter {
    format(ruleSelection:RuleSelection): string {
        const selectedRules: Rule[] = ruleSelection.getEngineNames().flatMap(name => ruleSelection.getRulesFor(name));
        const csvRows: CsvRow[] = selectedRules.map(toCsvRow);
        const options: CsvOptions = {
            header: true,
            quoted_string: true,
            columns: ["name", "engine", "description", "severity", "tags", "resources"],
            cast: {
                object: value => {
                    /* istanbul ignore else */
                    if (Array.isArray(value)) {
                        return { value: value.join(','), quoted: true};
                    }
                    /* istanbul ignore next */
                    throw new Error(`Unsupported value to cast: ${value}.`);
                }
            }
        }
        return stringifyToCsv(csvRows, options);
    }
}

type CsvRow = {
    name: string
    engine: string
    description: string
    severity: number
    tags: string[]
    resources?: string[]
}

function toCsvRow(rule: Rule): CsvRow {
    return {
        name: rule.getName(),
        engine: rule.getEngineName(),
        description: rule.getDescription(),
        severity: rule.getSeverityLevel(),
        tags: rule.getTags(),
        resources: rule.getResourceUrls()
    };
}
