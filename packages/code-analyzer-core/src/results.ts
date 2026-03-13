import * as engApi from "@salesforce/code-analyzer-engine-api";
import { Clock, RealClock } from '@salesforce/code-analyzer-engine-api/utils';
import fs from "node:fs";
import path from "node:path";
import { getMessage } from "./messages";
import { OutputFormat, RunResultsFormatter } from "./output-format";
import { Rule, RuleSelection, SeverityLevel, UnexpectedEngineErrorRule, UninstantiableEngineErrorRule } from "./rules";
import { toAbsolutePath } from "./utils";

/**
 * Describes the code location details associated with a {@link Violation}
 */
export interface CodeLocation {
    /** Returns the file associated with a violation */
    getFile(): string | undefined

    /** Returns the start line in the file where the violating code begins */
    getStartLine(): number | undefined

    /** Returns the column associated with the start line where the violating code begins */
    getStartColumn(): number | undefined

    /** Returns the end line in the file where the violating code ends */
    getEndLine(): number | undefined

    /** Returns the column associated with the end line where the violating code ends */
    getEndColumn(): number | undefined

    /** Returns an optional comment to give core context associated with this line or block of code */
    getComment(): string | undefined
}

/**
 * Describes a violation that an engine found in one or more code locations
 */
export interface Violation {
    /** Returns the name of the rule associated with the violation */
    getRule(): Rule

    /** Returns the violation message */
    getMessage(): string

    /** Returns an array of {@link CodeLocation} instances associated with the violation */
    getCodeLocations(): CodeLocation[]

    /** Returns the primary {@link CodeLocation} associated with the violation */
    getPrimaryLocation(): CodeLocation

    /** Returns the index of the primary code location within the code locations array */
    getPrimaryLocationIndex(): number

    /** Returns an array of urls for resources associated with the violation */
    getResourceUrls(): string[]

    /** Returns an array of {@link Fix} instances that can be applied to resolve the violation */
    getFixes(): Fix[]

    /** Returns an array of {@link Suggestion} instances with messages to help resolve the violation */
    getSuggestions(): Suggestion[]
}

/**
 * Describes a fix that can be applied to resolve a {@link Violation}
 */
export interface Fix {
    /** Returns the {@link CodeLocation} of the code to be replaced */
    getLocation(): CodeLocation

    /** Returns the replacement code to apply at the specified location */
    getFixedCode(): string
}

/**
 * Describes a suggestion to help resolve a {@link Violation}
 */
export interface Suggestion {
    /** Returns the {@link CodeLocation} of the code associated with the suggestion */
    getLocation(): CodeLocation

    /** Returns a message describing the suggested change */
    getMessage(): string
}

/**
 * Describes the results of an individual engine's run of rules
 */
export interface EngineRunResults {
    /** Returns the name of the engine */
    getEngineName(): string

    /** Returns the version of the engine */
    getEngineVersion(): string

    /** Returns the total amount of violations detected from the engine */
    getViolationCount(): number

    /**
     * Returns the number of violations detected from the engine that are associated with a specified {@link SeverityLevel}
     * @param severity {@link SeverityLevel} to return the count for
     */
    getViolationCountOfSeverity(severity: SeverityLevel): number

    /** Returns the array of {@link Violation} instances for the engine */
    getViolations(): Violation[]
}

/**
 * Describes the overall results of running all selected engine rules
 */
export interface RunResults {
    /** Returns the directory from which the run occurred */
    getRunDirectory(): string

    /** Returns the version of Code Analyzer (core) */
    getCoreVersion(): string

    /** Returns the total number of violations across all engines that ran */
    getViolationCount(): number

    /**
     * Returns the number of violations detected across all engines that ran that are associated with a specified {@link SeverityLevel}
     * @param severity {@link SeverityLevel} to return the count for
     */
    getViolationCountOfSeverity(severity: SeverityLevel): number

    /** Returns the array of {@link Violation} instances across all engines */
    getViolations(): Violation[]

    /** Returns the names of the engines that ran */
    getEngineNames(): string[]

    /**
     * Returns the {@link EngineRunResults} for the specified engine
     * @param engineName the name of the engine to return results for
     */
    getEngineRunResults(engineName: string): EngineRunResults

    /**
     * Returns a formatted string of the results using the specified {@link OutputFormat}
     * @param format the {@link OutputFormat} to format the results to
     */
    toFormattedOutput(format: OutputFormat): string
}


/******* IMPLEMENTATIONS: *************************************************************************/
export class FixImpl implements Fix {
    private readonly apiFix: engApi.Fix;

    constructor(apiFix: engApi.Fix) {
        this.apiFix = apiFix;
    }

    getLocation(): CodeLocation {
        return new CodeLocationImpl(this.apiFix.location);
    }

    getFixedCode(): string {
        return this.apiFix.fixedCode;
    }
}

