import {RuleImpl, RuleSelection, RuleSelectionImpl} from "./rules"
import {
    EngineRunResults,
    EngineRunResultsImpl,
    RunResults,
    RunResultsImpl,
    UnexpectedErrorEngineRunResults,
    UninstantiableEngineRunResults
} from "./results"
import {SemVer} from 'semver';
import {EngineLogEvent, EngineResultsEvent, EngineRunProgressEvent, Event, EventType, LogLevel} from "./events"
import {getMessage} from "./messages";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {EventEmitter} from "node:events";
import {CodeAnalyzerConfig, ConfigDescription, EngineOverrides, FIELDS, RuleOverride} from "./config";
import {
    Clock,
    EngineProgressAggregator,
    RealClock,
    SimpleUniqueIdGenerator,
    toAbsolutePath,
    UniqueIdGenerator
} from "./utils";
import fs from "node:fs";
import path from 'node:path';

/**
 * Interface for workspaces
 */
export interface Workspace {
    getWorkspaceId(): string
    getFilesAndFolders(): string[]
}

/**
 * Optional options available to the selectRules method of the CodeAnalyzer class
 */
export type SelectOptions = {
    /** The workspace containing the files used to determine the applicable rules for the files within it */
    workspace?: Workspace
}

/**
 * Options available to the run method of the CodeAnalyzer class
 */
export type RunOptions = {
    /** The workspace containing the files to run the selected rules against */
    workspace: Workspace

    /** Starting points within your workspace to restrict any path-based analysis rules to.
     * If you don't specify this option, then any path-based analysis rules automatically discover and use all starting
     * points found in your workspace. Use this option to restrict the starting points to only those you want in your
     * code analysis. This option only applies to path-based analysis rules which are only available from some engines.
     */
    pathStartPoints?: string[]
}

/**
 * Object containing an engine's resolved configuration options
 */
export type EngineConfig = engApi.ConfigObject;

const MINIMUM_SUPPORTED_NODE = 20;

/**
 * Primary class to perform Salesforce Code Analyzer runs.
 *     Use this class to add engines, then select rules associated with those engines, and then run the selected rules
 *     against a specified workspace of files. Add listeners to this class to receive log and progress events associated
 *     with selecting and running rules.
 */
export class CodeAnalyzer {
    private readonly config: CodeAnalyzerConfig;
    private clock: Clock = new RealClock();
    private uniqueIdGenerator: UniqueIdGenerator = new SimpleUniqueIdGenerator();
    private readonly eventEmitter: EventEmitter = new EventEmitter();
    private readonly engines: Map<string, engApi.Engine> = new Map();
    private readonly uninstantiableEnginesMap: Map<string, Error> = new Map();
    private readonly engineConfigs: Map<string, EngineConfig> = new Map();
    private readonly engineConfigDescriptions: Map<string, ConfigDescription> = new Map();
    private readonly rulesCache: Map<string, RuleImpl[]> = new Map();
    private readonly engineRuleDiscoveryProgressAggregator: EngineProgressAggregator = new EngineProgressAggregator();

    constructor(config: CodeAnalyzerConfig, version: string = process.version) {
        this.validateEnvironment(version);
        this.config = config;
    }

    private validateEnvironment(version: string): void {
        const semver: SemVer = new SemVer(version);
        if (semver.major < MINIMUM_SUPPORTED_NODE) {
            throw new Error(getMessage('UnsupportedNodeVersion', MINIMUM_SUPPORTED_NODE, version));
        }
        const nodeHomeDir: string = path.dirname(process.execPath);
        process.env.PATH = `${nodeHomeDir}${path.delimiter}${process.env.PATH}`;
    }

    // For testing purposes only
    _setClock(clock: Clock) {
        this.clock = clock;
    }
    _setUniqueIdGenerator(uniqueIdGenerator: UniqueIdGenerator) {
        this.uniqueIdGenerator = uniqueIdGenerator;
    }

    /**
     * Convenience method to return the same CodeAnalyzerConfig instance that was provided to the constructor
     */
    public getConfig(): CodeAnalyzerConfig {
        return this.config;
    }

