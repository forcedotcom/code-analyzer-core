import {CodeLocation, RunResults, Violation} from "../../results";
import {RunResultsFormatter, CODE_ANALYZER_CORE_NAME} from "../../output-format";
import {Rule, SeverityLevel} from "../../rules";

/**
 * Type associated with the JSON Output Format
 * Note: This type is exported since it is shared among other formatters in this package, but is not exposed externally.
 */
export type JsonResultsOutput = {
    // The directory where Code Analyzer was run from.
    runDir: string

    // Object containing the aggregate counts of the violations
    violationCounts: {
        // The total amount of violations
        total: number

        // The amount of Critical severity level violations
        sev1: number

        // The amount of High severity level violations
        sev2: number

        // The amount of Moderate severity level violations
        sev3: number

        // The amount of Low severity level violations
        sev4: number

        // The amount of Info severity level violations
        sev5: number
    }

    // Object containing the versions of core and engine modules that ran
    versions: JsonVersionOutput

    // Array of objects containing information about the violations detected
    violations: JsonViolationOutput[]
}
export type JsonVersionOutput = {
    [coreOrEngineName: string]: string
}
export type JsonViolationOutput = {
    // The name of the rule associated with the violation
    rule: string

    // The engine associated with the violation
    engine: string

    // The severity level of the violation
    severity: number

    // The tags associated with the rule associted with the violation
    tags: string[]

    // The index of the primary code location within the code locations array
    primaryLocationIndex?: number

    // An array of code locations associated with the violation
    locations?: JsonCodeLocationOutput[]

    // The violation message
    message: string

    // An array of urls for resources associated with the violation
    resources?: string[]
}
export type JsonCodeLocationOutput = {
    // The path, relative to runDir, of the file associated with the violation
    file?: string;

    // The start line in the file where the violating code begins
    startLine?: number;

    // The column associated with the start line where the violating code begins
    startColumn?: number;

    // The end line in the file where the violating code ends
    endLine?: number;

    // The column associated with the end line where the violating code ends
    endColumn?: number;

    // A comment to give core context associated with this line or block of code
    comment?: string;
}

/**
 * Formatter for Results JSON Output Format
 */
export class JsonRunResultsFormatter implements RunResultsFormatter {
    format(results: RunResults): string {
        const resultsOutput: JsonResultsOutput = toJsonResultsOutput(results);
        return JSON.stringify(resultsOutput, undefined, 2);
    }
}

export function toJsonResultsOutput(results: RunResults, sanitizeFcn: (text: string) => string = t => t): JsonResultsOutput {
    return {
        runDir: results.getRunDirectory(),
        violationCounts: {
            total: results.getViolationCount(),
            sev1: results.getViolationCountOfSeverity(SeverityLevel.Critical),
            sev2: results.getViolationCountOfSeverity(SeverityLevel.High),
            sev3: results.getViolationCountOfSeverity(SeverityLevel.Moderate),
            sev4: results.getViolationCountOfSeverity(SeverityLevel.Low),
            sev5: results.getViolationCountOfSeverity(SeverityLevel.Info),
        },
        versions: toJsonVersionObject(results),
        violations: toJsonViolationOutputArray(results.getViolations(), results.getRunDirectory(), sanitizeFcn)
    };
}

function toJsonVersionObject(results: RunResults): JsonVersionOutput {
    const versions: JsonVersionOutput = {
        [CODE_ANALYZER_CORE_NAME]: results.getCoreVersion()
    };
    const engineNames: string[] = results.getEngineNames();
    for (const engineName of engineNames) {
        versions[engineName] = results.getEngineRunResults(engineName).getEngineVersion();
    }
    return versions;
}

export function toJsonViolationOutputArray(violations: Violation[], runDir: string, sanitizeFcn: (text: string) => string): JsonViolationOutput[] {
    return violations.map(v => toJsonViolationOutput(v, runDir, sanitizeFcn));
}

function toJsonViolationOutput(violation: Violation, runDir: string, sanitizeFcn: (text: string) => string): JsonViolationOutput {
    const rule: Rule = violation.getRule();
    return {
        rule: sanitizeFcn(rule.getName()),
        engine: sanitizeFcn(rule.getEngineName()),
        severity: rule.getSeverityLevel(),
        tags: rule.getTags().map(sanitizeFcn),
        primaryLocationIndex: violation.getPrimaryLocationIndex(),
        locations: toJsonCodeLocationOutputArray(violation.getCodeLocations(), runDir),
        message: sanitizeFcn(violation.getMessage()),
        resources: violation.getResourceUrls()
    };
}

function toJsonCodeLocationOutputArray(codeLocations: CodeLocation[], runDir: string): JsonCodeLocationOutput[] {
    return codeLocations.map(loc => toJsonCodeLocationOutput(loc, runDir));
}

function toJsonCodeLocationOutput(codeLocation: CodeLocation, runDir: string): JsonCodeLocationOutput {
    return {
        file:  makeRelativeIfPossible(codeLocation.getFile(), runDir),
        startLine: codeLocation.getStartLine(),
        startColumn: codeLocation.getStartColumn(),
        endLine: codeLocation.getEndLine(),
        endColumn: codeLocation.getEndColumn(),
        comment: codeLocation.getComment()
    }
}

export function makeRelativeIfPossible(file: string|undefined, rootDir: string): string|undefined {
    if (file && file.startsWith(rootDir)) {
        file = file.substring(rootDir.length);
    }
    return file;
}