export class SuggestionImpl implements Suggestion {
    private readonly apiSuggestion: engApi.Suggestion;

    constructor(apiSuggestion: engApi.Suggestion) {
        this.apiSuggestion = apiSuggestion;
    }

    getLocation(): CodeLocation {
        return new CodeLocationImpl(this.apiSuggestion.location);
    }

    getMessage(): string {
        return this.apiSuggestion.message;
    }
}

export class CodeLocationImpl implements CodeLocation {
    private readonly apiCodeLocation: engApi.CodeLocation;

    constructor(apiCodeLocation: engApi.CodeLocation) {
        this.apiCodeLocation = apiCodeLocation;
    }

    getFile(): string {
        return toAbsolutePath(this.apiCodeLocation.file);
    }

    getStartLine(): number {
        return this.apiCodeLocation.startLine;
    }

    getStartColumn(): number {
        return this.apiCodeLocation.startColumn;
    }

    getComment(): string | undefined {
        return this.apiCodeLocation.comment;
    }

    getEndLine(): number | undefined {
        return this.apiCodeLocation.endLine;
    }

    getEndColumn(): number | undefined {
        return this.getEndLine() == undefined ? undefined : this.apiCodeLocation.endColumn;
    }
}

export class UndefinedCodeLocation implements CodeLocation {
    static readonly INSTANCE: UndefinedCodeLocation = new UndefinedCodeLocation();

    getFile(): undefined {
        return undefined;
    }

    getStartLine(): undefined {
        return undefined;
    }

    getStartColumn(): undefined {
        return undefined;
    }

    getComment(): string {
        return getMessage('UndefinedCodeLocationComment');
    }

    getEndLine(): undefined {
        return undefined;
    }

    getEndColumn(): undefined {
        return undefined;
    }
}

export class ViolationImpl implements Violation {
    private readonly apiViolation: engApi.Violation;
    private readonly rule: Rule;

    constructor(apiViolation: engApi.Violation, rule: Rule) {
        this.apiViolation = apiViolation;
        this.rule = rule;
    }

    getRule(): Rule {
        return this.rule;
    }

    getMessage(): string {
        return this.apiViolation.message;
    }

    getCodeLocations(): CodeLocation[] {
        return this.apiViolation.codeLocations.map(l => new CodeLocationImpl(l));
    }

    getPrimaryLocation(): CodeLocation {
        return new CodeLocationImpl(this.apiViolation.codeLocations[this.getPrimaryLocationIndex()]);
    }

    getPrimaryLocationIndex(): number {
        return this.apiViolation.primaryLocationIndex;
    }

    getResourceUrls(): string[] {
        // Returns the urls from the rule and then appends any urls from the violation that are not already from the rule.
        const urls: string[] = this.rule.getResourceUrls();
        return !this.apiViolation.resourceUrls ? urls :
            [...urls, ...this.apiViolation.resourceUrls.filter(url => !urls.includes(url))];
    }

    getFixes(): Fix[] {
        return (this.apiViolation.fixes ?? []).map(f => new FixImpl(f));
    }

    getSuggestions(): Suggestion[] {
        return (this.apiViolation.suggestions ?? []).map(s => new SuggestionImpl(s));
    }
}

abstract class AbstractLocationlessViolation implements Violation {
    protected readonly engineName: string;
    protected readonly error: Error;
    protected readonly rule: Rule;

    protected constructor(engineName: string, error: Error, rule: Rule) {
        this.engineName = engineName;
        this.error = error;
        this.rule = rule;
    }

    getRule(): Rule {
        return this.rule;
    }

    abstract getMessage(): string;

    getCodeLocations(): CodeLocation[] {
        return [UndefinedCodeLocation.INSTANCE];
    }

    getPrimaryLocation(): CodeLocation {
        return UndefinedCodeLocation.INSTANCE;
    }

    getPrimaryLocationIndex(): number {
        return 0;
    }

    getResourceUrls(): string[] {
        return [];
    }

    getFixes(): Fix[] {
        return [];
    }

    getSuggestions(): Suggestion[] {
        return [];
    }
}

export class UninstantiableEngineErrorViolation extends AbstractLocationlessViolation {
    constructor(engineName: string, error: Error) {
        super(engineName, error, new UninstantiableEngineErrorRule(engineName));
    }

    override getMessage(): string {
        return getMessage('UninstantiableEngineErrorViolationMessage', this.engineName,
            this.error.stack ? this.error.stack :  // Prefer to get the whole stack when possible
                /* istanbul ignore next */ this.error.message);
    }
}

export class UnexpectedEngineErrorViolation extends AbstractLocationlessViolation {
    constructor(engineName: string, error: Error) {
        super(engineName, error, new UnexpectedEngineErrorRule(engineName));
    }

