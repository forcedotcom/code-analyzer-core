import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    CodeLocation,
    EngineRunResults,
    EngineLogEvent,
    EngineRunProgressEvent,
    EngineResultsEvent,
    EngineTelemetryEvent,
    EventType,
    LogEvent,
    LogLevel,
    RuleSelection,
    RunOptions,
    RunResults,
    SeverityLevel,
    Violation,
    Workspace
} from "../src";
import * as stubs from "./stubs";
import {getMessage} from "../src/messages";
import os from "node:os";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot, FakeFileSystemHandler, FixedUniqueIdGenerator} from "./test-helpers";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {FixedClock} from "@salesforce/code-analyzer-engine-api/utils"
import {UnexpectedEngineErrorRule} from "../src/rules";
import {UndefinedCodeLocation} from "../src/results";
import {StubWorkspace} from "./stubs";

changeWorkingDirectoryToPackageRoot();

const SAMPLE_WORKSPACE_FOLDER: string = path.join(__dirname, 'test-data', 'sampleWorkspace')

describe("Tests for CodeAnalyzer constructor", () => {
    it.each([
        {version: 'v18.0.0'},
        {version: 'v4.0.0'} // 4 is less than 20, but 4 is greater than 2. This is a classic trap for SemVer comparisons.
    ])("When supplied with a Node Version prior to v20, construction fails. Case: $version", ({version}) => {
        // Expect the construction to fail with an error message that mentions v20, the minimum compatible version.
        expect(() => new CodeAnalyzer(CodeAnalyzerConfig.withDefaults(), version)).toThrow('v20');
    });

    it.each([
        {version: 'v20.0.0'},
        {version: 'v21.0.0'},
        {version: 'v100.0.0'} // 100 is greater than 20, but 1 is less than 2. This is a classic trap for SemVer comparisons.
    ])('When supplied with a Node Version of v20 or later, construction succeeds. Case: $version"', ({version}) => {
        expect(new CodeAnalyzer(CodeAnalyzerConfig.withDefaults(), version)).toBeInstanceOf(CodeAnalyzer);
    });

    it("Constructor prepends the currently-running Node's parent folder to the PATH", () => {
        // Figure out what the current value of PATH is.
        const initialPath: string = process.env.PATH || '';
        const nodeParentDir: string = path.dirname(process.execPath);

        // Instantiate a Code Analyzer.
        new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());

        // Verify that the PATH was changed.
        expect(process.env.PATH).toEqual(`${nodeParentDir}${path.delimiter}${initialPath}`);
    });
});

describe("Tests for getConfig method", () => {
    it.each([
        CodeAnalyzerConfig.withDefaults(),
        CodeAnalyzerConfig.fromObject({log_folder: __dirname})
    ])("When getConfig is called, it returns the exact CodeAnalyzerConfig that was passed to the constructor", (config: CodeAnalyzerConfig) => {
        const codeAnalyzer: CodeAnalyzer = new CodeAnalyzer(config);
        expect(codeAnalyzer.getConfig()).toEqual(config);
    });
});

