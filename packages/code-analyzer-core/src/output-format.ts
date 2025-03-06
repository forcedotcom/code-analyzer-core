import { CsvRunResultsFormatter } from "./output-formats/results/csv-output-format";
import { HtmlRunResultsFormatter } from "./output-formats/results/html-output-format";
import { JsonRunResultsFormatter } from "./output-formats/results/json-output-format";
import { SarifRunResultsFormatter } from "./output-formats/results/sarif-output-format";
import { XmlRunResultsFormatter } from "./output-formats/results/xml-output-format";
import { RunResults } from "./results";
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
 * Abstract class to convert RunResults objects to formatted output text
 */
export abstract class RunResultsFormatter {
    /**
     * Formats run results into output text as a string
     * @param results the type of data to be formatted
     */
    abstract format(results: RunResults): string

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
