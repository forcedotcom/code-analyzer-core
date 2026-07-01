import path from 'node:path';
import {CodeLocation, EngineRunResults, Fix, RunResults, Violation} from "../../results";
import * as sarif from "sarif";
import {Rule, SeverityLevel} from "../../rules";
import {RunResultsFormatter} from "../../output-format";

/**
 * Formatter for SARIF Output Format
 */
export class SarifRunResultsFormatter implements RunResultsFormatter {
    format(results: RunResults): string {
        const runDir = results.getRunDirectory();

        const sarifRuns: sarif.Run[] = results.getEngineNames()
            .map(engineName => results.getEngineRunResults(engineName))
            .filter(engineRunResults => engineRunResults.getViolationCount() > 0)
            .map(engineRunResults => toSarifRun(engineRunResults, runDir));

        // Construct SARIF log
        const sarifLog: sarif.Log = {
            version: "2.1.0",
            $schema: 'http://json.schemastore.org/sarif-2.1.0',
            runs: sarifRuns,
        };

        // Return formatted SARIF JSON string
        return JSON.stringify(sarifLog, null, 2);
    }
}

function toSarifRun(engineRunResults: EngineRunResults, runDir: string): sarif.Run {
    const violations: Violation[] = engineRunResults.getViolations();
    const rules: Rule[] = [... new Set(violations.map(v => v.getRule()))];
    const ruleNames: string[] = rules.map(r => r.getName());

    const run: sarif.Run = {
        tool: {
            driver: {
                name: engineRunResults.getEngineName(),
                semanticVersion: engineRunResults.getEngineVersion(),
                informationUri: "https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engines.html",
                rules: rules.map(toSarifReportingDescriptor),
            }
        },
        results: violations.map(v => toSarifResult(v, runDir, ruleNames.indexOf(v.getRule().getName()))),
        invocations: [
            {
                executionSuccessful: true,
                workingDirectory: {
                    uri: runDir,
                },
            },
        ],
    };

    const insights = engineRunResults.getInsights();
    if (insights) {
        run.properties = { insights };
        if (insights['skipped'] === true) {
            const notification: sarif.Notification = {
                level: 'warning',
                message: { text: String(insights['message'] ?? `Engine ${engineRunResults.getEngineName()} was skipped.`) },
                descriptor: { id: String(insights['skipReason'] ?? 'UNKNOWN') }
            };
            run.invocations![0].toolConfigurationNotifications = [notification];
        }
    }

    return run;
}

function toSarifResult(violation: Violation, runDir: string, ruleIndex: number) : sarif.Result {
    const primaryCodeLocation = violation.getCodeLocations()[violation.getPrimaryLocationIndex()];
    const result: sarif.Result = {
        ruleId: violation.getRule().getName(),
        ruleIndex: ruleIndex,
        level: toSarifNotificationLevel(violation.getRule().getSeverityLevel()),
        message: { text: violation.getMessage() },

        // Note that sarif format has a limit of 10 elements in the locations array, so we only store
        // the primary location (which is what most utilities expect) here
        locations: [toSarifLocation(primaryCodeLocation, runDir)],

        // And then we store the full locations array in the relatedLocations field if users want to see all of them
        relatedLocations: violation.getCodeLocations().map(codeLoc => toSarifLocation(codeLoc, runDir))
    };
    const fixes = violation.getFixes();
    if (fixes.length > 0) {
        result.fixes = fixes.map(fix => toSarifFix(fix, runDir));
    }
    return result;
}

function toSarifFix(fix: Fix, runDir: string): sarif.Fix {
    const location = fix.getLocation();
    const file = location.getFile();
    return {
        artifactChanges: [{
            artifactLocation: {
                uri: file ? encodeURI(path.relative(runDir, file)) : undefined,
                uriBaseId: file ? encodeURI(runDir) : undefined
            },
            replacements: [{
                deletedRegion: {
                    startLine: location.getStartLine(),
                    startColumn: location.getStartColumn(),
                    endLine: location.getEndLine(),
                    endColumn: location.getEndColumn()
                } as sarif.Region,
                insertedContent: {
                    text: fix.getFixedCode()
                }
            }]
        }]
    };
}

function toSarifLocation(codeLocation: CodeLocation, runDir: string): sarif.Location {
    if (codeLocation.getFile()) {
        return {
            physicalLocation: {
                artifactLocation: {
                    uri: encodeURI(path.relative(runDir, codeLocation.getFile()!)),
                    uriBaseId: encodeURI(runDir)
                },
                region: {
                    startLine: codeLocation.getStartLine(),
                    startColumn: codeLocation.getStartColumn(),
                    endLine: codeLocation.getEndLine(),
                    endColumn: codeLocation.getEndColumn()
                } as sarif.Region
            }
        }
    } else {
        return {
            physicalLocation: {
                artifactLocation: {}
            }
        };
    }
}

function toSarifReportingDescriptor(rule: Rule): sarif.ReportingDescriptor {
    return {
        id: rule.getName(),
        properties: {
            category: rule.getTags(),
            severity: rule.getSeverityLevel()
        },
        ...(rule.getResourceUrls()?.[0] && { helpUri: rule.getResourceUrls()[0] })
    }
}

function toSarifNotificationLevel(severity: SeverityLevel): sarif.Notification.level {
    return severity < 3 ? 'error' : 'warning'; // IF sarif.Notification.level is an enum then please return the num instead of the string.
}