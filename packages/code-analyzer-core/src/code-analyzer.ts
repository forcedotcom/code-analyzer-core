import {RuleImpl, RuleSelection, RuleSelectionImpl} from "./rules"
import {
    EngineRunResults,
    EngineRunResultsImpl,
    RunResults,
    RunResultsImpl,
    UnexpectedErrorEngineRunResults
} from "./results"
import {EngineLogEvent, EngineProgressEvent, EngineResultsEvent, Event, EventType, LogLevel} from "./events"
import {getMessage} from "./messages";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {EventEmitter} from "node:events";
import {CodeAnalyzerConfig, FIELDS, RuleOverride} from "./config";
import {
    Clock,
    RealClock,
    SimpleUniqueIdGenerator,
    toAbsolutePath,
    UniqueIdGenerator
} from "./utils";
import fs from "node:fs";
import {Workspace, WorkspaceImpl} from "./workspace";


export type SelectOptions = {
    workspace?: Workspace
}

export type RunOptions = {
    workspace: Workspace
    pathStartPoints?: string[]
}

export class CodeAnalyzer {
    private readonly config: CodeAnalyzerConfig;
    private clock: Clock = new RealClock();
    private uniqueIdGenerator: UniqueIdGenerator = new SimpleUniqueIdGenerator();
    private readonly eventEmitter: EventEmitter = new EventEmitter();
    private readonly engines: Map<string, engApi.Engine> = new Map();

    constructor(config: CodeAnalyzerConfig) {
        this.config = config;
    }

    // For testing purposes only
    _setClock(clock: Clock) {
        this.clock = clock;
    }
    _setUniqueIdGenerator(uniqueIdGenerator: UniqueIdGenerator) {
        this.uniqueIdGenerator = uniqueIdGenerator;
    }

    public async createWorkspace(filesAndFolders: string[]): Promise<Workspace> {
        const workspaceId: string = this.uniqueIdGenerator.getUniqueId('workspace');
        return new WorkspaceImpl(workspaceId, filesAndFolders.map(validateFileOrFolder));
    }

    public async addEnginePlugin(enginePlugin: engApi.EnginePlugin): Promise<void> {
        if (enginePlugin.getApiVersion() > engApi.ENGINE_API_VERSION) {
            this.emitLogEvent(LogLevel.Warn, getMessage('EngineFromFutureApiDetected',
                enginePlugin.getApiVersion(), `"${ enginePlugin.getAvailableEngineNames().join('","') }"`, engApi.ENGINE_API_VERSION))
        }
        const enginePluginV1: engApi.EnginePluginV1 = enginePlugin as engApi.EnginePluginV1;

        const promises: Promise<void>[] = getAvailableEngineNamesFromPlugin(enginePluginV1).map(engineName =>
            this.createAndAddEngineIfValid(engineName, enginePluginV1));
        await Promise.all(promises);
    }

    public async dynamicallyAddEnginePlugin(enginePluginModulePath: string): Promise<void> {
        let pluginModule;
        try {
            enginePluginModulePath = require.resolve(enginePluginModulePath, {paths: [this.config.getConfigFolder()]});
            pluginModule = (await import(enginePluginModulePath));
        } catch (err) {
            throw new Error(getMessage('FailedToDynamicallyLoadModule', enginePluginModulePath, (err as Error).message), {cause: err});
        }

        if (typeof pluginModule.createEnginePlugin !== 'function') {
            throw new Error(getMessage('FailedToDynamicallyAddEnginePlugin', enginePluginModulePath));
        }
        const enginePlugin: engApi.EnginePlugin = pluginModule.createEnginePlugin();
        return this.addEnginePlugin(enginePlugin);
    }

    public getEngineNames(): string[] {
        return Array.from(this.engines.keys());
    }

    public async selectRules(selectors: string[], selectOptions?: SelectOptions): Promise<RuleSelection> {
        selectors = selectors.length > 0 ? selectors : ['Recommended'];

        const allRules: RuleImpl[] = await this.getAllRules(selectOptions?.workspace);

        const ruleSelection: RuleSelectionImpl = new RuleSelectionImpl();
        for (const rule of allRules) {
            if (selectors.some(s => rule.matchesRuleSelector(s))) {
                ruleSelection.addRule(rule);
            }
        }
        return ruleSelection;
    }