    /**
     * Creates a {@link Workspace} instance associated with a specified list of files and folders
     * @param filesAndFolders string array of files and/or folders to include
     */
    public async createWorkspace(filesAndFolders: string[]): Promise<Workspace> {
        const workspaceId: string = this.uniqueIdGenerator.getUniqueId('workspace');
        const fileValidationPromises: Promise<string>[] = filesAndFolders.map(validateFileOrFolder);
        const validatedFilesAndFolders: string[] = (await Promise.all(fileValidationPromises)).flat();
        return new WorkspaceImpl(validatedFilesAndFolders, workspaceId);
    }

    /**
     * Adds all engines associated with the provided EnginePlugin so that their rules are registered with Code Analyzer
     * @param enginePlugin {@link EnginePlugin} instance
     */
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

    /**
     * Dynamically loads a module containing an {@link EnginePlugin} and adds its engines to Code Analyzer
     *     Note that the module must export a createEnginePlugin() function that returns an EnginePlugin.
     * @param enginePluginModulePath string containing a discoverable name or location of an engine plugin module
     */
    public async dynamicallyAddEnginePlugin(enginePluginModulePath: string): Promise<void> {
        let pluginModule;
        let resolvedModulePath: string;
        try {
            try {
                resolvedModulePath = require.resolve(enginePluginModulePath, {paths: [this.config.getConfigRoot()]});
            } catch (err) /* istanbul ignore next */ {
                // On windows, there is an edge case where a standalone file in the same directory as the user's config
                // file may not be resolved by require.resolve if given as just the file name. So we attempt to resolve
                // this using path.resolve for this edge case.
                this.emitLogEvent(LogLevel.Fine, `While dynamically importing '${enginePluginModulePath}', ` +
                    `require.resolve failed with the following exception, so we will attempt to resolve with ` +
                    `path.resolve instead.\nError:\n` +
                    (err instanceof Error) ? (err as Error).stack || (err as Error).message : (err as string));
                resolvedModulePath = path.resolve(this.config.getConfigRoot(), enginePluginModulePath);
            }
            // To avoid issues with dynamically importing absolute paths on Windows, we need to use 'file://' URI format
            pluginModule = (await import(`file://${resolvedModulePath.replaceAll('\\', '/')}`));
        } catch (err) {
            throw new Error(getMessage('FailedToDynamicallyLoadModule', enginePluginModulePath, (err as Error).message), {cause: err});
        }

        if (typeof pluginModule.createEnginePlugin !== 'function') {
            throw new Error(getMessage('FailedToDynamicallyAddEnginePlugin', enginePluginModulePath));
        }
        const enginePlugin: engApi.EnginePlugin = pluginModule.createEnginePlugin();
        return this.addEnginePlugin(enginePlugin);
    }

    /**
     * Returns the names of the engines that have been added to Code Analyzer
     */
    public getEngineNames(): string[] {
        return Array.from(this.engines.keys());
    }

    /**
     * Returns the engine specific configuration associated with the specified engine name
     *     Note that the returned object contains the fully resolved configuration with all values and not just what the
     *     user wrote in their configuration file.
     * @param engineName the name of the engine that you wish you retrieve the configuration for
     */
    public getEngineConfig(engineName: string): EngineConfig {
        if (this.engineConfigs.has(engineName)) {
            return this.engineConfigs.get(engineName)!;
        }
        throw new Error(getMessage('FailedToGetEngineConfig', engineName));
    }

    /**
     * Returns a {@link ConfigDescription} that describes the top level properties of the engine specific configuration
     * @param engineName the name of the engine that you wish to describe the configuration for
     */
    public getEngineConfigDescription(engineName: string): ConfigDescription {
        if (this.engineConfigDescriptions.has(engineName)) {
            return this.engineConfigDescriptions.get(engineName)!;
        }
        throw new Error(getMessage('FailedToGetEngineConfigDescription', engineName));
    }