describe("Tests for the createWorkspace method", () => {
    const codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());

    it('When creating multiple workspaces, then they each get a unique id', async () => {
        const workspace1: Workspace = await codeAnalyzer.createWorkspace([SAMPLE_WORKSPACE_FOLDER]);
        const workspace2: Workspace = await codeAnalyzer.createWorkspace([SAMPLE_WORKSPACE_FOLDER]);
        expect(workspace1.getWorkspaceId()).not.toEqual(workspace2.getWorkspaceId());
    });

    it('When creating a workspace with no files or folders or targets, then error', async () => {
        await expect(codeAnalyzer.createWorkspace([])).rejects.toThrow(
            getMessage('AtLeastOneFileOrFolderMustBeIncludedInWorkspace'));
    });

    it('When creating a workspace with no files or folders but some targets, then still error', async () => {
        // It is each client's responsibility to always fill in something for the workspace. If the CLI for example
        // has a users only provide target values but not workspace paths, then it might decide to use the target
        // information as the workspace information.
        await expect(codeAnalyzer.createWorkspace([],[SAMPLE_WORKSPACE_FOLDER])).rejects.toThrow(
            getMessage('AtLeastOneFileOrFolderMustBeIncludedInWorkspace'));
    });

    it('When creating a workspace with a file or folder that does not exist, then error', async () => {
        await expect(codeAnalyzer.createWorkspace(['/some/missing/folder'])).rejects.toThrow(
            /The file or folder .*some.*missing.*folder.* does not exist./); // should work on unix and windows
    });

    it('When creating a workspace with a target that does not exist, then error', async () => {
        const targetThatExists: string = path.join(SAMPLE_WORKSPACE_FOLDER,'someFile.cls');
        const targetThatDoesntExist: string = path.join(SAMPLE_WORKSPACE_FOLDER,'doesNotExist.cls');
        const promise: Promise<Workspace> = codeAnalyzer.createWorkspace(
            [SAMPLE_WORKSPACE_FOLDER], [targetThatExists, targetThatDoesntExist]);
        await expect(promise).rejects.toThrow(
            getMessage('FileOrFolderDoesNotExist', path.join(SAMPLE_WORKSPACE_FOLDER,'doesNotExist.cls')));
    });

    it('When a target does not live underneath of the workspace files and folders, then error', async() => {
        const target: string = path.join(__dirname, 'code-analyzer.test.ts');
        await expect(codeAnalyzer.createWorkspace([SAMPLE_WORKSPACE_FOLDER], [target])).rejects.toThrow(
            getMessage('TargetMustLiveWithinWorkspace', target, JSON.stringify([SAMPLE_WORKSPACE_FOLDER])));
    });

    it('When workspace files and folders are provided as relative paths, then they are converted to absolute paths', async () => {
        // Since changeWorkingDirectoryToPackageRoot() was used above, the pwd should be the code-analyzer-core directory
        const workspace: Workspace = await codeAnalyzer.createWorkspace([SAMPLE_WORKSPACE_FOLDER, 'src', 'test/code-analyzer.test.ts']);
        expect(workspace.getRawFilesAndFolders()).toEqual([
            path.resolve('.', 'src'),
            path.resolve('.', 'test', 'code-analyzer.test.ts'),
            SAMPLE_WORKSPACE_FOLDER
        ]);
    });

    it('When targets are provided as relative paths, then they are converted to absolute paths', async () => {
        // Since changeWorkingDirectoryToPackageRoot() was used above, the pwd should be the code-analyzer-core directory
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['test'], [
            'test/code-analyzer.test.ts',
            'test/test-data/sampleWorkspace/someFile.cls']);
        expect(workspace.getRawTargets()).toEqual([
            path.resolve('.', 'test', 'code-analyzer.test.ts'),
            path.resolve('.', 'test', 'test-data', 'sampleWorkspace', 'someFile.cls')
        ]);
    });

    it("When provided a windows based path, it resolves correctly", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['test\\code-analyzer.test.ts']);
        expect(workspace.getRawFilesAndFolders()).toEqual([path.resolve('test/code-analyzer.test.ts')]);
    });

    it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace(['test/test-data', 'test', 'test/code-analyzer.test.ts']);
        expect(workspace.getRawFilesAndFolders()).toEqual([path.resolve('test')]);
    });

    it("When explicitly including files that we normally would ignore, then they are still included since they were explicitly added", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace([
            'test/test-data/sampleWorkspace/node_modules/place_holder.txt',
            'test/test-data/sampleWorkspace/someFile.cls',
            'test/test-data/sampleWorkspace/.gitignore']);
        expect(workspace.getRawFilesAndFolders()).toEqual([
            path.resolve('test', 'test-data', 'sampleWorkspace', 'node_modules', 'place_holder.txt'),
            path.resolve('test', 'test-data', 'sampleWorkspace', 'someFile.cls'),
            path.resolve('test', 'test-data', 'sampleWorkspace', '.gitignore')
        ].sort());
    });

    it("When providing files, folders, and targets, then returned workspace can expand everything correctly and remove redundant information", async () => {
        const workspace: Workspace = await codeAnalyzer.createWorkspace([SAMPLE_WORKSPACE_FOLDER], [
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'), // redundant with its parent folder and should go away
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls') // duplicate
        ]);

        expect(await workspace.getWorkspaceFiles()).toEqual([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'folderWithExt.cls', 'placeholder.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1','sub2', 'someFile1InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1','sub2', 'someFile2InSub2.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1','sub3', 'someFileInSub3.cls')
        ]);
        expect(await workspace.getTargetedFiles()).toEqual([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1','sub3', 'someFileInSub3.cls')
        ]);
    });
});