    public async run(ruleSelection: RuleSelection, runOptions: RunOptions): Promise<RunResults> {
        const engineRunOptions: engApi.RunOptions = extractEngineRunOptions(runOptions);
        this.emitLogEvent(LogLevel.Debug, getMessage('RunningWithRunOptions', JSON.stringify(engineRunOptions)));

        const runResults: RunResultsImpl = new RunResultsImpl();
        for (const engineName of ruleSelection.getEngineNames()) {
            this.emitEvent<EngineProgressEvent>({
                type: EventType.EngineProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 0
            });

            const engineRunResults: EngineRunResults = await this.runEngineAndValidateResults(engineName, ruleSelection, engineRunOptions);
            runResults.addEngineRunResults(engineRunResults);

            this.emitEvent<EngineProgressEvent>({
                type: EventType.EngineProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 100
            });
            this.emitEvent<EngineResultsEvent>({
                type: EventType.EngineResultsEvent, timestamp: this.clock.now(), results: engineRunResults
            });
        }

        return runResults;
    }

    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    private async getAllRules(workspace?: Workspace): Promise<RuleImpl[]> {
        const rulePromises: Promise<RuleImpl[]>[] = this.getEngineNames().map(
            engineName => this.getAllRulesFor(engineName, {workspace: workspace}));
        return (await Promise.all(rulePromises)).flat();
    }

    private async getAllRulesFor(engineName: string, describeOptions: engApi.DescribeOptions): Promise<RuleImpl[]> {
        const engine: engApi.Engine = this.getEngine(engineName);
        const ruleDescriptions: engApi.RuleDescription[] = await engine.describeRules(describeOptions);
        validateRuleDescriptions(ruleDescriptions, engineName);
        return ruleDescriptions.map(rd => this.updateRuleDescriptionWithOverrides(engineName, rd))
            .map(rd => new RuleImpl(engineName, rd));
    }

    private async runEngineAndValidateResults(engineName: string, ruleSelection: RuleSelection, engineRunOptions: engApi.RunOptions): Promise<EngineRunResults> {
        const rulesToRun: string[] = ruleSelection.getRulesFor(engineName).map(r => r.getName());
        this.emitLogEvent(LogLevel.Debug, getMessage('RunningEngineWithRules', engineName, JSON.stringify(rulesToRun)));
        const engine: engApi.Engine = this.getEngine(engineName);

        let apiEngineRunResults: engApi.EngineRunResults;
        try {
            apiEngineRunResults = await engine.runRules(rulesToRun, engineRunOptions);
        } catch (error) {
            return new UnexpectedErrorEngineRunResults(engineName, error as Error);
        }

        validateEngineRunResults(engineName, apiEngineRunResults, ruleSelection);
        return new EngineRunResultsImpl(engineName, apiEngineRunResults, ruleSelection);
    }

    private emitEvent<T extends Event>(event: T): void {
        this.eventEmitter.emit(event.type, event);
    }

    private emitLogEvent(logLevel: LogLevel, message: string): void {
        this.emitEvent({
            type: EventType.LogEvent,
            timestamp: this.clock.now(),
            logLevel: logLevel,
            message: message
        })
    }

    private async createAndAddEngineIfValid(engineName: string, enginePluginV1: engApi.EnginePluginV1): Promise<void> {
        if (this.engines.has(engineName)) {
            this.emitLogEvent(LogLevel.Error, getMessage('DuplicateEngine', engineName));
            return;
        }

        const engConf: engApi.ConfigObject = this.config.getEngineConfigFor(engineName);

        let engine: engApi.Engine;
        try {
            engine = await enginePluginV1.createEngine(engineName, engConf);
        } catch (err) {
            this.emitLogEvent(LogLevel.Error, getMessage('PluginErrorFromCreateEngine', engineName, (err as Error).message));
            return;
        }

        if (engineName != engine.getName()) {
            this.emitLogEvent(LogLevel.Error, getMessage('EngineNameContradiction', engineName, engine.getName()));
            return;
        }

        this.engines.set(engineName, engine);
        this.emitLogEvent(LogLevel.Debug, getMessage('EngineAdded', engineName));
        this.listenToEngineEvents(engine);
    }

    private listenToEngineEvents(engine: engApi.Engine) {
        engine.onEvent(engApi.EventType.LogEvent, (event: engApi.LogEvent) => {
            this.emitEvent<EngineLogEvent>({
                type: EventType.EngineLogEvent,
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                logLevel: event.logLevel as LogLevel,
                message: event.message
            });
        });

        engine.onEvent(engApi.EventType.ProgressEvent, (event: engApi.ProgressEvent) => {
            this.emitEvent<EngineProgressEvent>({
                type: EventType.EngineProgressEvent,
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                percentComplete: event.percentComplete
            });
        });
    }