    /**
     * Selects all rules that match any of the provided rule selectors
     *      A rule selector can either be:
     *        * an engine name (to run all the rules associated with that engine),
     *        * a rule tag (to run all rules with that tag),
     *        * a rule severity level (to run all rules with that severity level),
     *        * or an individual rule name.
     *      To reduce the rules found from one selector with another selector, i.e. to perform an intersection
     *      operation, use a colon to combine both the selectors into one. For example: ["pmd:Recommended"].
     *      Provide more than one rule selector in the array to add the rules found from one selector to the rules found
     *      from another selector, i.e. to perform a union operation. For example: ["pmd", "eslint"].
     * @param selectors array of rule selector strings
     * @param selectOptions optional {@link SelectOptions} instance
     */
    public async selectRules(selectors: string[], selectOptions?: SelectOptions): Promise<RuleSelection> {
        // TODO: Before we expose core to external clients, we might consider throwing an exception if selectRules is
        //  called a second time before the first call to selectRules hasn't finished. This can occur if someone builds
        //  up a bunch of RuleSelection promises and then does a Promise.all on them. Otherwise, the progress events may
        //  override each other.

        this.emitEvent({type: EventType.RuleSelectionProgressEvent, timestamp: this.clock.now(), percentComplete: 0});

        selectors = selectors.length > 0 ? selectors : [engApi.COMMON_TAGS.RECOMMENDED];
        const allRules: RuleImpl[] = await this.getAllRules(selectOptions?.workspace);

        const ruleSelection: RuleSelectionImpl = new RuleSelectionImpl();
        for (const rule of allRules) {
            if (selectors.some(s => rule.matchesRuleSelector(s))) {
                ruleSelection.addRule(rule);
            }
        }

        this.emitEvent({type: EventType.RuleSelectionProgressEvent, timestamp: this.clock.now(), percentComplete: 100});
        return ruleSelection;
    }

    /**
     * Runs all the rules specified by the provided rule selection and returns a {@link RunResults} instance
     * @param ruleSelection {@link RuleSelection} making up the rules that you wish to run
     * @param runOptions {@link RunOptions} containing options including the {@link Workspace} to run the rules against
     */
    public async run(ruleSelection: RuleSelection, runOptions: RunOptions): Promise<RunResults> {
        // TODO: Before we expose core to external clients, we might consider throwing an exception if run is
        //  called a second time before the first call to run hasn't finished. This can occur if someone builds
        //  up a bunch of RunResults promises and then does a Promise.all on them. Otherwise, the progress events may
        //  override each other.

        const engineRunOptions: engApi.RunOptions = await extractEngineRunOptions(runOptions, this.config.getLogFolder());
        this.emitLogEvent(LogLevel.Debug, getMessage('RunningWithRunOptions', JSON.stringify(engineRunOptions,
            (key, value) => key === "expandedFiles" ? undefined : value))); // omit the expandedFiles since it is very large

        const runPromises: Promise<EngineRunResults>[] = ruleSelection.getEngineNames().map(
            engineName => this.runEngineAndValidateResults(engineName, ruleSelection, engineRunOptions));
        const engineRunResultsList: EngineRunResults[] = await Promise.all(runPromises);

        const runResults: RunResultsImpl = new RunResultsImpl(this.clock);
        for (const engineRunResults of engineRunResultsList) {
            runResults.addEngineRunResults(engineRunResults);
        }
        for (const [uninstantiableEngine, error] of this.uninstantiableEnginesMap.entries()) {
            runResults.addEngineRunResults(new UninstantiableEngineRunResults(uninstantiableEngine, error));
        }
        return runResults;
    }

    /**
     * Attach a listener callback to one of the events that Code Analyzer may emit
     *   Example usage:
     *     codeAnalyzer.onEvent(EventType.LogEvent, (evt) => console.log(`${evt.logLevel}: ${evt.message}`));
     * @param eventType The {@link EventType} that you would like to add a callback for
     * @param callback The callback function that should be invoked when an associated event is emitted
     */
    public onEvent<T extends Event>(eventType: T["type"], callback: (event: T) => void): void {
        this.eventEmitter.on(eventType, callback);
    }

