import {pathToFileURL} from "node:url";
import {RuleImpl, RuleSelection, RuleSelectionImpl} from "./rules"
import {
    EngineRunResults,
    EngineRunResultsImpl,
    RunResults,
    RunResultsImpl,
    UnexpectedErrorEngineRunResults,
    UninstantiableEngineRunResults,
    Violation
} from "./results"
import {processSuppressions, extractSuppressionsFromFiles, SuppressionsMap, LoggerCallback} from "./suppressions"
import {applyBulkSuppressions, BulkSuppressionQuotas} from "./suppressions/bulk-suppression-processor"
import {SemVer} from 'semver';
import {
    EngineLogEvent,
    EngineResultsEvent,
    EngineRunProgressEvent,
    EngineTelemetryEvent,
    Event,
    EventType,
    LogLevel,
    TelemetryData
} from "./events"
import {getMessage} from "./messages";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {Clock, RealClock} from '@salesforce/code-analyzer-engine-api/utils';
import {Selector, toSelector} from "./selectors";
import {EventEmitter} from "node:events";
import {CodeAnalyzerConfig, ConfigDescription, EngineOverrides, FIELDS, Ignores, RuleOverride} from "./config";
import {
    EngineProgressAggregator,
    FileSystem,
    RealFileSystem,
    RuntimeUniqueIdGenerator,
    TempFolder,
    toAbsolutePath,
    UniqueIdGenerator
} from "./utils";
import fs from "node:fs";
import path from 'node:path';

/**
 * Interface for workspaces
 */
export interface Workspace {
    /**
     * Returns the identifier associated with the workspace
     */
    getWorkspaceId(): string

    /**
     * Returns the longest root folder that contains all the workspace paths or null if one does not exist.
     * For example, if the workspace was constructed with "/some/folder/subFolder/file1.txt" and
     * "/some/folder/file2.txt", then the workspace root folder would be equal to "/some/folder".
     * Returns null if a root folder does not exist (e.g., paths from different drives).
     */
    getWorkspaceRoot(): string | null

    /**
     * Returns the unique list of files and folders that were used to construct the workspace.
     */
    getRawFilesAndFolders(): string[]

    /**
     * Returns the unique list of targets that were provided when constructing the workspace or undefined if none were provided.
     */
    getRawTargets(): string[] | undefined;

    /**
     * Returns list of files that an engine should target in its analysis.
     *
     * This method returns the full list of the absolute file paths recursively found within the provided targets.
     */
    getTargetedFiles(): Promise<string[]>

    /**
     * The list of files that make up a user's workspace that engines may use to support its analysis of the targeted files.
     *
     * This method returns the full list of the absolute file paths recursively found within the workspace.
     */
    getWorkspaceFiles(): Promise<string[]>
}

/**
 * Optional options available to the selectRules method of the CodeAnalyzer class
 */
export type SelectOptions = {
    /** Object that specifies the user's workspace and which files should be targeted in order to select only the relevant rules. */
    workspace?: Workspace
}

/**
 * Options available to the run method of the CodeAnalyzer class
 */