    private updateRuleDescriptionWithOverrides(engineName: string, ruleDescription: engApi.RuleDescription): engApi.RuleDescription {
        const ruleOverride: RuleOverride = this.config.getRuleOverrideFor(engineName, ruleDescription.name);
        if (ruleOverride.severity) {
            this.emitLogEvent(LogLevel.Debug, getMessage('RulePropertyOverridden', FIELDS.SEVERITY,
                ruleDescription.name, engineName, ruleDescription.severityLevel, ruleOverride.severity));
            ruleDescription.severityLevel = ruleOverride.severity as engApi.SeverityLevel;
        }
        if (ruleOverride.tags) {
            this.emitLogEvent(LogLevel.Debug, getMessage('RulePropertyOverridden', FIELDS.TAGS,
                ruleDescription.name, engineName, JSON.stringify(ruleDescription.tags), JSON.stringify(ruleOverride.tags)));
            ruleDescription.tags = ruleOverride.tags;
        }
        return ruleDescription;
    }

    private getEngine(engineName: string): engApi.Engine {
        // This line should never return undefined, so we are safe to directly cast to engApi.Engine
        return this.engines.get(engineName) as engApi.Engine;
    }
}

function getAvailableEngineNamesFromPlugin(enginePlugin: engApi.EnginePluginV1): string[] {
    try {
        return enginePlugin.getAvailableEngineNames();
    } catch (err) {
        throw new Error(getMessage('PluginErrorFromGetAvailableEngineNames', (err as Error).message), {cause: err})
    }
}

function validateRuleDescriptions(ruleDescriptions: engApi.RuleDescription[], engineName: string): void {
    const ruleNamesSeen: Set<string> = new Set();
    for (const ruleDescription of ruleDescriptions) {
        if (ruleNamesSeen.has(ruleDescription.name)) {
            throw new Error(getMessage('EngineReturnedMultipleRulesWithSameName', engineName, ruleDescription.name));
        }
        ruleNamesSeen.add(ruleDescription.name);
    }
}

function extractEngineRunOptions(runOptions: RunOptions): engApi.RunOptions {
    if(runOptions.workspace.getFilesAndFolders().length == 0) {
        throw new Error(getMessage('AtLeastOneFileOrFolderMustBeIncluded'));
    }
    const engineRunOptions: engApi.RunOptions = {
        workspace: runOptions.workspace,
    };
    if (runOptions.pathStartPoints && runOptions.pathStartPoints.length > 0) {
        engineRunOptions.pathStartPoints = runOptions.pathStartPoints.flatMap(extractEnginePathStartPoints)
    }
    validatePathStartPointsAreInsideWorkspace(engineRunOptions);
    return engineRunOptions;
}

// TODO: Eventually we should make all these validations async
function validateFileOrFolder(fileOrFolder: string): string {
    const absFileOrFolder: string = toAbsolutePath(fileOrFolder);
    if (!fs.existsSync(absFileOrFolder)) {
        throw new Error(getMessage('FileOrFolderDoesNotExist', absFileOrFolder));
    }
    return absFileOrFolder;
}

function validatePathStartPointFile(file: string, pathStartPointStr: string): string {
    const absFile: string = toAbsolutePath(file);
    if (!fs.existsSync(absFile)) {
        throw new Error(getMessage('PathStartPointFileDoesNotExist', pathStartPointStr, absFile));
    } else if (fs.statSync(absFile).isDirectory()) {
        throw new Error(getMessage('PathStartPointWithMethodMustNotBeFolder', pathStartPointStr, absFile));
    }
    return absFile;
}

function extractEnginePathStartPoints(pathStartPointStr: string): engApi.PathPoint[] {
    const parts: string[] = pathStartPointStr.split('#');
    if (parts.length == 1) {
        return [{
            file: validateFileOrFolder(pathStartPointStr)
        }];
    } else if (parts.length > 2) {
        throw new Error(getMessage('InvalidPathStartPoint', pathStartPointStr));
    }

    const pathStartPointFile: string = validatePathStartPointFile(parts[0], pathStartPointStr);
    const VALID_METHOD_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;
    const TRAILING_SPACES_AND_SEMICOLONS_REGEX = /\s+;*$/;
    const methodNames: string = parts[1].replace(TRAILING_SPACES_AND_SEMICOLONS_REGEX, '');
    return methodNames.split(";").map(methodName => {
        if (! VALID_METHOD_NAME_REGEX.test(methodName) ) {
            throw new Error(getMessage('InvalidPathStartPoint', pathStartPointStr));
        }
        return { file: pathStartPointFile, methodName: methodName };
    });
}

