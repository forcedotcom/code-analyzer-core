import { CsvRunResultsFormatter } from "./output-formats/results/csv-run-results-format";
import { HtmlRunResultsFormatter } from "./output-formats/results/html-run-results-format";
import { JsonRunResultsFormatter } from "./output-formats/results/json-run-results-format";
import { SarifRunResultsFormatter } from "./output-formats/results/sarif-run-results-format";
import { XmlRunResultsFormatter } from "./output-formats/results/xml-run-results-format";
import { JsonRulesFormatter } from "./output-formats/rules/json-rules-format";
import { RunResults } from "./results";
import { RuleSelection } from "./rules";
import { Clock, RealClock } from "./utils";

/**
 * Enum of output formats available
 */

export enum OutputFormat {
    CSV = "CSV",
    JSON = "JSON",
    XML = "XML",
    HTML = "HTML",
    SARIF = "SARIF"
}

// exported internally only to be shared between multiple source files
export const CODE_ANALYZER_CORE_NAME: string = 'code-analyzer';

/**
 * Abstract class to convert RunResults to formatted output text
 */
export abstract class RunResultsFormatter {
    /**
     * Formats run results into output text as a string
     * @param runResults RunResults to be formatted
     */
    abstract format(runResults: RunResults): string

    /**
     * Creates the {@link RunResultsFormatter} associated with an {@link OutputFormat}
     * @param format {@link OutputFormat} instance
     * @param clock (optional - for internal testing purposes only)
     */
    static forFormat(format: OutputFormat, /* istanbul ignore next */ clock: Clock = new RealClock()) {
        switch (format) {
            case OutputFormat.CSV:
                return new CsvRunResultsFormatter();
            case OutputFormat.JSON:
                return new JsonRunResultsFormatter();
            case OutputFormat.XML:
                return new XmlRunResultsFormatter();
            case OutputFormat.HTML:
                return new HtmlRunResultsFormatter(clock);
            case OutputFormat.SARIF:
                return new SarifRunResultsFormatter();
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }
}

/**
 * Abstract class to convert RuleSelection to formatted output text
 */
export abstract class RuleSelectionFormatter {
    /**
     * Formats rules into output text as a string
     * @param ruleSelection RuleSelection to be formatted
     */
    abstract format(ruleSelection: RuleSelection): string

    /**
     * Creates the {@link RuleSelectionFormatter} associated with an {@link OutputFormat}
     * @param format {@link OutputFormat} instance
     */
    static forFormat(format: OutputFormat) {
        switch (format) {
            case OutputFormat.JSON:
                return new JsonRulesFormatter();
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }
}
