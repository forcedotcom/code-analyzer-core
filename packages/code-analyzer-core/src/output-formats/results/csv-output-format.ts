import {CodeLocation, RunResults, Violation} from "../../results";
import {stringify as stringifyToCsv} from "csv-stringify/sync";
import {Options as CsvOptions} from "csv-stringify";
import {OutputFormatter} from "../../output-format";
import {Rule} from "../../rules";
import {makeRelativeIfPossible} from "./json-output-format";

/**
 * Formatter for Results CSV Output Format
 *
 * Note that CSV format is limited and doesn't support showing certain information, like multiple code locations.
 */
export class ResultsCsvOutputFormatter implements OutputFormatter {
    format(results: RunResults): string {
        // Leveraging the JsonViolationOutput data structure for now. This may change in the near future.
        const csvRows: CsvRow[] = results.getViolations().map(v => toCsvRow(v, results.getRunDirectory()));
        const options: CsvOptions = {
            header: true,
            quoted_string: true,
            columns: ['rule', 'engine', 'severity', 'tags', 'file', 'startLine', 'startColumn',
                'endLine', 'endColumn', 'message', 'resources'],
            cast: {
                object: value => {
                    if (Array.isArray(value)) {
                        return { value: value.join(','), quoted: true };
                    }
                    /* istanbul ignore next */
                    throw new Error(`Unsupported value to cast: ${value}.`)
                }
            }
        };
        return stringifyToCsv(csvRows, options);
    }
}

type CsvRow = {
    rule: string
    engine: string
    severity: number
    tags: string[]
    file?: string
    startLine?: number
    startColumn?: number
    endLine?: number
    endColumn?: number
    message: string
    resources?: string[]
}

function toCsvRow(violation: Violation, runDir: string): CsvRow {
    const rule: Rule = violation.getRule();
    const primaryLocation: CodeLocation|undefined = violation.getCodeLocations().length == 0 ? /* istanbul ignore next */ undefined :
        violation.getCodeLocations()[violation.getPrimaryLocationIndex()];
    return {
        rule: rule.getName(),
        engine: rule.getEngineName(),
        severity: rule.getSeverityLevel(),
        tags: rule.getTags(),
        file: makeRelativeIfPossible(primaryLocation?.getFile(), runDir),
        startLine: primaryLocation?.getStartLine(),
        startColumn: primaryLocation?.getStartColumn(),
        endLine: primaryLocation?.getEndLine(),
        endColumn: primaryLocation?.getEndColumn(),
        message: violation.getMessage(),
        resources: violation.getResourceUrls()
    }
}