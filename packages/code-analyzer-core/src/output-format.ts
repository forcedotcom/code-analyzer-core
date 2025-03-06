import { RunResults } from "./results";
import { RuleSelection } from "./rules";
import { Clock, RealClock } from "./utils";
import { ResultsCsvOutputFormatter } from "./output-formats/results/csv-output-format";
import { ResultsHtmlOutputFormatter } from "./output-formats/results/html-output-format";
import { ResultsJsonOutputFormatter } from "./output-formats/results/json-output-format";
import { ResultsSarifOutputFormatter } from "./output-formats/results/sarif-output-format";
import { ResultsXmlOutputFormatter } from "./output-formats/results/xml-output-format";

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
 * Abstract class to convert data objects to formatted output text
 */
export abstract class OutputFormatter {
    /**
     * Formats a given data structure into output text as a string
     * @param data the type of data to be formatted
     */
    abstract format(data: RunResults | RuleSelection): string

    /**
     * Creates the {@link OutputFormatter} associated with an {@link OutputFormat}
     * @param format {@link OutputFormat} instance
     * @param clock (optional - for internal testing purposes only)
     */
    static forResultsFormat(format: OutputFormat, /* istanbul ignore next */ clock: Clock = new RealClock()) {
        switch (format) {
            case OutputFormat.CSV:
                return new ResultsCsvOutputFormatter();
            case OutputFormat.JSON:
                return new ResultsJsonOutputFormatter();
            case OutputFormat.XML:
                return new ResultsXmlOutputFormatter();
            case OutputFormat.HTML:
                return new ResultsHtmlOutputFormatter(clock);
            case OutputFormat.SARIF:
                return new ResultsSarifOutputFormatter();
            default:
                throw new Error(`Unsupported output format: ${format}`);
        }
    }
}