    private async getAllRules(workspace?: Workspace): Promise<RuleImpl[]> {
        const cacheKey: string = workspace ? workspace.getWorkspaceId() : process.cwd();
        if (!this.rulesCache.has(cacheKey)) {
            this.engineRuleDiscoveryProgressAggregator.reset(this.getEngineNames());
            const engApiWorkspace: engApi.Workspace | undefined = workspace ? toEngApiWorkspace(workspace) : undefined;
            const rulePromises: Promise<RuleImpl[]>[] = this.getEngineNames().map(engineName =>
                this.getAllRulesFor(engineName, {workspace: engApiWorkspace, logFolder: this.config.getLogFolder()}));
            this.rulesCache.set(cacheKey, (await Promise.all(rulePromises)).flat());
        }
        return this.rulesCache.get(cacheKey)!;
    }

    private async getAllRulesFor(engineName: string, describeOptions: engApi.DescribeOptions): Promise<RuleImpl[]> {
        this.emitLogEvent(LogLevel.Debug, getMessage('GatheringRulesFromEngine', engineName));
        const ruleDescriptions: engApi.RuleDescription[] = await this.getEngine(engineName).describeRules(describeOptions);
        this.emitLogEvent(LogLevel.Debug, getMessage('FinishedGatheringRulesFromEngine', ruleDescriptions.length, engineName));

        validateRuleDescriptions(ruleDescriptions, engineName);
        const rules: RuleImpl[] = ruleDescriptions.map(rd => this.updateRuleDescriptionWithOverrides(engineName, rd))
            .map(rd => new RuleImpl(engineName, rd));
        this.updateRuleGatheringProgressFor(engineName, 100);
        return rules;
    }

    private updateRuleGatheringProgressFor(engineName: string, percComplete: number) {
        this.engineRuleDiscoveryProgressAggregator.setProgressFor(engineName, percComplete);
        const aggregatedPerc: number = this.engineRuleDiscoveryProgressAggregator.getAggregatedProgressPercentage();
        this.emitEvent({type: EventType.RuleSelectionProgressEvent, timestamp: this.clock.now(), percentComplete: aggregatedPerc});
    }

