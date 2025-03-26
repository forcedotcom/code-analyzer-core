import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    CodeLocation,
    EngineRunResults,
    EngineLogEvent,
    EngineRunProgressEvent,
    EngineResultsEvent,
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
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot, FixedUniqueIdGenerator} from "./test-helpers";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {FixedClock} from "@salesforce/code-analyzer-engine-api/utils"
import {UnexpectedEngineErrorRule} from "../src/rules";
import {UndefinedCodeLocation} from "../src/results";

changeWorkingDirectoryToPackageRoot();

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

describe("Tests for the run method of CodeAnalyzer", () => {
    let sampleRunOptions: RunOptions;
    let sampleTimestamp: Date;
    let codeAnalyzer: CodeAnalyzer;
    let stubEngine1: stubs.StubEngine1;
    let stubEngine2: stubs.StubEngine2;
    let selection: RuleSelection;
    const expectedStubEngine1RuleNames: string[] = ['stub1RuleA', 'stub1RuleB', 'stub1RuleC'];
    const expectedStubEngine2RuleNames: string[] = ['stub2RuleA', 'stub2RuleC'];

    beforeEach(async () => {
        sampleTimestamp = new Date();
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        codeAnalyzer._setClock(new FixedClock(sampleTimestamp));
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
        sampleRunOptions = {workspace: await codeAnalyzer.createWorkspace([__dirname])};
        const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubPlugin);
        stubEngine1 = stubPlugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        stubEngine2 = stubPlugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        selection = await codeAnalyzer.selectRules([]);
    });

    it("When run options contains a path start point (without method) with a file that does not exist, then error", async () => {
        const runOptions: RunOptions = {
            ... sampleRunOptions,
            pathStartPoints: [path.resolve(__dirname, 'doesNotExist.xml')],
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('FileOrFolderDoesNotExist', path.resolve(__dirname, 'doesNotExist.xml')));
    });

    it("When run options contains a path start point (with method) with a file that does not exist, then error", async () => {
        const badPathStartPoint: string = path.resolve(__dirname, 'doesNotExist.xml#someMethod');
        const runOptions: RunOptions = {
            ... sampleRunOptions,
            pathStartPoints: [path.resolve(__dirname, 'code-analyzer.test.ts'), badPathStartPoint]
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('PathStartPointFileDoesNotExist', badPathStartPoint, path.resolve(__dirname, 'doesNotExist.xml')));
    });

    it("When path starting point is a folder with methods specified, then error", async () => {
        const badPathStartPoint: string = "test/test-data#method1;method2";
        const runOptions: RunOptions = {
            ... sampleRunOptions,
            pathStartPoints: [badPathStartPoint],
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('PathStartPointWithMethodMustNotBeFolder', badPathStartPoint, path.resolve('test', 'test-data')));
    });

    it("When path starting point has too many hashtags specified, then error", async () => {
        const badPathStartPoint: string = "test/test-helpers.ts#method1#method2";
        const runOptions: RunOptions = {
            ... sampleRunOptions,
            pathStartPoints: [badPathStartPoint],
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('InvalidPathStartPoint', badPathStartPoint));
    });

    it("When specifying a path starting point that has an invalid character in its method name, then error", async () => {
        const badPathStartPoint: string = "test/test-helpers.ts#someMethod,oopsCommaIsInvalidHere";
        const runOptions: RunOptions = {
            ... sampleRunOptions,
            pathStartPoints: [badPathStartPoint],
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('InvalidPathStartPoint', badPathStartPoint));
    });

    it("When files to include is an empty array, then error", async () => {
        const runOptions: RunOptions = {
            workspace: await codeAnalyzer.createWorkspace([]),
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('AtLeastOneFileOrFolderMustBeIncluded'));
    });

    it("When path start point does not live under one of the specified paths, then error", async () => {
        const badPathStartPoint: string = "test/test-helpers.ts#someMethod";
        const runOptions: RunOptions = {
            workspace: await codeAnalyzer.createWorkspace(['src', 'package.json']),
            pathStartPoints: [badPathStartPoint],
        };
        await expect(codeAnalyzer.run(selection, runOptions)).rejects.toThrow(
            getMessage('PathStartPointMustBeInsideWorkspace', path.resolve('test', 'test-helpers.ts'),
                JSON.stringify([path.resolve('package.json'), path.resolve('src')])));
    });

    it("When specifying path start points as an empty array, then no path start points are passed to engines", async () => {
        await codeAnalyzer.run(selection, {
            workspace: await codeAnalyzer.createWorkspace(['src']),
            pathStartPoints: []
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: new engApi.Workspace([path.resolve('src')], "FixedId")
        };
        expect(stubEngine1.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine1.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine1RuleNames);
        expectEquivalentRunOptions(stubEngine1.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
        expect(stubEngine2.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine2.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine2RuleNames);
        expectEquivalentRunOptions(stubEngine2.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
    });

    it("When specifying path start points as files and subfolders, then they are passed to each engine successfully", async () => {
        await codeAnalyzer.run(selection, {
            workspace: await codeAnalyzer.createWorkspace(['test']),
            pathStartPoints: ['test/test-data', 'test/code-analyzer.test.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: new engApi.Workspace([path.resolve('test')], "FixedId"),
            pathStartPoints: [
                { file: path.resolve("test", "test-data") },
                { file: path.resolve("test", "code-analyzer.test.ts")}
            ]
        };
        expect(stubEngine1.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine1.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine1RuleNames);
        expectEquivalentRunOptions(stubEngine1.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
        expect(stubEngine2.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine2.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine2RuleNames);
        expectEquivalentRunOptions(stubEngine2.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
    });

    it("When specifying path start points individual methods, then they are passed to each engine successfully", async () => {
        await codeAnalyzer.run(selection, {
            workspace: await codeAnalyzer.createWorkspace(['test', 'src/utils.ts', 'src/index.ts']),
            pathStartPoints: ['test/code-analyzer.test.ts#someMethod','test/stubs.ts#method1;method2;method3','src/utils.ts']
        });

        const expectedEngineRunOptions: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: new engApi.Workspace([
                    path.resolve("src", "index.ts"),
                    path.resolve("src", "utils.ts"),
                    path.resolve('test')
                ],
                "FixedId"),
            pathStartPoints: [
                {
                    file: path.resolve("test", "code-analyzer.test.ts"),
                    methodName: 'someMethod'
                },
                {
                    file: path.resolve("test", "stubs.ts"),
                    methodName: 'method1'
                },
                {
                    file: path.resolve("test", "stubs.ts"),
                    methodName: 'method2'
                },
                {
                    file: path.resolve("test", "stubs.ts"),
                    methodName: 'method3'
                },
                {
                    file: path.resolve("src", "utils.ts")
                }
            ]
        };
        expect(stubEngine1.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine1.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine1RuleNames);
        expectEquivalentRunOptions(stubEngine1.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
        expect(stubEngine2.runRulesCallHistory).toHaveLength(1);
        expect(stubEngine2.runRulesCallHistory[0].ruleNames).toEqual(expectedStubEngine2RuleNames);
        expectEquivalentRunOptions(stubEngine2.runRulesCallHistory[0].runOptions, expectedEngineRunOptions);
    });

    it("When the workspace provided is one that is not constructed from CodeAnalyzer's createWorkspace method, then it should still work", async () => {
        const dummyWorkspace: Workspace = new DummyWorkspace();
        await codeAnalyzer.run(selection, {
            workspace: new DummyWorkspace()
        });

        expect(stubEngine1.runRulesCallHistory).toEqual([{
            ruleNames: expectedStubEngine1RuleNames,
            runOptions: {
                logFolder: codeAnalyzer.getConfig().getLogFolder(),
                workspace: new engApi.Workspace(dummyWorkspace.getFilesAndFolders(), dummyWorkspace.getWorkspaceId())
            }
        }]);
    });

    it("When no rules are selected for an engine, then when running, that engine is skipped", async () => {
        selection = await codeAnalyzer.selectRules(['stubEngine1:Recommended']);
        await codeAnalyzer.run(selection, sampleRunOptions);

        const expectedEngineRunOptions: engApi.RunOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: new engApi.Workspace([__dirname], "FixedId")
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

    it("When running engines, then engine run results events are emitted correctly when the enginges complete", async () => {
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

    it("When running engines, then engine specific events are wired up and emitted correctly from the engines", async () => {
        const engineLogEvents: EngineLogEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (event: EngineLogEvent) => engineLogEvents.push(event));
        await codeAnalyzer.run(selection, sampleRunOptions);

        expect(engineLogEvents).toHaveLength(3);
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

class DummyWorkspace implements Workspace {
    getWorkspaceId(): string {
        return "dummy";
    }

    getFilesAndFolders(): string[] {
        return [__dirname];
    }
}

function expectEquivalentRunOptions(actual: engApi.RunOptions, expected: engApi.RunOptions): void {
    expect(actual.logFolder).toEqual(expected.logFolder);
    expectEquivalentWorkspaces(actual.workspace, expected.workspace);
    expect(actual.pathStartPoints).toEqual(expected.pathStartPoints);
}

function expectEquivalentWorkspaces(actual: engApi.Workspace, expected: engApi.Workspace): void {
    expect(actual.getWorkspaceId()).toEqual(expected.getWorkspaceId());
    expect(actual.getFilesAndFolders()).toEqual(expected.getFilesAndFolders());
}
