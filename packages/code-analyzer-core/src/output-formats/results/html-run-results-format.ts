import path from "node:path";
import {Clock} from "@salesforce/code-analyzer-engine-api/utils";
import {RunResults} from "../../results";
import fs from "fs";
import { RunResultsFormatter } from "../../output-format";
import {
    JsonResultsOutput,
    toJsonResultsOutput
} from "./json-run-results-format";

const HTML_TEMPLATE_VERSION: string = '0.0.13';
const HTML_TEMPLATE_FILE: string = path.resolve(__dirname, '..', '..', '..', 'output-templates', `html-template-${HTML_TEMPLATE_VERSION}.txt`);

/**
 * Formatter for Results HTML Output Format
 */
export class HtmlRunResultsFormatter implements RunResultsFormatter {
    private static readonly TIMESTAMP_HOLE: string = '{{###TIMESTAMP###}}';
    private static readonly RUNDIR_HOLE: string = '{{###RUNDIR###}}';
    private static readonly VIOLATIONS_HOLE: string = '{{###VIOLATIONS###}}';
    private readonly clock: Clock;

    constructor(clock: Clock) {
        this.clock = clock;
    }

    format(results: RunResults): string {
        const runDir = results.getRunDirectory();
        // It is easiest to put the results in json format (while escaping html characters) since it is easily
        // consumed by our html template.
        const jsonOutput: JsonResultsOutput = toJsonResultsOutput(results, escapeHtml);
        const htmlTemplate: string = fs.readFileSync(HTML_TEMPLATE_FILE, 'utf-8');
        const timestampString: string = this.clock.now().toLocaleString('en-us', {year: "numeric", month: "short",
            day: "numeric", hour: "numeric", minute: "numeric", hour12: true});

        // Note that value.replace(a,b) has special handling if b has '$' characters in it, so to avoid this special
        // handling, we use value.replace(a, (match) => b) instead so that we always replace with exact text.
        return htmlTemplate
            .replace(HtmlRunResultsFormatter.TIMESTAMP_HOLE, (_m) => timestampString)
            .replace(HtmlRunResultsFormatter.RUNDIR_HOLE, (_m) => runDir)
            .replace(HtmlRunResultsFormatter.VIOLATIONS_HOLE, (_m) => JSON.stringify(jsonOutput));
    }
}

function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, function (match: string) {
        /* istanbul ignore next */
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
}