function validatePathStartPointsAreInsideWorkspace(engineRunOptions: engApi.RunOptions) {
    if (!engineRunOptions.pathStartPoints) {
        return;
    }
    for (const enginePathStartPoint of engineRunOptions.pathStartPoints) {
        if (!fileIsUnderneath(enginePathStartPoint.file, engineRunOptions.workspace.getFilesAndFolders())) {
            throw new Error(getMessage('PathStartPointMustBeInsideWorkspace', enginePathStartPoint.file,
                JSON.stringify(engineRunOptions.workspace.getFilesAndFolders())));
        }
    }
}

function fileIsUnderneath(file: string, filesOrFolders: string[]): boolean {
    return filesOrFolders.some(fileOrFolder => fileOrFolder == file ||
        (fs.statSync(fileOrFolder).isDirectory() && file.startsWith(fileOrFolder)));
}

function validateEngineRunResults(engineName: string, apiEngineRunResults: engApi.EngineRunResults, ruleSelection: RuleSelection): void {
    for (const violation of apiEngineRunResults.violations) {
        validateViolationRuleName(violation, engineName, ruleSelection);
        validateViolationPrimaryLocationIndex(violation, engineName);
        validateViolationCodeLocations(violation, engineName);
    }
}

function validateViolationRuleName(violation: engApi.Violation, engineName: string, ruleSelection: RuleSelection) {
    try {
        ruleSelection.getRule(engineName, violation.ruleName);
    } catch (error) {
        throw new Error(getMessage('EngineReturnedViolationForUnselectedRule', engineName, violation.ruleName), {cause: error});
    }
}

function validateViolationPrimaryLocationIndex(violation: engApi.Violation, engineName: string) {
    if (!isIntegerBetween(violation.primaryLocationIndex, 0, violation.codeLocations.length-1)) {
        throw new Error(getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex',
            engineName, violation.ruleName, violation.primaryLocationIndex, violation.codeLocations.length));
    }
}

function validateViolationCodeLocations(violation: engApi.Violation, engineName: string) {
    for (const codeLocation of violation.codeLocations) {
        const absFile: string = toAbsolutePath(codeLocation.file);
        fs.existsSync(absFile)

        if (!fs.existsSync(absFile)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationFileThatDoesNotExist',
                engineName, violation.ruleName, absFile));
        }

        if (!fs.statSync(absFile).isFile()) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationFileAsFolder',
                engineName, violation.ruleName, absFile));
        }

        if (!isValidLineOrColumn(codeLocation.startLine)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                engineName, violation.ruleName, 'startLine', codeLocation.startLine));
        }

        if (!isValidLineOrColumn(codeLocation.startColumn)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                engineName, violation.ruleName, 'startColumn', codeLocation.startColumn));
        }

        if (codeLocation.endLine !== undefined) {
            if (!isValidLineOrColumn(codeLocation.endLine)) {
                throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                    engineName, violation.ruleName, 'endLine', codeLocation.endLine));
            } else if (codeLocation.endLine < codeLocation.startLine) {
                throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine',
                    engineName, violation.ruleName, codeLocation.endLine, codeLocation.startLine));
            }

            if (codeLocation.endColumn !== undefined) {
                if (!isValidLineOrColumn(codeLocation.endColumn)) {
                    throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                        engineName, violation.ruleName, 'endColumn', codeLocation.endColumn));
                } else if (codeLocation.endLine == codeLocation.startLine && codeLocation.endColumn < codeLocation.startColumn) {
                    throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine',
                        engineName, violation.ruleName, codeLocation.endColumn, codeLocation.startColumn));
                }
            }
        }
    }
}

function isValidLineOrColumn(value: number) {
    return isIntegerBetween(value, 1, Number.MAX_VALUE);
}

function isIntegerBetween(value: number, leftBound: number, rightBound: number): boolean {
    return value >= leftBound && value <= rightBound && Number.isInteger(value);
}