    private async runEngineAndValidateResults(engineName: string, ruleSelection: RuleSelection, engineRunOptions: engApi.RunOptions): Promise<EngineRunResults> {
        this.emitEvent<EngineRunProgressEvent>({
            type: EventType.EngineRunProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 0
        });

        const rulesToRun: string[] = ruleSelection.getRulesFor(engineName).map(r => r.getName());
        this.emitLogEvent(LogLevel.Debug, getMessage('RunningEngineWithRules', engineName, JSON.stringify(rulesToRun)));
        const engine: engApi.Engine = this.getEngine(engineName);

        let apiEngineRunResults: engApi.EngineRunResults;
        try {
            apiEngineRunResults = await engine.runRules(rulesToRun, engineRunOptions);
        } catch (error) {
            return new UnexpectedErrorEngineRunResults(engineName, await engine.getEngineVersion(), error as Error);
        }

        validateEngineRunResults(engineName, apiEngineRunResults, ruleSelection);
        const engineRunResults: EngineRunResults = new EngineRunResultsImpl(engineName, await engine.getEngineVersion(), apiEngineRunResults, ruleSelection);

        this.emitEvent<EngineRunProgressEvent>({
            type: EventType.EngineRunProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 100
        });
        this.emitLogEvent(LogLevel.Debug, getMessage('FinishedRunningEngine', engineName));
        this.emitEvent<EngineResultsEvent>({
            type: EventType.EngineResultsEvent, timestamp: this.clock.now(), results: engineRunResults
        });
        return engineRunResults;
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

        const engineOverrides: EngineOverrides = this.config.getEngineOverridesFor(engineName);

        try {
            const engineConfigDescription: engApi.ConfigDescription = enginePluginV1.describeEngineConfig(engineName);
            const configDescription: ConfigDescription = toConfigDescription(engineConfigDescription, engineName, engineOverrides);
            this.engineConfigDescriptions.set(engineName, configDescription);
        } catch (err) {
            this.uninstantiableEnginesMap.set(engineName, err as Error);
            this.emitLogEvent(LogLevel.Error, getMessage('PluginErrorWhenCreatingEngine', engineName, (err as Error).message + '\n\n' +
                getMessage('InstructionsToIgnoreErrorAndDisableEngine', engineName)));
            return;
        }

        if (engApi.getValueUsingCaseInsensitiveKey(engineOverrides, FIELDS.DISABLE_ENGINE)) {
            this.emitLogEvent(LogLevel.Debug, getMessage('EngineDisabled', engineName,
                `${FIELDS.ENGINES}.${engineName}.${FIELDS.DISABLE_ENGINE}`))
            // If engine is disabled then instead of returning no config, we simply return whatever overrides the user gave.
            this.engineConfigs.set(engineName, engineOverrides);
            return;
        }

        const engineConfigValueExtractor: engApi.ConfigValueExtractor = new engApi.ConfigValueExtractor(
            engineOverrides as engApi.ConfigObject, `${FIELDS.ENGINES}.${engineName}`, this.config.getConfigRoot());

        // We mark 'disable_engine' as a key that the extractor should not worry about with validation so that each
        // engine doesn't need to list it when using the validateContainsOnlySpecifiedKeys method.
        engineConfigValueExtractor.addKeysThatBypassValidation([FIELDS.DISABLE_ENGINE]);

        try {
            const engineConfig: engApi.ConfigObject = await enginePluginV1.createEngineConfig(engineName, engineConfigValueExtractor);
            const engine: engApi.Engine = await enginePluginV1.createEngine(engineName, engineConfig);
            if (engineName != engine.getName()) {
                this.emitLogEvent(LogLevel.Error, getMessage('EngineNameContradiction', engineName, engine.getName()));
                return;
            }
            this.engines.set(engineName, engine);
            this.engineConfigs.set(engineName, {...engineConfig, [FIELDS.DISABLE_ENGINE]: false});
            this.listenToEngineEvents(engine);

        } catch (err) {
            this.uninstantiableEnginesMap.set(engineName, err as Error);
            this.emitLogEvent(LogLevel.Error, getMessage('PluginErrorWhenCreatingEngine', engineName, (err as Error).message + '\n\n' +
                getMessage('InstructionsToIgnoreErrorAndDisableEngine', engineName)));
            return;
        }

        this.emitLogEvent(LogLevel.Debug, getMessage('EngineAdded', engineName));
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

        engine.onEvent(engApi.EventType.DescribeRulesProgressEvent, (event: engApi.DescribeRulesProgressEvent) => {
            this.updateRuleGatheringProgressFor(engine.getName(), event.percentComplete);
        });

        engine.onEvent(engApi.EventType.RunRulesProgressEvent, (event: engApi.RunRulesProgressEvent) => {
            this.emitEvent<EngineRunProgressEvent>({
                type: EventType.EngineRunProgressEvent,
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                message: event.message,
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
        return this.engines.get(engineName)!;
    }
}

/**
 * The runtime implementation of the Workspace interface that is returned from CodeAnalyzer's createWorkspace method
 * This serves as a layer of indirection between the engine api and the client so that if the engine api changes, the
 * clients do not need to change.
 */
class WorkspaceImpl implements Workspace {
    private readonly delegate: engApi.Workspace;
    constructor(absFilesAndFolders: string[], workspaceId: string) {
        this.delegate = new engApi.Workspace(absFilesAndFolders, workspaceId);
    }

    getWorkspaceId(): string {
        return this.delegate.getWorkspaceId();
    }

    getFilesAndFolders(): string[] {
        return this.delegate.getFilesAndFolders();
    }

    _toEngApiWorkspace(): engApi.Workspace {
        return this.delegate;
    }
}

function toEngApiWorkspace(workspace: Workspace): engApi.Workspace {
    if (workspace instanceof WorkspaceImpl) {
        return (workspace as WorkspaceImpl)._toEngApiWorkspace();
    }
    return new engApi.Workspace(workspace.getFilesAndFolders(), workspace.getWorkspaceId());
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

async function extractEngineRunOptions(runOptions: RunOptions, logFolder: string): Promise<engApi.RunOptions> {
    if(runOptions.workspace.getFilesAndFolders().length == 0) {
        throw new Error(getMessage('AtLeastOneFileOrFolderMustBeIncluded'));
    }
    const engineRunOptions: engApi.RunOptions = {
        logFolder: logFolder,
        workspace: toEngApiWorkspace(runOptions.workspace),
    };
    if (runOptions.pathStartPoints && runOptions.pathStartPoints.length > 0) {
        const pathStartPointPromises: Promise<engApi.PathPoint[]>[] = runOptions.pathStartPoints.map(extractEnginePathStartPoints);
        engineRunOptions.pathStartPoints = (await Promise.all(pathStartPointPromises)).flat();
    }
    validatePathStartPointsAreInsideWorkspace(engineRunOptions);
    return engineRunOptions;
}

async function validateFileOrFolder(fileOrFolder: string): Promise<string> {
    const absFileOrFolder: string = toAbsolutePath(fileOrFolder);
    try {
        // This is the most efficient way to check if a file or folder exists
        await fs.promises.access(absFileOrFolder);
    } catch {
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

async function extractEnginePathStartPoints(pathStartPointStr: string): Promise<engApi.PathPoint[]> {
    const parts: string[] = pathStartPointStr.split('#');
    if (parts.length == 1) {
        return [{
            file: await validateFileOrFolder(pathStartPointStr)
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

function validatePathStartPointsAreInsideWorkspace(engineRunOptions: engApi.RunOptions): void {
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

function validateViolationRuleName(violation: engApi.Violation, engineName: string, ruleSelection: RuleSelection): void {
    try {
        ruleSelection.getRule(engineName, violation.ruleName);
    } catch (error) {
        throw new Error(getMessage('EngineReturnedViolationForUnselectedRule', engineName, violation.ruleName), {cause: error});
    }
}

function validateViolationPrimaryLocationIndex(violation: engApi.Violation, engineName: string): void {
    if (!isIntegerBetween(violation.primaryLocationIndex, 0, violation.codeLocations.length-1)) {
        throw new Error(getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex',
            engineName, violation.ruleName, violation.primaryLocationIndex, violation.codeLocations.length));
    }
}

function validateViolationCodeLocations(violation: engApi.Violation, engineName: string): void {
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

function isValidLineOrColumn(value: number): boolean {
    return isIntegerBetween(value, 1, Number.MAX_VALUE);
}

function isIntegerBetween(value: number, leftBound: number, rightBound: number): boolean {
    return value >= leftBound && value <= rightBound && Number.isInteger(value);
}

/**
 * Converts an engApi.ConfigDescription into a normalized ConfigDescription
 */
function toConfigDescription(engineConfigDescription: engApi.ConfigDescription, engineName: string,
                             engineOverrides: EngineOverrides): ConfigDescription {
    const configDescription: ConfigDescription = {
        // Every engine config should have an overview, so if missing, then we add in a generic one
        overview: engineConfigDescription.overview ? engineConfigDescription.overview :
            getMessage('GenericEngineConfigOverview', engineName.toUpperCase()),

        fieldDescriptions: {
            // Every engine config should have a disable_engine field which we prefer to be first in the object for display purposes
            [FIELDS.DISABLE_ENGINE]: {
                descriptionText: getMessage('EngineConfigFieldDescription_disable_engine', engineName),
                valueType: "boolean",
                defaultValue: false,
                wasSuppliedByUser: wasFieldSuppliedByUser(engineOverrides, FIELDS.DISABLE_ENGINE)
            }
        }
    }
    for (const fieldName in engineConfigDescription.fieldDescriptions) {
        configDescription.fieldDescriptions[fieldName] = {
            ... engineConfigDescription.fieldDescriptions[fieldName],
            wasSuppliedByUser: wasFieldSuppliedByUser(engineOverrides, fieldName)
        };
    }
    return configDescription;
}

function wasFieldSuppliedByUser(engineOverrides: EngineOverrides, fieldName: string): boolean {
    const correctedFieldName: string | undefined = findCaseInsensitiveKey(engineOverrides, fieldName);
    return correctedFieldName !== undefined &&
        engineOverrides[correctedFieldName] !== null &&
        engineOverrides[correctedFieldName] !== undefined;
}

function findCaseInsensitiveKey(obj: object, key: string): string | undefined {
    return Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
}