export type RunOptions = {
    /** Object that specifies the user's workspace and which files should be targeted in the run analysis. */
    workspace: Workspace

    /** When true, engines should include fix data on violations when available. */
    includeFixes?: boolean

    /** When true, engines should include suggestion data on violations when available. */
    includeSuggestions?: boolean
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
    private readonly tempFolder: TempFolder;
    private clock: Clock = new RealClock();
    private uniqueIdGenerator: UniqueIdGenerator = new RuntimeUniqueIdGenerator();
    private readonly eventEmitter: EventEmitter = new EventEmitter();
    private readonly engines: Map<string, engApi.Engine> = new Map();
    private readonly uninstantiableEnginesMap: Map<string, Error> = new Map();
    private readonly engineConfigs: Map<string, EngineConfig> = new Map();
    private readonly engineConfigDescriptions: Map<string, ConfigDescription> = new Map();
    private readonly rulesCache: Map<string, RuleImpl[]> = new Map();
    private readonly engineRuleDiscoveryProgressAggregator: EngineProgressAggregator = new EngineProgressAggregator();
    // Caching for per-engine suppression processing to avoid duplicate file processing
    private readonly suppressionsMap: SuppressionsMap = new Map();
    private readonly fileProcessingPromises: Map<string, Promise<void>> = new Map();
    // Track suppressed violations for aggregate logging (separated by type)
    private totalInlineSuppressedViolations: number = 0;
    private totalBulkSuppressedViolations: number = 0;
    // Bulk suppression quota tracking (shared across files, scoped to config paths)
    private readonly bulkSuppressionQuotas: BulkSuppressionQuotas = new Map();
    // Current workspace root (set during run, used for bulk suppression path resolution)
    private currentWorkspaceRoot: string | null = null;

    constructor(config: CodeAnalyzerConfig, fileSystem: FileSystem = new RealFileSystem(), nodeVersion: string = process.version) {
        this.validateEnvironment(nodeVersion);
        this.config = config;
        this.tempFolder = new TempFolder(fileSystem, this.config.getRootWorkingFolder());
        /* istanbul ignore next */
        process.addListener('exit', async () => {
            // Note that on node exit there is no more event loop, so removal must take place synchronously
            this.tempFolder.removeSyncIfNotKept();
        });
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
    _setClock(clock: Clock): void {
        this.clock = clock;
    }
    _setUniqueIdGenerator(uniqueIdGenerator: UniqueIdGenerator): void {
        this.uniqueIdGenerator = uniqueIdGenerator;
    }

    /**
     * Convenience method to return the same CodeAnalyzerConfig instance that was provided to the constructor
     */
    public getConfig(): CodeAnalyzerConfig {
        return this.config;
    }

    /**
     * Creates a {@link Workspace} instance associated with a specified list of files and folders.
     *
     * Additionally, a list of target files and/or folders can be provided which helps engines limit which files they
     * should perform a scan on while still being fully aware of all the files in the workspace. All targeted files
     * must exist within the workspace. For example, some engines may depend on other files in your project to properly
     * analyze the few files that you are targeting. If a targets array is not specified, then the entire list of
     * workspaces files and folders will be targeted.
     *
     * Files matching patterns specified in the ignores.files configuration will be excluded from the workspace.
     *
     * @param workspaceFilesAndFolders string array of files and/or folders to include in the workspace
     * @param targets optional string array of files and/or folders
     */
    public async createWorkspace(workspaceFilesAndFolders: string[], targets?: string[]): Promise<Workspace> {
        const workspaceId: string = this.uniqueIdGenerator.getLocallyUniqueId('workspace');
        const workspaceValidationPromises: Promise<string>[] = workspaceFilesAndFolders.map(validateFileOrFolder);
        const validatedWorkspaceFilesAndFolders: string[] = (await Promise.all(workspaceValidationPromises)).flat();
        if (validatedWorkspaceFilesAndFolders.length === 0) {
            throw new Error(getMessage('AtLeastOneFileOrFolderMustBeIncludedInWorkspace'));
        }

        let validatedTargets: string[] | undefined = undefined;
        if (targets != undefined && targets.length > 0) {
            const targetPromises: Promise<string>[] = targets.map(t => validateTarget(t, validatedWorkspaceFilesAndFolders));
            validatedTargets = (await Promise.all(targetPromises)).flat();
        }

        // Get ignore patterns from config
        const ignores: Ignores = this.config.getIgnores();
        const ignorePatterns: string[] = ignores.files;

        const workspace: Workspace = new WorkspaceImpl(workspaceId, validatedWorkspaceFilesAndFolders, validatedTargets, ignorePatterns);

        // It appears that each of the engines is calling these methods all at the same time and so if we had N engines
        // each creating N promises, the cache hasn't been populated, and so we are doing the work N times. If we
        // instead invoke these immediately and cache the results, then when the engines call these, the cache will
        // already be populated, thus giving a big performance boost.
        await workspace.getWorkspaceFiles();
        await workspace.getTargetedFiles();

        return workspace;
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

            // Validate file extension before attempting dynamic import (Jest 30.4+ tries to parse non-JS files as ESM)
            const validExtensions = ['.js', '.mjs', '.cjs', '.ts', '.tsx'];
            if (!validExtensions.includes(path.extname(resolvedModulePath))) {
                throw new Error(`File is not a JavaScript module: ${resolvedModulePath}`);
            }

            pluginModule = await dynamicallyImport(resolvedModulePath);
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
        const selectorObjects: Selector[] = selectors.map(toSelector);

        const allRules: RuleImpl[] = await this.getAllRules(selectOptions?.workspace);

        const ruleSelection: RuleSelectionImpl = new RuleSelectionImpl();
        const disabledRules: {ruleName: string, engineName: string}[] = [];

        for (const rule of allRules) {
            // Skip rules that don't match any selector
            if (!selectorObjects.some(o => rule.matchesRuleSelector(o))) {
                continue;
            }

            // Skip rules that are disabled in the config
            const ruleOverride = this.config.getRuleOverrideFor(rule.getEngineName(), rule.getName());
            if (ruleOverride.disabled === true) {
                disabledRules.push({ruleName: rule.getName(), engineName: rule.getEngineName()});
                continue;
            }

            ruleSelection.addRule(rule);
        }

        // Log all disabled rules at once
        if (disabledRules.length > 0) {
            this.emitLogEvent(LogLevel.Info, getMessage('RulesDisabledInConfig',
                disabledRules.length,
                disabledRules.map(r => `${r.engineName}:${r.ruleName}`).join(', ')));
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

        // Reset suppression counters for this run
        this.totalInlineSuppressedViolations = 0;
        this.totalBulkSuppressedViolations = 0;

        // Clear suppression caches from previous runs to prevent unbounded memory growth
        // Each run typically analyzes a different workspace, so caching across runs provides minimal benefit
        // while keeping stale data in memory.
        this.suppressionsMap.clear();
        this.fileProcessingPromises.clear();
        this.bulkSuppressionQuotas.clear();

        // Store workspace root for bulk suppression path resolution (consistent with ignores feature)
        // Falls back to config root if workspace root is null (e.g., files from different drives)
        this.currentWorkspaceRoot = runOptions.workspace.getWorkspaceRoot() || this.config.getConfigRoot();

        this.emitLogEvent(LogLevel.Debug, getMessage('RunningWithWorkspace', JSON.stringify({
            filesAndFolders: runOptions.workspace.getRawFilesAndFolders(),
            targets: runOptions.workspace.getRawTargets()
        })));

        const engApiWorkspace: engApi.Workspace = toEngApiWorkspace(runOptions.workspace);
        const runWorkingFolderName: string = `run-${this.clock.formatToDateTimeString()}`;
        await this.tempFolder.makeSubfolder(runWorkingFolderName);

        const runPromises: Promise<EngineRunResults>[] = ruleSelection.getEngineNames().map(async (engineName) => {
            const workingFolder: string = await this.tempFolder.makeSubfolder(runWorkingFolderName, engineName);
            if (this.config.getPreserveAllWorkingFolders()) {
                this.tempFolder.markToBeKept(runWorkingFolderName, engineName);
            }
            const engineRunOptions: engApi.RunOptions = {
                logFolder: this.config.getLogFolder(),
                workingFolder: workingFolder,
                workspace: engApiWorkspace,
                includeFixes: runOptions.includeFixes,
                includeSuggestions: runOptions.includeSuggestions
            };
            const errorCallback: () => void = () => {
                // istanbul ignore else
                if (!this.tempFolder.isKept(runWorkingFolderName, engineName)) {
                    this.emitLogEvent(LogLevel.Debug, getMessage('EngineWorkingFolderKeptDueToError', engineName, workingFolder));
                    this.tempFolder.markToBeKept(runWorkingFolderName, engineName);
                }
            };
            const results: EngineRunResults = await this.runEngineAndValidateResults(engineName, ruleSelection, engineRunOptions, errorCallback);
            await this.tempFolder.removeIfNotKept(runWorkingFolderName, engineName);
            return results;
        });
        if (this.config.getPreserveAllWorkingFolders()) {
            this.emitLogEvent(LogLevel.Debug, getMessage('AllWorkingFoldersKept', await this.tempFolder.getPath(runWorkingFolderName)));
        }
        const engineRunResultsList: EngineRunResults[] = await Promise.all(runPromises);

        await this.tempFolder.removeIfNotKept(runWorkingFolderName);

        const runResults: RunResultsImpl = new RunResultsImpl(this.clock);
        for (const engineRunResults of engineRunResultsList) {
            runResults.addEngineRunResults(engineRunResults);
        }
        for (const [uninstantiableEngine, error] of this.uninstantiableEnginesMap.entries()) {
            runResults.addEngineRunResults(new UninstantiableEngineRunResults(uninstantiableEngine, error));
        }
        if (!this.config.getSuppressionsEnabled()) {
            return runResults;
        }
        // Note: Inline and bulk suppressions are now applied per-engine in runEngineAndValidateResults() before EngineResultsEvent is emitted
        // Log aggregate suppression counts if any violations were suppressed (separate messages for inline vs bulk)
        if (this.totalInlineSuppressedViolations > 0) {
            this.emitLogEvent(LogLevel.Info, getMessage('InlineSuppressedViolationsCount', this.totalInlineSuppressedViolations));
        }
        if (this.totalBulkSuppressedViolations > 0) {
            this.emitLogEvent(LogLevel.Info, getMessage('BulkSuppressedViolationsCount', this.totalBulkSuppressedViolations));
        }

        return runResults;
    }

    /**
     * Applies suppression filtering to a single engine's results
     * This processes suppression markers in source files and returns a filtered version of the engine results
     * This method handles race conditions by caching suppression ranges per file
     * @param engineRunResults The engine run results to apply suppressions to
     * @returns Filtered engine run results with suppressions applied
     */
    private async applyInlineSuppressionsToEngineResults(
        engineRunResults: EngineRunResults
    ): Promise<EngineRunResults> {
        // Check if suppressions are enabled
        if (!this.config.getSuppressionsEnabled()) {
            return engineRunResults; // Feature disabled, return original results
        }

        const violations = engineRunResults.getViolations();

        if (violations.length === 0) {
            return engineRunResults; // No violations to process
        }

        // Extract unique file paths from violations for race condition handling
        const filePaths = new Set<string>();
        for (const violation of violations) {
            const primaryLocation = violation.getPrimaryLocation();
            const file = primaryLocation.getFile();
            if (file) {
                filePaths.add(file);
            }
        }

        if (filePaths.size === 0) {
            return engineRunResults; // No files with violations
        }

        // Process files with race condition handling to pre-populate the shared map
        await this.processFilesForSuppressions(filePaths);

        // Use processSuppressions with the pre-populated shared map
        // This will skip re-parsing files already in the map and just filter violations
        const logger: LoggerCallback = (level: 'error' | 'warn' | 'debug', message: string) => {
            const logLevel = level === 'error' ? LogLevel.Error : level === 'warn' ? LogLevel.Warn : LogLevel.Debug;
            this.emitLogEvent(logLevel, message);
        };
        const filteredViolations = await processSuppressions(violations, logger, this.suppressionsMap);

        // Calculate how many violations were suppressed
        const suppressedCount = violations.length - filteredViolations.length;

        // If all violations remain (nothing suppressed), return original results
        if (suppressedCount === 0) {
            return engineRunResults;
        }

        // Track inline suppressed violations for aggregate logging
        this.totalInlineSuppressedViolations += suppressedCount;

        // Return filtered results using FilteredEngineRunResults wrapper
        return this.createFilteredEngineRunResults(engineRunResults, filteredViolations);
    }

    /**
     * Creates a FilteredEngineRunResults wrapper
     * This is a temporary method until FilteredEngineRunResults is exported from results.ts
     */
    private createFilteredEngineRunResults(
        originalResults: EngineRunResults,
        filteredViolations: Violation[]
    ): EngineRunResults {
        // We need to create an instance that implements EngineRunResults
        // but filters the violations
        return {
            getEngineName: () => originalResults.getEngineName(),
            getEngineVersion: () => originalResults.getEngineVersion(),
            getViolationCount: () => filteredViolations.length,
            getViolationCountOfSeverity: (severity: number) =>
                filteredViolations.filter(v => v.getRule().getSeverityLevel() === severity).length,
            getViolations: () => filteredViolations
        };
    }

    /**
     * Applies bulk suppression filtering to a single engine's results
     * This processes bulk suppression rules from config and returns a filtered version of the engine results
     * @param engineRunResults The engine run results to apply bulk suppressions to
     * @returns Filtered engine run results with bulk suppressions applied
     */
    private applyBulkSuppressionsToEngineResults(
        engineRunResults: EngineRunResults
    ): EngineRunResults {
        // Check if suppressions are enabled
        if (!this.config.getSuppressionsEnabled()) {
            return engineRunResults;
        }

        const violations = engineRunResults.getViolations();
        if (violations.length === 0) {
            return engineRunResults;
        }

        const bulkConfig = this.config.getBulkSuppressions();
        if (Object.keys(bulkConfig).length === 0) {
            return engineRunResults; // No bulk suppressions configured
        }

        // Use workspace root for path resolution (consistent with ignores feature)
        // This is set during run() and should never be null at this point
        const workspaceRoot = this.currentWorkspaceRoot || this.config.getConfigRoot();

        const bulkResult = applyBulkSuppressions(
            violations,
            bulkConfig,
            this.bulkSuppressionQuotas,
            workspaceRoot
        );

        const suppressedCount = bulkResult.suppressedCount;

        // If nothing was suppressed, return original results
        if (suppressedCount === 0) {
            return engineRunResults;
        }

        // Track bulk suppressed violations for aggregate logging
        this.totalBulkSuppressedViolations += suppressedCount;

        // Return filtered results
        return this.createFilteredEngineRunResults(engineRunResults, bulkResult.unsuppressedViolations);
    }

    /**
     * Processes files for suppression markers with race condition handling
     * Uses caching to avoid processing the same file multiple times when multiple engines
     * return violations for the same file
     * @param filePaths Set of file paths that need suppression information
     */
    private async processFilesForSuppressions(filePaths: Set<string>): Promise<void> {
        const logger: LoggerCallback = (level: 'error' | 'warn' | 'debug', message: string) => {
            const logLevel = level === 'error' ? LogLevel.Error : level === 'warn' ? LogLevel.Warn : LogLevel.Debug;
            this.emitLogEvent(logLevel, message);
        };

        const processingPromises: Promise<void>[] = [];

        for (const filePath of filePaths) {
            // If already in cache, skip
            if (this.suppressionsMap.has(filePath)) {
                continue;
            }

            // If currently being processed, await that promise
            let processingPromise = this.fileProcessingPromises.get(filePath);

            if (!processingPromise) {
                // Start new processing - wrap extractSuppressionsFromFiles call
                processingPromise = extractSuppressionsFromFiles(
                    new Set([filePath]),
                    this.suppressionsMap,
                    logger
                ).then(() => {
                    // Clean up the promise from tracking map since it's done
                    this.fileProcessingPromises.delete(filePath);
                }).catch((err) => {
                    // Clean up on error too
                    this.fileProcessingPromises.delete(filePath);
                    throw err;
                });

                this.fileProcessingPromises.set(filePath, processingPromise);
            }

            processingPromises.push(processingPromise);
        }

        // Wait for all file processing to complete
        await Promise.all(processingPromises);
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
            const rulesWorkingFolderName: string = `rules-${this.clock.formatToDateTimeString()}`;

            await this.tempFolder.makeSubfolder(rulesWorkingFolderName);

            const rulePromises: Promise<RuleImpl[]>[] = this.getEngineNames().map(async (engineName) => {
                const workingFolder: string = await this.tempFolder.makeSubfolder(rulesWorkingFolderName, engineName);

                if (this.config.getPreserveAllWorkingFolders()) {
                    this.tempFolder.markToBeKept(rulesWorkingFolderName, engineName)
                }

                const describeOptions: engApi.DescribeOptions = {
                    workspace: engApiWorkspace,
                    workingFolder: workingFolder,
                    logFolder: this.config.getLogFolder()
                };
                const errorCallback: () => void = () => {
                    if (!this.tempFolder.isKept(rulesWorkingFolderName, engineName)) {
                        this.emitLogEvent(LogLevel.Debug, getMessage('EngineWorkingFolderKeptDueToError', engineName, workingFolder));
                        this.tempFolder.markToBeKept(rulesWorkingFolderName, engineName);
                    }
                };
                const rules: RuleImpl[] = await this.getAllRulesFor(engineName, describeOptions, errorCallback);
                await this.tempFolder.removeIfNotKept(rulesWorkingFolderName, engineName);
                return rules;
            });

            if (this.config.getPreserveAllWorkingFolders()) {
                this.emitLogEvent(LogLevel.Debug, getMessage('AllWorkingFoldersKept', await this.tempFolder.getPath(rulesWorkingFolderName)));
            }

            this.rulesCache.set(cacheKey, (await Promise.all(rulePromises)).flat());

            await this.tempFolder.removeIfNotKept(rulesWorkingFolderName);
        }
        return this.rulesCache.get(cacheKey)!;
    }

    private async getAllRulesFor(engineName: string, describeOptions: engApi.DescribeOptions, errorCallback: () => void): Promise<RuleImpl[]> {
        this.emitLogEvent(LogLevel.Debug, getMessage('GatheringRulesFromEngine', engineName));
        const invokeErrorCallbackIfErrorIsLoggedFcn = (event: engApi.LogEvent) => {
            if (event.logLevel === engApi.LogLevel.Error) {
                errorCallback();
            }
        };

        const engine: engApi.Engine = this.getEngine(engineName);
        engine.onEvent(engApi.EventType.LogEvent, invokeErrorCallbackIfErrorIsLoggedFcn);

        let ruleDescriptions: engApi.RuleDescription[] = [];
        try {
            ruleDescriptions = await engine.describeRules(describeOptions);
        } catch (err) {
            errorCallback();
            this.uninstantiableEnginesMap.set(engineName, err as Error);
            this.emitLogEvent(LogLevel.Error, getMessage('PluginErrorWhenGettingRules', engineName, (err as Error).message + '\n\n' +
                getMessage('InstructionsToIgnoreErrorAndDisableEngine', engineName)));
            return [];
        } finally {
            engine.removeEventListener(engApi.EventType.LogEvent, invokeErrorCallbackIfErrorIsLoggedFcn);
        }

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

    private async runEngineAndValidateResults(engineName: string, ruleSelection: RuleSelection, engineRunOptions: engApi.RunOptions, errorCallback: () => void): Promise<EngineRunResults> {
        this.emitEvent<EngineRunProgressEvent>({
            type: EventType.EngineRunProgressEvent, timestamp: this.clock.now(), engineName: engineName, percentComplete: 0
        });
        const rulesToRun: string[] = ruleSelection.getRulesFor(engineName).map(r => r.getName());

        this.emitLogEvent(LogLevel.Debug, getMessage('RunningEngineWithRules', engineName, JSON.stringify(rulesToRun)));
        const invokeErrorCallbackIfErrorIsLoggedFcn = (event: engApi.LogEvent) => {
            if (event.logLevel === engApi.LogLevel.Error) {
                errorCallback();
            }
        };
        const engine: engApi.Engine = this.getEngine(engineName);
        engine.onEvent(engApi.EventType.LogEvent, invokeErrorCallbackIfErrorIsLoggedFcn);

        let apiEngineRunResults: engApi.EngineRunResults;
        try {
            apiEngineRunResults = await engine.runRules(rulesToRun, engineRunOptions);
        } catch (error) {
            errorCallback();
            return new UnexpectedErrorEngineRunResults(engineName, await engine.getEngineVersion(), error as Error);
        } finally {
            engine.removeEventListener(engApi.EventType.LogEvent, invokeErrorCallbackIfErrorIsLoggedFcn);
        }

        validateEngineRunResults(engineName, apiEngineRunResults, ruleSelection);
        let engineRunResults: EngineRunResults = new EngineRunResultsImpl(engineName, await engine.getEngineVersion(), apiEngineRunResults, ruleSelection);

        // Apply inline suppressions per-engine BEFORE emitting EngineResultsEvent
        engineRunResults = await this.applyInlineSuppressionsToEngineResults(engineRunResults);

        // Apply bulk suppressions per-engine AFTER inline suppressions, still BEFORE emitting EngineResultsEvent
        engineRunResults = this.applyBulkSuppressionsToEngineResults(engineRunResults);

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
        if (this.config.getLogLevel() < logLevel) {
            // Do not emit log events whose level is greater than what the user has configured to display in their logs
            return;
        }
        this.emitEvent({
            type: EventType.LogEvent,
            timestamp: this.clock.now(),
            logLevel: logLevel,
            message: message
        })
    }

    // This method is currently unused, so no coverage is possible. However, it's going to be used very shortly, so we're
    // adding it now and just disabling the coverage check for it.
    // istanbul ignore next
    private emitTelemetryEvent(eventName: string, data: TelemetryData): void {
        this.emitEvent({
            type: EventType.TelemetryEvent,
            timestamp: this.clock.now(),
            eventName,
            uuid: this.uniqueIdGenerator.getUniversallyUniqueId(),
            data
        });
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
            if (this.config.getLogLevel() < event.logLevel) {
                // Do not emit log events whose level is greater than what the user has configured to display in their logs
                return;
            }
            this.emitEvent<EngineLogEvent>({
                type: EventType.EngineLogEvent,
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                logLevel: event.logLevel as LogLevel,
                message: event.message
            });
        });

        engine.onEvent(engApi.EventType.TelemetryEvent, (event: engApi.TelemetryEvent) => {
            this.emitEvent<EngineTelemetryEvent>({
                timestamp: this.clock.now(),
                engineName: engine.getName(),
                type: EventType.EngineTelemetryEvent,
                eventName: event.eventName,
                uuid: this.uniqueIdGenerator.getUniversallyUniqueId(),
                data: event.data
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
        if (ruleOverride.severity && ruleDescription.severityLevel !== ruleOverride.severity) {
            this.emitLogEvent(LogLevel.Debug, getMessage('RulePropertyOverridden', FIELDS.SEVERITY,
                ruleDescription.name, engineName, ruleDescription.severityLevel, ruleOverride.severity));
            ruleDescription.severityLevel = ruleOverride.severity as engApi.SeverityLevel;
        }
        if (ruleOverride.tags && JSON.stringify(ruleDescription.tags) !== JSON.stringify(ruleOverride.tags)) {
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
 * The runtime implementation of the Workspace interface that is returned from CodeAnalyzer's createWorkspace method.
 * This serves as a layer of indirection between the engine api and the client so that if the engine api changes, the
 * clients do not need to change.
 */
class WorkspaceImpl implements Workspace {
    private readonly delegate: engApi.Workspace;

    constructor(workspaceId: string, absWorkspaceFilesAndFolders: string[], absTargets?: string[], ignorePatterns: string[] = []) {
        // Pass ignore patterns directly to engApi.Workspace which handles filtering internally
        this.delegate = new engApi.Workspace(workspaceId, absWorkspaceFilesAndFolders, absTargets, ignorePatterns);
    }

    getWorkspaceId(): string {
        return this.delegate.getWorkspaceId();
    }

    getWorkspaceRoot(): string | null {
        return this.delegate.getWorkspaceRoot();
    }

    getRawFilesAndFolders(): string[] {
        return this.delegate.getRawFilesAndFolders();
    }

    getRawTargets(): string[] | undefined {
        return this.delegate.getRawTargets();
    }

    async getWorkspaceFiles(): Promise<string[]> {
        return this.delegate.getWorkspaceFiles();
    }

    async getTargetedFiles(): Promise<string[]> {
        return this.delegate.getTargetedFiles();
    }

    _toEngApiWorkspace(): engApi.Workspace {
        return this.delegate;
    }
}

function toEngApiWorkspace(workspace: Workspace): engApi.Workspace {
    if (workspace instanceof WorkspaceImpl) {
        return (workspace as WorkspaceImpl)._toEngApiWorkspace();
    }
    return new engApi.Workspace(workspace.getWorkspaceId(), workspace.getRawFilesAndFolders(), workspace.getRawTargets());
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

async function validateTarget(fileFolderOrMethod: string, workspaceFilesAndFolders: string[]): Promise<string> {
    const absFileOrFolderTarget: string = await validateFileOrFolder(fileFolderOrMethod);
    validateTargetLivesWithinWorkspace(absFileOrFolderTarget, workspaceFilesAndFolders);
    return absFileOrFolderTarget;
}

function validateTargetLivesWithinWorkspace(target: string, workspaceFilesAndFolders: string[]): void {
    if (!workspaceFilesAndFolders.some(workspacePath => target.startsWith(workspacePath))) {
        throw new Error(getMessage('TargetMustLiveWithinWorkspace', target, JSON.stringify(workspaceFilesAndFolders)));
    }
}

function validateEngineRunResults(engineName: string, apiEngineRunResults: engApi.EngineRunResults, ruleSelection: RuleSelection): void {
    for (const violation of apiEngineRunResults.violations) {
        validateViolationRuleName(violation, engineName, ruleSelection);
        validateViolationCodeLocations(violation, engineName);
        validateViolationPrimaryLocationIndex(violation, engineName);
        validateFixCodeLocations(violation, engineName);
        validateSuggestionCodeLocations(violation, engineName);
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
    if (violation.codeLocations.length === 0) {
        throw new Error(getMessage('EngineReturnedViolationWithEmptyCodeLocationArray', engineName, violation.ruleName));
    }
    for (const codeLocation of violation.codeLocations) {
        validateCodeLocation(codeLocation, engineName, violation.ruleName);
    }
}

function validateFixCodeLocations(violation: engApi.Violation, engineName: string): void {
    if (!violation.fixes) {
        return;
    }
    for (const fix of violation.fixes) {
        validateCodeLocation(fix.location, engineName, violation.ruleName);
    }
}

function validateSuggestionCodeLocations(violation: engApi.Violation, engineName: string): void {
    if (!violation.suggestions) {
        return;
    }
    for (const suggestion of violation.suggestions) {
        validateCodeLocation(suggestion.location, engineName, violation.ruleName);
    }
}

function validateCodeLocation(codeLocation: engApi.CodeLocation, engineName: string, ruleName: string): void {
    const absFile: string = toAbsolutePath(codeLocation.file);

    if (!fs.existsSync(absFile)) {
        throw new Error(getMessage('EngineReturnedViolationWithCodeLocationFileThatDoesNotExist',
            engineName, ruleName, absFile));
    }

    if (!fs.statSync(absFile).isFile()) {
        throw new Error(getMessage('EngineReturnedViolationWithCodeLocationFileAsFolder',
            engineName, ruleName, absFile));
    }

    if (!isValidLineOrColumn(codeLocation.startLine)) {
        throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
            engineName, ruleName, 'startLine', codeLocation.startLine));
    }

    if (!isValidLineOrColumn(codeLocation.startColumn)) {
        throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
            engineName, ruleName, 'startColumn', codeLocation.startColumn));
    }

    if (codeLocation.endLine !== undefined) {
        if (!isValidLineOrColumn(codeLocation.endLine)) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                engineName, ruleName, 'endLine', codeLocation.endLine));
        } else if (codeLocation.endLine < codeLocation.startLine) {
            throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine',
                engineName, ruleName, codeLocation.endLine, codeLocation.startLine));
        }

        // istanbul ignore else
        if (codeLocation.endColumn !== undefined) {
            if (!isValidLineOrColumn(codeLocation.endColumn)) {
                throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                    engineName, ruleName, 'endColumn', codeLocation.endColumn));
            } else if (codeLocation.endLine == codeLocation.startLine && codeLocation.endColumn < codeLocation.startColumn) {
                throw new Error(getMessage('EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine',
                    engineName, ruleName, codeLocation.endColumn, codeLocation.startColumn));
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dynamicallyImport(absJavaScriptFilePath: string): Promise<any> {
    // To avoid issues with dynamically importing absolute paths on Windows, we need to convert to url with pathToFileURL.
    const moduleUrl: string = pathToFileURL(absJavaScriptFilePath).href;
    const pluginModule = await import(moduleUrl);
    /* istanbul ignore next */
    return pluginModule.default ?? pluginModule; // Return the default export if it exists, otherwise the module itself
}
