import {RunResults} from "../../results";
import * as xmlbuilder from "xmlbuilder";
import {RunResultsFormatter, CODE_ANALYZER_CORE_NAME} from "../../output-format";
import {JsonCodeLocationOutput, JsonResultsOutput, toJsonResultsOutput} from "./json-run-results-format";

/**
 * Formatter for Results XML Output Format
 */
export class XmlRunResultsFormatter implements RunResultsFormatter {
    format(results: RunResults): string {
        // XML and JSON output formats are very similar, so leveraging the same data structure from JSON for now.
        const resultsOutput: JsonResultsOutput = toJsonResultsOutput(results);

        const resultsNode: xmlbuilder.XMLElement = xmlbuilder.create('results', {version: '1.0', encoding: 'UTF-8'});
        resultsNode.node('runDir').text(resultsOutput.runDir);
        const violationCountsNode: xmlbuilder.XMLElement = resultsNode.node('violationCounts');
        violationCountsNode.node('total').text(`${resultsOutput.violationCounts.total}`);
        violationCountsNode.node('sev1').text(`${resultsOutput.violationCounts.sev1}`);
        violationCountsNode.node('sev2').text(`${resultsOutput.violationCounts.sev2}`);
        violationCountsNode.node('sev3').text(`${resultsOutput.violationCounts.sev3}`);
        violationCountsNode.node('sev4').text(`${resultsOutput.violationCounts.sev4}`);
        violationCountsNode.node('sev5').text(`${resultsOutput.violationCounts.sev5}`);

        const versionsNode: xmlbuilder.XMLElement = resultsNode.node('versions');
        versionsNode.node(CODE_ANALYZER_CORE_NAME).text(results.getCoreVersion());
        const engineNames: string[] = results.getEngineNames();
        for (const engineName of engineNames) {
            versionsNode.node(engineName).text(results.getEngineRunResults(engineName).getEngineVersion());
        }

        const violationsNode: xmlbuilder.XMLElement = resultsNode.node('violations');
        for (const violationOutput of resultsOutput.violations) {
            const violationNode: xmlbuilder.XMLElement = violationsNode.node('violation');
            violationNode.node('rule').text(violationOutput.rule);
            violationNode.node('engine').text(violationOutput.engine);
            violationNode.node('severity').text(`${violationOutput.severity}`);
            const tagsNode: xmlbuilder.XMLElement = violationNode.node('tags');
            for (const tag of violationOutput.tags) {
                tagsNode.node('tag').text(tag);
            }
            violationNode.node('primaryLocationIndex').text(`${violationOutput.primaryLocationIndex}`);

            const pathLocationsNode: xmlbuilder.XMLElement = violationNode.node('locations');
            for (const location of violationOutput.locations) {
                const locationNode: xmlbuilder.XMLElement = pathLocationsNode.node('location');
                if (location.file !== undefined) {
                    locationNode.node('file').text(location.file);
                }
                if (location.startLine !== undefined) {
                    locationNode.node('startLine').text(`${location.startLine}`);
                }
                if (location.startColumn !== undefined) {
                    locationNode.node('startColumn').text(`${location.startColumn}`);
                }
                if (location.endLine !== undefined) {
                    locationNode.node('endLine').text(`${location.endLine}`);
                }
                if (location.endColumn !== undefined) {
                    locationNode.node('endColumn').text(`${location.endColumn}`);
                }
                if (location.comment !== undefined) {
                    locationNode.node('comment').text(location.comment);
                }
            }

            violationNode.node('message').text(violationOutput.message);

            const resourcesNode: xmlbuilder.XMLElement = violationNode.node('resources');
            for (const resource of violationOutput.resources) {
                resourcesNode.node('resource').text(resource);
            }

            if (violationOutput.fixes && violationOutput.fixes.length > 0) {
                const fixesNode: xmlbuilder.XMLElement = violationNode.node('fixes');
                for (const fix of violationOutput.fixes) {
                    const fixNode: xmlbuilder.XMLElement = fixesNode.node('fix');
                    addCodeLocationXmlNode(fixNode, 'location', fix.location);
                    fixNode.node('fixedCode').text(fix.fixedCode);
                }
            }

            if (violationOutput.suggestions && violationOutput.suggestions.length > 0) {
                const suggestionsNode: xmlbuilder.XMLElement = violationNode.node('suggestions');
                for (const suggestion of violationOutput.suggestions) {
                    const suggestionNode: xmlbuilder.XMLElement = suggestionsNode.node('suggestion');
                    addCodeLocationXmlNode(suggestionNode, 'location', suggestion.location);
                    suggestionNode.node('message').text(suggestion.message);
                }
            }
        }

        return violationsNode.end({ pretty: true, allowEmpty: true });
    }
}

function addCodeLocationXmlNode(parentNode: xmlbuilder.XMLElement, nodeName: string, location: JsonCodeLocationOutput): void {
    const locationNode: xmlbuilder.XMLElement = parentNode.node(nodeName);
    if (location.file !== undefined) {
        locationNode.node('file').text(location.file);
    }
    if (location.startLine !== undefined) {
        locationNode.node('startLine').text(`${location.startLine}`);
    }
    if (location.startColumn !== undefined) {
        locationNode.node('startColumn').text(`${location.startColumn}`);
    }
    if (location.endLine !== undefined) {
        locationNode.node('endLine').text(`${location.endLine}`);
    }
    if (location.endColumn !== undefined) {
        locationNode.node('endColumn').text(`${location.endColumn}`);
    }
}