    override getMessage(): string {
        return getMessage('UnexpectedEngineErrorViolationMessage', this.engineName,
            this.error.stack ? this.error.stack :  // Prefer to get the whole stack when possible
                /* istanbul ignore next */ this.error.message);
    }
}

export class EngineRunResultsImpl implements EngineRunResults {
    private readonly engineName: string;
    private readonly engineVersion: string;
    private readonly apiEngineRunResults: engApi.EngineRunResults;
    private readonly ruleSelection: RuleSelection;

    constructor(engineName: string, engineVersion: string, apiEngineRunResults: engApi.EngineRunResults, ruleSelection: RuleSelection) {
        this.engineName = engineName;
        this.engineVersion = engineVersion;
        this.apiEngineRunResults = apiEngineRunResults;
        this.ruleSelection = ruleSelection;
    }

    getEngineName(): string {
        return this.engineName;
    }

    getEngineVersion(): string {
        return this.engineVersion;
    }

    getViolationCount(): number {
        return this.apiEngineRunResults.violations.length;
    }

    getViolationCountOfSeverity(severity: SeverityLevel): number {
        return this.getViolations().filter(v => v.getRule().getSeverityLevel() == severity).length;
    }

    getViolations(): Violation[] {
        return this.apiEngineRunResults.violations.map(v =>
            new ViolationImpl(v, this.ruleSelection.getRule(this.engineName, v.ruleName)));
    }
}

abstract class AbstractErroneousEngineRunResults implements EngineRunResults {
    private readonly engineName: string;
    private readonly engineVersion: string;
    private readonly violation: Violation;

    protected constructor(engineName: string, engineVersion: string, violation: Violation) {
        this.engineName = engineName;
        this.engineVersion = engineVersion;
        this.violation = violation;
    }

    public getEngineName(): string {
        return this.engineName;
    }

    public getEngineVersion(): string {
        return this.engineVersion;
    }

    public getViolationCount(): number {
        return 1;
    }

    public getViolationCountOfSeverity(severity: SeverityLevel): number {
        return severity == SeverityLevel.Critical ? 1 : 0;
    }

    public getViolations(): Violation[] {
        return [this.violation];
    }
}

export class UninstantiableEngineRunResults extends AbstractErroneousEngineRunResults {
    constructor(engineName: string, error: Error) {
        super(engineName, 'unknown', new UninstantiableEngineErrorViolation(engineName, error));
    }
}

export class UnexpectedErrorEngineRunResults extends AbstractErroneousEngineRunResults {
    constructor(engineName: string, engineVersion: string, error: Error) {
        super(engineName, engineVersion, new UnexpectedEngineErrorViolation(engineName, error));
    }
}

export class RunResultsImpl implements RunResults {
    private readonly clock: Clock;
    private readonly runDir: string;
    private coreVersion: string = ''; // This value will be overwritten before it ever has a chance to matter.
    private readonly engineRunResultsMap: Map<string, EngineRunResults> = new Map();

    constructor(clock: Clock = new RealClock(), runDir: string = process.cwd() + path.sep) {
        this.clock = clock;
        this.runDir = runDir;
    }

    getRunDirectory(): string {
        return this.runDir;
    }

    getCoreVersion(): string {
        if (!this.coreVersion) {
            const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
            const packageJson: { version: string } = JSON.parse(fs.readFileSync(pathToPackageJson, 'utf-8'));
            this.coreVersion = packageJson.version;
        }
        return this.coreVersion;
    }

    getViolations(): Violation[] {
        return Array.from(this.engineRunResultsMap.values()).flatMap(
            engineRunResults => engineRunResults.getViolations());
    }

    getViolationCount(): number {
        let count = 0;
        for (const engineRunResults of this.engineRunResultsMap.values()) {
            count += engineRunResults.getViolationCount();
        }
        return count;
    }

    getViolationCountOfSeverity(severity: SeverityLevel): number {
        let count = 0;
        for (const engineRunResults of this.engineRunResultsMap.values()) {
            count += engineRunResults.getViolationCountOfSeverity(severity);
        }
        return count;
    }

    getEngineNames(): string[] {
        return Array.from(this.engineRunResultsMap.keys());
    }

    getEngineRunResults(engineName: string): EngineRunResults {
        const engineRunResults = this.engineRunResultsMap.get(engineName);
        if (!engineRunResults) {
            // This line should ideally never be hit. But it is added as protection in case the client passes in a bad engine name.
            throw new Error(getMessage('EngineRunResultsMissing', engineName));
        }
        return engineRunResults;
    }

    toFormattedOutput(format: OutputFormat): string {
        return RunResultsFormatter.forFormat(format, this.clock).format(this);
    }

    addEngineRunResults(engineRunResults: EngineRunResults): void {
        this.engineRunResultsMap.set(engineRunResults.getEngineName(), engineRunResults);
    }
}