describe("Tests for the run method of CodeAnalyzer", () => {
    let sampleRunOptions: RunOptions;
    let sampleTimestamp: Date;
    let codeAnalyzer: CodeAnalyzer;
    let stubEngine1: stubs.StubEngine1;
    let stubEngine2: stubs.StubEngine2;
    let selection: RuleSelection;
    let fixedClock: FixedClock;
    let fakeFileSystemHandler: FakeFileSystemHandler;
    const expectedStubEngine1RuleNames: string[] = ['stub1RuleA', 'stub1RuleB', 'stub1RuleC'];
    const expectedStubEngine2RuleNames: string[] = ['stub2RuleA', 'stub2RuleC'];

    beforeEach(async () => {
        sampleTimestamp = new Date();
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        fixedClock = new FixedClock(sampleTimestamp);
        fakeFileSystemHandler = new FakeFileSystemHandler();
        codeAnalyzer._setClock(fixedClock);
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
        codeAnalyzer._setFileSystemHandler(fakeFileSystemHandler);
        sampleRunOptions = {workspace: await codeAnalyzer.createWorkspace([__dirname])};
        const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubPlugin);
        stubEngine1 = stubPlugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        stubEngine2 = stubPlugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        selection = await codeAnalyzer.selectRules([]);
    });

    it("When run options contains workspace with targets, then they are passed to each engine successfully", async () => {
        await codeAnalyzer.run(selection, {
            workspace: await codeAnalyzer.createWorkspace([SAMPLE_WORKSPACE_FOLDER],[
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls')
            ]),
        });

        const workingDirectoriesRoot: string = path.join(os.tmpdir(), `code-analyzer`, `run-${fixedClock.formatToDateTimeString()}`);

        const expectedEngineRunOptionsEngine1: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workingDirectory: path.join(workingDirectoriesRoot, 'stubEngine1'),
            workspace: new engApi.Workspace("FixedId", [SAMPLE_WORKSPACE_FOLDER], [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls')])
        };
        const expectedEngineRunOptionsEngine2: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workingDirectory: path.join(workingDirectoriesRoot, 'stubEngine2'),
            workspace: new engApi.Workspace("FixedId", [SAMPLE_WORKSPACE_FOLDER], [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls')])
        };
        expect(fakeFileSystemHandler.dirWasCreated(workingDirectoriesRoot)).toEqual(true);
        expect(fakeFileSystemHandler.dirWasDeleted(workingDirectoriesRoot)).toEqual(true);
        expect(stubEngine1.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine1.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine1RuleNames);
        expectEquivalentRunOptions(stubEngine1.runRulesCallHistory[0].runOptions, expectedEngineRunOptionsEngine1);
        expect(fakeFileSystemHandler.dirWasCreated(expectedEngineRunOptionsEngine1.workingDirectory)).toEqual(true);
        expect(fakeFileSystemHandler.dirWasDeleted(expectedEngineRunOptionsEngine1.workingDirectory)).toEqual(true);
        expect(stubEngine2.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine2.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine2RuleNames);
        expectEquivalentRunOptions(stubEngine2.runRulesCallHistory[0].runOptions, expectedEngineRunOptionsEngine2);
        expect(fakeFileSystemHandler.dirWasCreated(expectedEngineRunOptionsEngine2.workingDirectory)).toEqual(true);
        expect(fakeFileSystemHandler.dirWasDeleted(expectedEngineRunOptionsEngine2.workingDirectory)).toEqual(true);
    });

    it("When the workspace provided is one that is not constructed from CodeAnalyzer's createWorkspace method, then it should still work", async () => {
        const dummyWorkspace: Workspace = new StubWorkspace();
        const workingDirectoriesRoot: string = path.join(os.tmpdir(), `code-analyzer`, `run-${fixedClock.formatToDateTimeString()}`);

        await codeAnalyzer.run(selection, {
            workspace: dummyWorkspace
        });

        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: {
                logFolder: codeAnalyzer.getConfig().getLogFolder(),
                workingDirectory: path.join(workingDirectoriesRoot, 'stubEngine1'),
                workspace: new engApi.Workspace(dummyWorkspace.getWorkspaceId(), dummyWorkspace.getRawFilesAndFolders(),
                    dummyWorkspace.getRawTargets())
            }
        }]);
    });

    it("When no rules are selected for an engine, then when running, that engine is skipped", async () => {
        selection = await codeAnalyzer.selectRules(['stubEngine1:Recommended']);
        await codeAnalyzer.run(selection, sampleRunOptions);

        const workingDirectoriesRoot: string = path.join(os.tmpdir(), `code-analyzer`, `run-${fixedClock.formatToDateTimeString()}`);

        const expectedEngineRunOptions: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workingDirectory: path.join(workingDirectoriesRoot, 'stubEngine1'),
            workspace: new engApi.Workspace("FixedId", [__dirname])
        };
        expect(stubEngine1.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine1.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine1RuleNames);
        expectEquivalentRunOptions(stubEngine1.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
        expect(stubEngine2.runRulesCallHistory).toHaveLength(0);
    });

    it("When zero rules are selected, then all engines should be skipped and returned results contain no violations", async () => {
        selection = await codeAnalyzer.selectRules(['doesNotExist']);
        const results: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        expect(stubEngine1.runRulesCallHistory).toEqual([]);
        expect(stubEngine2.runRulesCallHistory).toEqual([]);
        expect(results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(results.getViolations()).toEqual([]);
        expect(results.getEngineNames()).toEqual([]);
    });

    it("When an engine did not run, then attempting to get that engine's run results gives an error", async () => {
        selection = await codeAnalyzer.selectRules(['stubEngine2']);
        const results: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        expect(results.getEngineNames()).toEqual(['stubEngine2']);
        expect(() => results.getEngineRunResults('stubEngine1')).toThrow(
            getMessage('EngineRunResultsMissing', 'stubEngine1'));
        expect(results.getEngineRunResults('stubEngine2')).toBeDefined();
    });

    it("When no zero violations occurred, then results have no violations for the engines that ran", async () => {
        const overallResults: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        expect(overallResults.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2', 'stubEngine3']);
        expect(overallResults.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(overallResults.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(overallResults.getViolations()).toEqual([]);

        const stubEngine1Results = overallResults.getEngineRunResults('stubEngine1');
        expect(stubEngine1Results.getEngineName()).toEqual('stubEngine1');
        expect(stubEngine1Results.getEngineVersion()).toEqual('0.0.1');
        expect(stubEngine1Results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(stubEngine1Results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(stubEngine1Results.getViolations()).toEqual([]);

        const stubEngine2Results = overallResults.getEngineRunResults('stubEngine2');
        expect(stubEngine2Results.getEngineName()).toEqual('stubEngine2');
        expect(stubEngine2Results.getEngineVersion()).toEqual('0.1.0');
        expect(stubEngine2Results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(stubEngine2Results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(stubEngine2Results.getViolations()).toEqual([]);

        const stubEngine3Results = overallResults.getEngineRunResults('stubEngine3');
        expect(stubEngine3Results.getEngineName()).toEqual('stubEngine3');
        expect(stubEngine3Results.getEngineVersion()).toEqual('1.0.0');
        expect(stubEngine3Results.getViolationCount()).toEqual(0);
        for (const severityLevel of getAllSeverityLevels()) {
            expect(stubEngine3Results.getViolationCountOfSeverity(severityLevel)).toEqual(0);
        }
        expect(stubEngine3Results.getViolations()).toEqual([]);
    });

    it("When an engines return violations, then they are correctly included in the run results", async () => {
        stubEngine1.resultsToReturn = {
            violations: [stubs.getSampleViolationForStub1RuleA(), stubs.getSampleViolationForStub1RuleC()]
        };
        stubEngine2.resultsToReturn = {
            violations: [stubs.getSampleViolationForStub2RuleC()]
        };
        const overallResults: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        expect(overallResults.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2', 'stubEngine3']);
        expect(overallResults.getViolationCount()).toEqual(3);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);

        const engine1Results = overallResults.getEngineRunResults('stubEngine1');
        expect(engine1Results.getEngineName()).toEqual('stubEngine1');
        expect(engine1Results.getEngineVersion()).toEqual('0.0.1');
        expect(engine1Results.getViolationCount()).toEqual(2);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(0);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(1);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(1);
        expect(engine1Results.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);
        const engine1Violations: Violation[] = engine1Results.getViolations();
        expect(engine1Violations).toHaveLength(2);
        expect(engine1Violations[0].getRule()).toEqual(selection.getRule('stubEngine1', 'stub1RuleA'));
        expect(engine1Violations[0].getMessage()).toEqual('SomeViolationMessage1');
        const engine1Violation1CodeLocations: CodeLocation[] = engine1Violations[0].getCodeLocations();
        expect(engine1Violation1CodeLocations).toHaveLength(1);
        assertCodeLocation(engine1Violation1CodeLocations[0], path.resolve('test', 'config.test.ts'), 3, 6, 11, 8);
        expect(engine1Violations[0].getPrimaryLocation()).toEqual(engine1Violation1CodeLocations[0]);
        expect(engine1Violations[0].getPrimaryLocationIndex()).toEqual(0);
        expect(engine1Violations[0].getResourceUrls()).toEqual(["https://example.com/stub1RuleA"]);
        expect(engine1Violations[1].getRule()).toEqual(selection.getRule('stubEngine1', 'stub1RuleC'));
        expect(engine1Violations[1].getMessage()).toEqual('SomeViolationMessage2');
        const engine1Violation2CodeLocations: CodeLocation[] = engine1Violations[1].getCodeLocations();
        expect(engine1Violation2CodeLocations).toHaveLength(1);
        assertCodeLocation(engine1Violation2CodeLocations[0], path.resolve('test', 'code-analyzer.test.ts'), 21, 7, 25, 4);
        expect(engine1Violations[1].getPrimaryLocationIndex()).toEqual(0);
        expect(engine1Violations[1].getResourceUrls()).toEqual([
            "https://example.com/stub1RuleC",
            "https://example.com/aViolationSpecificUrl1",
            "https://example.com/violationSpecificUrl2"
        ]);

        const engine2Results = overallResults.getEngineRunResults('stubEngine2');
        expect(engine2Results.getEngineName()).toEqual('stubEngine2');
        expect(engine2Results.getEngineVersion()).toEqual('0.1.0');
        expect(engine2Results.getViolationCount()).toEqual(1);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(0);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(1);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Moderate)).toEqual(0);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Low)).toEqual(0);
        expect(engine2Results.getViolationCountOfSeverity(SeverityLevel.Info)).toEqual(0);
        const engine2Violations: Violation[] = engine2Results.getViolations();
        expect(engine2Violations).toHaveLength(1);
        expect(engine2Violations[0].getRule()).toEqual(selection.getRule('stubEngine2', 'stub2RuleC'));
        expect(engine2Violations[0].getMessage()).toEqual('SomeViolationMessage3');
        const engine2Violation1CodeLocations: CodeLocation[] = engine2Violations[0].getCodeLocations();
        expect(engine2Violation1CodeLocations).toHaveLength(3);
        assertCodeLocation(engine2Violation1CodeLocations[0], path.resolve('test', 'stubs.ts'), 4, 13);
        assertCodeLocation(engine2Violation1CodeLocations[1], path.resolve('test', 'test-helpers.ts'), 9, 1);
        assertCodeLocation(engine2Violation1CodeLocations[2], path.resolve('test', 'stubs.ts'), 76, 8);
        expect(engine2Violations[0].getPrimaryLocation()).toEqual(engine2Violation1CodeLocations[2]);
        expect(engine2Violations[0].getPrimaryLocationIndex()).toEqual(2);
        expect(engine2Violations[0].getResourceUrls()).toEqual([]);

        expect(overallResults.getViolations()).toEqual([...engine1Violations,...engine2Violations]);
    });

    it("When an engine returns a violation for a rule that was not actually selected, then an error is thrown", async () => {
        stubEngine1.resultsToReturn = {
            violations: [stubs.getSampleViolationForStub1RuleC()]
        };
        selection = await codeAnalyzer.selectRules(['stub1RuleA']);
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationForUnselectedRule', 'stubEngine1', 'stub1RuleC'));
    });

    it("When an engine returns a violation that has a primary location index that is too large, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleC();
        badViolation.primaryLocationIndex = 1;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine1', 'stub1RuleC', 1, 1));
    });

    it("When an engine returns a violation that has a primary location index that is negative, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub2RuleC();
        badViolation.primaryLocationIndex = -2;
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine2', 'stub2RuleC', -2, 3));
    });

    it("When an engine returns a violatoin that has zero code locations, then an error is thrown", async() => {
        const badViolation: engApi.Violation = {
            ruleName: 'stub1RuleC',
            message: 'SomeViolationMessage2',
            codeLocations: [],
            primaryLocationIndex: 0,
            resourceUrls: ["https://example.com/aViolationSpecificUrl1",]
        };
        badViolation.primaryLocationIndex = 0;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithEmptyCodeLocationArray', 'stubEngine1', 'stub1RuleC'));
    });

    it("When an engine returns a violation that has a primary location index that is not an integer, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleC();
        badViolation.primaryLocationIndex = 0.5;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithInvalidPrimaryLocationIndex', 'stubEngine1', 'stub1RuleC', 0.5, 1));
    });

    it("When an engine returns a code location file that does not exist, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub2RuleC();
        badViolation.codeLocations[1].file = 'test/doesNotExist';
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationFileThatDoesNotExist',
                'stubEngine2', 'stub2RuleC', path.resolve('test', 'doesNotExist')));
    });

    it("When an engine returns a code location file that is a folder, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub2RuleC();
        badViolation.codeLocations[1].file = 'test/test-data';
        stubEngine2.resultsToReturn = {
            violations: [badViolation]
        };
        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationFileAsFolder',
                'stubEngine2', 'stub2RuleC', path.resolve('test', 'test-data')));
    });

    it.each([
        {startLine: -1, startColumn: 2, endLine: 3, endColumn: 4, expectedBadField: 'startLine', expectedBadValue: -1},
        {startLine: 1.5, startColumn: 2, endLine: 3, endColumn: 4, expectedBadField: 'startLine', expectedBadValue: 1.5},
        {startLine: 1, startColumn: 0, endLine: 3, endColumn: 4, expectedBadField: 'startColumn', expectedBadValue: 0},
        {startLine: 1, startColumn: 3.124, endLine: 3, endColumn: 4, expectedBadField: 'startColumn', expectedBadValue: 3.124},
        {startLine: 1, startColumn: 2, endLine: -1.2, endColumn: 4, expectedBadField: 'endLine', expectedBadValue: -1.2},
        {startLine: 1, startColumn: 2, endLine: 3, endColumn: 0, expectedBadField: 'endColumn', expectedBadValue: 0},
    ])("When an engine returns a code location that has an invalid line or column, then an error is thrown", async (caseObj) => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        badViolation.codeLocations[0].startLine = caseObj.startLine;
        badViolation.codeLocations[0].startColumn = caseObj.startColumn;
        badViolation.codeLocations[0].endLine = caseObj.endLine;
        badViolation.codeLocations[0].endColumn = caseObj.endColumn;
        stubEngine1.resultsToReturn = { violations: [badViolation] };

        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn',
                'stubEngine1', 'stub1RuleA', caseObj.expectedBadField, caseObj.expectedBadValue));
    });

    it("When an engine returns a code location with a endLine before a startLine, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        badViolation.codeLocations[0].startLine = 4;
        badViolation.codeLocations[0].endLine = 2;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine',
                'stubEngine1', 'stub1RuleA', 2, 4));
    });

    it("When an engine returns a code location with equal startLine and endLine with an endColumn before a startColumn, then an error is thrown", async () => {
        const badViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        badViolation.codeLocations[0].startLine = 4;
        badViolation.codeLocations[0].startColumn = 5;
        badViolation.codeLocations[0].endLine = 4;
        badViolation.codeLocations[0].endColumn = 2;
        stubEngine1.resultsToReturn = {
            violations: [badViolation]
        };

        await expect(codeAnalyzer.run(selection, sampleRunOptions)).rejects.toThrow(
            getMessage('EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine',
                'stubEngine1', 'stub1RuleA', 2, 5));
    });

    it("When an engine returns a code location with an endColumn but no endLine, then the endColumn is simply not used", async () => {
        const malformedViolation: engApi.Violation = stubs.getSampleViolationForStub1RuleA();
        malformedViolation.codeLocations[0].startLine = 4;
        malformedViolation.codeLocations[0].startColumn = 5;
        malformedViolation.codeLocations[0].endLine = undefined;
        malformedViolation.codeLocations[0].endColumn = 4;
        stubEngine1.resultsToReturn = {
            violations: [malformedViolation]
        };
        const overallResults: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        const violations: Violation[] = overallResults.getViolations();
        expect(violations).toHaveLength(1);
        expect(violations[0].getCodeLocations()[0].getStartLine()).toEqual(4);
        expect(violations[0].getCodeLocations()[0].getStartColumn()).toEqual(5);
        expect(violations[0].getCodeLocations()[0].getEndLine()).toBeUndefined();
        expect(violations[0].getCodeLocations()[0].getEndColumn()).toBeUndefined();
    });

    it("When an engine throws an exception when running, then a result is returned with a Critical violation of type UnexpectedError", async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        await codeAnalyzer.addEnginePlugin(new stubs.ThrowingEnginePlugin());
        selection = await codeAnalyzer.selectRules([]);
        const overallResults: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        expect(overallResults.getRunDirectory()).toEqual(process.cwd() + path.sep);
        expect(overallResults.getViolationCount()).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(0);
        expect(overallResults.getEngineNames()).toEqual(['throwingEngine']);
        const violations: Violation[] = overallResults.getViolations();
        expect(violations).toHaveLength(1);
        const engineRunResults: EngineRunResults = overallResults.getEngineRunResults('throwingEngine');
        expect(engineRunResults.getEngineVersion()).toEqual('3.0.0');
        expect(engineRunResults.getViolations()).toEqual(violations);
        expect(violations[0].getRule()).toEqual(new UnexpectedEngineErrorRule('throwingEngine'));
        expect(violations[0].getRule().getDescription()).toEqual(getMessage('UnexpectedEngineErrorRuleDescription', 'throwingEngine'));
        expect(violations[0].getRule().getEngineName()).toEqual('throwingEngine');
        expect(violations[0].getRule().getName()).toEqual('UnexpectedEngineError');
        expect(violations[0].getRule().getResourceUrls()).toEqual([]);
        expect(violations[0].getRule().getSeverityLevel()).toEqual(SeverityLevel.Critical);
        expect(violations[0].getRule().getTags()).toEqual([]);
        expect(violations[0].getPrimaryLocation()).toEqual(UndefinedCodeLocation.INSTANCE);
        expect(violations[0].getPrimaryLocationIndex()).toEqual(0);
        expect(violations[0].getCodeLocations()).toEqual([UndefinedCodeLocation.INSTANCE]);
        expect(violations[0].getMessage()).toContain('SomeErrorMessageFromThrowingEngine');
    });

    it.each([
        {plugin: new stubs.ThrowingPlugin2() as engApi.EnginePluginV1, msg: 'SomeErrorFromDescribeEngineConfig', case: 'error in #describeEngineConfig'},
        {plugin: new stubs.ThrowingPlugin3() as engApi.EnginePluginV1, msg: 'SomeErrorFromCreateEngineConfig', case: 'error in #createEngineConfig'},
        {plugin: new stubs.ThrowingPlugin4() as engApi.EnginePluginV1, msg: 'SomeErrorFromCreateEngine', case: 'error in #createEngine'},
        {plugin: new stubs.ThrowingEnginePlugin2() as engApi.EnginePluginV1, msg: 'SomeErrorFromDescribeRules', case: 'error in #describeRules'}
    ])(`When an engine could not be instantiated, running rules produces a Critical violation of type UninstantiableEngineError. Case: $case`, async ({plugin, msg}) => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        await codeAnalyzer.addEnginePlugin(plugin);
        selection = await codeAnalyzer.selectRules([]);
        const overallResults: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);
        expect(overallResults.getRunDirectory()).toEqual(process.cwd() + path.sep);
        expect(overallResults.getViolationCount()).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.Critical)).toEqual(1);
        expect(overallResults.getViolationCountOfSeverity(SeverityLevel.High)).toEqual(0);
        expect(overallResults.getEngineNames()).toEqual(['someEngine']);
        const violations: Violation[] = overallResults.getViolations();
        expect(violations).toHaveLength(1);
        const engineRunResults: EngineRunResults = overallResults.getEngineRunResults('someEngine');
        expect(engineRunResults.getEngineVersion()).toEqual('unknown');
        expect(engineRunResults.getViolations()).toEqual(violations);
        expect(violations[0].getRule()).toEqual(new UnexpectedEngineErrorRule('someEngine'));
        expect(violations[0].getRule().getDescription()).toEqual(getMessage('UninstantiableEngineErrorRuleDescription', 'someEngine'));
        expect(violations[0].getRule().getEngineName()).toEqual('someEngine');
        expect(violations[0].getRule().getName()).toEqual('UninstantiableEngineError');
        expect(violations[0].getRule().getResourceUrls()).toEqual([]);
        expect(violations[0].getRule().getSeverityLevel()).toEqual(SeverityLevel.Critical);
        expect(violations[0].getRule().getTags()).toEqual([]);
        expect(violations[0].getPrimaryLocation()).toEqual(UndefinedCodeLocation.INSTANCE);
        expect(violations[0].getPrimaryLocationIndex()).toEqual(0);
        expect(violations[0].getCodeLocations()).toEqual([UndefinedCodeLocation.INSTANCE]);
        expect(violations[0].getMessage()).toContain(msg);
    });

    it("When running engines, then the log events should include the start and end of each engine run", async () => {
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(logEvents.length).toBeGreaterThanOrEqual(4);
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('RunningEngineWithRules', 'stubEngine1', `["stub1RuleA","stub1RuleB","stub1RuleC"]`),
            timestamp: sampleTimestamp
        });
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('RunningEngineWithRules', 'stubEngine2', `["stub2RuleA","stub2RuleC"]`),
            timestamp: sampleTimestamp
        });
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('FinishedRunningEngine', 'stubEngine1'),
            timestamp: sampleTimestamp
        });
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('FinishedRunningEngine', 'stubEngine2'),
            timestamp: sampleTimestamp
        });
    });

    it('When running, any core level events that are greater than the user defined level should not be emitted', async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromObject({
            log_level: LogLevel.Warn
        }));
        const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubPlugin);

        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        await codeAnalyzer.run(selection, sampleRunOptions);
        expect(logEvents.length).toEqual(0); // Should be zero because core currently only emits debug level events when ran
    });

    it("When running engines, then run progress events are wired up and emitted correctly from the engines", async () => {
        const engineRunProgressEvents: EngineRunProgressEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineRunProgressEvent, (event: EngineRunProgressEvent) => engineRunProgressEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineRunProgressEvents).toHaveLength(13);
        const stub1RunProgressEvents: EngineRunProgressEvent[] = engineRunProgressEvents.filter(e => e.engineName === 'stubEngine1');
        expect(stub1RunProgressEvents).toHaveLength(5);
        const stub2RunProgressEvents: EngineRunProgressEvent[] = engineRunProgressEvents.filter(e => e.engineName === 'stubEngine2');
        expect(stub2RunProgressEvents).toHaveLength(4);
        const stub3RunProgressEvents: EngineRunProgressEvent[] = engineRunProgressEvents.filter(e => e.engineName === 'stubEngine3');
        expect(stub3RunProgressEvents).toHaveLength(4);
        for (const [i, progressDescriptor] of [{percent: 0}, {percent: 0}, {percent: 50, message: "someProgressMessage"}, {percent: 100}, {percent: 100}].entries()) { // Core and stubEngine1 both give us 0 and 100
            expect(stub1RunProgressEvents[i]).toEqual({
                type: EventType.EngineRunProgressEvent,
                timestamp: sampleTimestamp,
                engineName: "stubEngine1",
                percentComplete: progressDescriptor.percent,
                message: progressDescriptor.message
            });
        }
        for (const [i, expectedPercentComplete] of [0, 5, 63, 100].entries()) { // Only Core gives us 0 and 100
            expect(stub2RunProgressEvents[i]).toEqual({
                type: EventType.EngineRunProgressEvent,
                timestamp: sampleTimestamp,
                engineName: "stubEngine2",
                percentComplete: expectedPercentComplete
            });
        }
        for (const [i, expectedPercentComplete] of [0, 5, 80, 100].entries()) { // Only Core gives us 0 and 100
            expect(stub3RunProgressEvents[i]).toEqual({
                type: EventType.EngineRunProgressEvent,
                timestamp: sampleTimestamp,
                engineName: "stubEngine3",
                percentComplete: expectedPercentComplete
            });
        }
    });

    it("When running engines, then engine run results events are emitted correctly when the engines complete", async () => {
        const engineResultsEvents: EngineResultsEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineResultsEvent, (event: EngineResultsEvent) => engineResultsEvents.push(event));
        const runResults: RunResults = await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineResultsEvents).toHaveLength(3);
        expect(engineResultsEvents).toContainEqual({
            type: EventType.EngineResultsEvent,
            timestamp: sampleTimestamp,
            results: runResults.getEngineRunResults("stubEngine1")
        });
        expect(engineResultsEvents).toContainEqual({
            type: EventType.EngineResultsEvent,
            timestamp: sampleTimestamp,
            results: runResults.getEngineRunResults("stubEngine2")
        });
        expect(engineResultsEvents).toContainEqual({
            type: EventType.EngineResultsEvent,
            timestamp: sampleTimestamp,
            results: runResults.getEngineRunResults("stubEngine3")
        });
    });

    it("When running engines, then engine-specific log events are wired up and emitted correctly (but only up to debug log level by default) from the engines", async () => {
        const engineLogEvents: EngineLogEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (event: EngineLogEvent) => engineLogEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineLogEvents).toHaveLength(2); // Should only be 2 since by default Fine logs are not included by default
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine2",
            logLevel: LogLevel.Info,
            message: "someMiscInfoMessageFromStubEngine2"
        });
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine3",
            logLevel: LogLevel.Info,
            message: "someMiscInfoMessageFromStubEngine3"
        });
    });


    it("When running engines, then engine-specific log events are wired up and emitted fully from the engines when using fine level debugging", async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromObject({
            log_level: LogLevel.Fine
        }));
        codeAnalyzer._setClock(new FixedClock(sampleTimestamp));
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
        const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubPlugin);

        const engineLogEvents: EngineLogEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (event: EngineLogEvent) => engineLogEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineLogEvents).toHaveLength(3); // Should have all 3 events
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine1",
            logLevel: LogLevel.Fine,
            message: "someMiscFineMessageFromStubEngine1"
        });
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine2",
            logLevel: LogLevel.Info,
            message: "someMiscInfoMessageFromStubEngine2"
        });
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine3",
            logLevel: LogLevel.Info,
            message: "someMiscInfoMessageFromStubEngine3"
        });
    });

    it("When running engines, then engine-specific log events do not get emitted if they are greater than the user defined log level", async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromObject({
            log_level: LogLevel.Error
        }));
        const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubPlugin);

        const engineLogEvents: EngineLogEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (event: EngineLogEvent) => engineLogEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineLogEvents).toHaveLength(0); // Should only be 0 since all the events emitted are Info or higher (which is greater than Error)
    });

    it("When running engines, then engine-level telemetry events are wired up and emitted correctly from the engines", async () => {
        const engineTelemetryEvents: EngineTelemetryEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineTelemetryEvent, (event: EngineTelemetryEvent) => engineTelemetryEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineTelemetryEvents).toHaveLength(2);
        expect(engineTelemetryEvents).toContainEqual({
            type: EventType.EngineTelemetryEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine1",
            eventName: 'Engine1RunKey',
            uuid: "FixedUUID",
            data: {
                someProperty: 1,
                someOtherProperty: 'abcde',
                someThirdProperty: true
            }
        });
        expect(engineTelemetryEvents).toContainEqual({
            type: EventType.EngineTelemetryEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine2",
            eventName: 'Engine2RunKey',
            uuid: "FixedUUID",
            data: {
                someProperty: 2,
                someOtherProperty: 'fghij',
                someThirdProperty: false
            }
        });
    });
});

function getAllSeverityLevels(): SeverityLevel[] {
    return Object.values(SeverityLevel)
        .filter((value) => typeof value === 'number') as SeverityLevel[];
}

function assertCodeLocation(codeLocation: CodeLocation, file: string, startLine: number, startColumn: number, endLine?: number, endColumn?: number): void {
    expect(codeLocation.getFile()).toEqual(file);
    expect(codeLocation.getStartLine()).toEqual(startLine);
    expect(codeLocation.getStartColumn()).toEqual(startColumn);
    expect(codeLocation.getEndLine()).toEqual(endLine);
    expect(codeLocation.getEndColumn()).toEqual(endColumn);
}


function expectEquivalentRunOptions(actual: engApi.RunOptions, expected: engApi.RunOptions): void {
    expect(actual.logFolder).toEqual(expected.logFolder);
    expectEquivalentWorkspaces(actual.workspace, expected.workspace);
}

function expectEquivalentWorkspaces(actual: engApi.Workspace, expected: engApi.Workspace): void {
    expect(actual.getWorkspaceId()).toEqual(expected.getWorkspaceId());
    expect(actual.getRawFilesAndFolders()).toEqual(expected.getRawFilesAndFolders());
    expect(actual.getRawTargets()).toEqual(expected.getRawTargets());
}
