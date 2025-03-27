import * as fs from "fs";
import path from "node:path";
import { CodeAnalyzer, CodeAnalyzerConfig, OutputFormat } from "../src";
import { RunResults, RunResultsImpl } from "../src/results";
import { RuleSelection, RuleSelectionImpl } from "../src/rules";
import * as stubs from "./stubs";
import { FixedClock } from "@salesforce/code-analyzer-engine-api/utils";
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

let runResults: RunResults;
let ruleSelection: RuleSelection;
let fixedTime: Date;

beforeAll(async () => {
    const codeAnalyzer: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
    fixedTime = new Date(2024, 6, 3, 9, 14, 34, 567);
    codeAnalyzer._setClock(new FixedClock(fixedTime));
    const stubPlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
    await codeAnalyzer.addEnginePlugin(stubPlugin);
    (stubPlugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1).resultsToReturn = {
        violations: [
            stubs.getSampleViolationForStub1RuleA(), stubs.getSampleViolationForStub1RuleAFromDirectoryWithSpaces(),
            stubs.getSampleViolationForStub1RuleC(), stubs.getSampleViolationForStub1RuleE()
        ]
    };
    (stubPlugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2).resultsToReturn = {
        violations: [stubs.getSampleViolationForStub2RuleC()]
    };
    (stubPlugin.getCreatedEngine('stubEngine3') as stubs.StubEngine3).resultsToReturn = {
        violations: [stubs.getSampleViolationForStub3RuleA()]
    }
    ruleSelection = await codeAnalyzer.selectRules(['all']);
    runResults = await codeAnalyzer.run(ruleSelection, {workspace: await codeAnalyzer.createWorkspace(['test'])});
});

describe("RunResultsFormatter Tests", () => {

    describe("Tests for the CSV output format", () => {
        it("When an empty result is provided, we create a csv text with headers but no rows", () => {
            const results: RunResults = new RunResultsImpl();
            const formattedText: string = results.toFormattedOutput(OutputFormat.CSV);
            const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.goldfile.csv');
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain multiple violations, we create csv text correctly", () => {
            const formattedText: string = runResults.toFormattedOutput(OutputFormat.CSV);
            const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.goldfile.csv');
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain violation of type UnexpectedError, we create csv text correctly", async () => {
            const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
            const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.CSV)
                .replace(/Error: SomeErrorMessageFromThrowingEngine[^"]*"/, 'SomeErrorMessageFromThrowingEngine"');
            const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.goldfile.csv');
            expect(formattedText).toEqual(expectedText);
        });
    });

    describe("Tests for the HTML output format", () => {
        it("When an empty result is provided, we create html text correctly", () => {
            const results: RunResultsImpl = new RunResultsImpl(new FixedClock(fixedTime));
            const formattedText: string = results.toFormattedOutput(OutputFormat.HTML).replaceAll('\r\n','\n');
            const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.goldfile.html', true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain multiple violations, we create html text correctly", async () => {
            const formattedText: string = runResults.toFormattedOutput(OutputFormat.HTML).replaceAll('\r\n','\n');
            const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.goldfile.html', true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain violation of type UnexpectedError, we create html text correctly", async () => {
            const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
            const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.HTML)
                .replace(/Error: SomeErrorMessageFromThrowingEngine[^"]*"/, 'SomeErrorMessageFromThrowingEngine"')
                .replaceAll('\r\n','\n');
            const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.goldfile.html', true);
            expect(formattedText).toEqual(expectedText);
        });
    });

    describe("Tests for the JSON output format", () => {
        it("When an empty result is provided, we create a json text with summary having zeros", () => {
            const results: RunResults = new RunResultsImpl();
            const formattedText: string = results.toFormattedOutput(OutputFormat.JSON);
            const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.goldfile.json', true, true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain multiple violations , we create json text correctly", async () => {
            const formattedText: string = runResults.toFormattedOutput(OutputFormat.JSON);
            const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.goldfile.json', true, true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain violation of type UnexpectedError, we create json text correctly", async () => {
            const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
            const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.JSON)
                .replace(/Error: SomeErrorMessageFromThrowingEngine[^"]*"/, 'SomeErrorMessageFromThrowingEngine"');
            const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.goldfile.json', true, true);
            expect(formattedText).toEqual(expectedText);
        });
    });

    describe("Tests for the XML output format", () => {
        it("When an empty result is provided, we create a xml text with summary having zeros", () => {
            const results: RunResults = new RunResultsImpl();
            const formattedText: string = results.toFormattedOutput(OutputFormat.XML);
            const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.goldfile.xml');
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain multiple violations , we create xml text correctly", () => {
            const formattedText: string = runResults.toFormattedOutput(OutputFormat.XML);
            const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.goldfile.xml');
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain violation of type UnexpectedError, we create xml text correctly", async () => {
            const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
            const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.XML)
                .replace(/Error: SomeErrorMessageFromThrowingEngine[^<]*</, 'SomeErrorMessageFromThrowingEngine<');
            const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.goldfile.xml');
            expect(formattedText).toEqual(expectedText);
        });
    });

    describe("Tests for the SARIF output format", () => {
        it("When an empty result is provided, we create a sarif text with summary having zeros", () => {
            const results: RunResults = new RunResultsImpl();
            const formattedText: string = results.toFormattedOutput(OutputFormat.SARIF);
            const expectedText: string = getContentsOfExpectedOutputFile('zeroViolations.goldfile.sarif', true, true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain multiple violations , we create sarif text correctly", () => {
            const formattedText: string = runResults.toFormattedOutput(OutputFormat.SARIF);
            const expectedText: string = getContentsOfExpectedOutputFile('multipleViolations.goldfile.sarif', true, true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When results contain violation of type UnexpectedError, we create sarif text correctly", async () => {
            const resultsWithUnexpectedError: RunResults = await createResultsWithUnexpectedError();
            const formattedText: string = resultsWithUnexpectedError.toFormattedOutput(OutputFormat.SARIF)
                .replace(/Error: SomeErrorMessageFromThrowingEngine[^"]*"/, 'SomeErrorMessageFromThrowingEngine"');
            const expectedText: string = getContentsOfExpectedOutputFile('unexpectedEngineErrorViolation.goldfile.sarif', true, true);
            expect(formattedText).toEqual(expectedText);
        });
    });

    describe("Other misc output formatting tests", () => {
        it("When an output format is not supported, then we error", () => {
            // This test is just a sanity check in case we add in an output format in the future without updating the
            // OutputFormat.forFormat factory method. We want to ensure an error will be thrown to alert us to the issue.

            // First we assert the error exists by forcefully casting a string to the output format to simulate a new one.
            const results: RunResults = new RunResultsImpl();
            const format: OutputFormat = "SomeUnsupportedFormat" as OutputFormat;
            expect(() => results.toFormattedOutput(format)).toThrow("Unsupported output format: SomeUnsupportedFormat");

            // Next we assert that all output formats in the enum are currently supported.
            for (const format of Object.values(OutputFormat)) {
                const output = results.toFormattedOutput(format);
                expect(typeof output).toEqual('string');
                expect(output.length).toBeGreaterThan(0);
            }
        });
    });
});

describe("RuleSelectionFormatter Tests", () => {

    describe("Tests for the JSON output format", () => {
        it("When no rules are selected, we create json text with an empty array", () => {
            const emptyRules: RuleSelection = new RuleSelectionImpl();
            const formattedText: string = emptyRules.toFormattedOutput(OutputFormat.JSON);
            const expectedText: string = getContentsOfExpectedOutputFile('zeroRules.goldfile.json', true, true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When multiple rules are selected, we create json text with a populated rules array", () => {
            const formattedText: string = ruleSelection.toFormattedOutput(OutputFormat.JSON);
            const expectedText: string = getContentsOfExpectedOutputFile('multipleRules.goldfile.json', true, true);
            expect(formattedText).toEqual(expectedText);
        });

        it("When a rule selection has a rule with no tags, there is a corresponding empty tag array in the json text output", async () => {
            const ruleSelectionWithEmptyTags: RuleSelection = await createRulesWithEmptyTags();
            const formattedText: string = ruleSelectionWithEmptyTags.toFormattedOutput(OutputFormat.JSON);
            const expectedText: string = getContentsOfExpectedOutputFile('ruleSelectionWithEmptyTags.goldfile.json', true, true);
            expect(formattedText).toEqual(expectedText);
        });
    });

    describe("Other misc output formatting tests", () => {
        it("When an output format is not supported, then we error", () => {
            const rules: RuleSelection = new RuleSelectionImpl();
            const format: OutputFormat = OutputFormat.XML;
            expect(() => rules.toFormattedOutput(format)).toThrow("Unsupported output format: XML");
        });
    });
});

function getContentsOfExpectedOutputFile(expectedOutputFileName: string, escapeBackslashesOnPaths: boolean = false, escapeBackslashesOnRunDir: boolean = false): string {
    const contents: string = fs.readFileSync(path.resolve('test','test-data','expectedOutputFiles',expectedOutputFileName), 'utf-8');
    let pathSepVar: string = path.sep;
    let runDirVar: string = process.cwd() + path.sep;
    const encodedRunDir: string = encodeURI(runDirVar);
    const escapedRunDir: string = runDirVar.replaceAll('\\', '\\\\');
    if (escapeBackslashesOnPaths) {
        pathSepVar = pathSepVar.replaceAll('\\','\\\\');
    }
    if (escapeBackslashesOnRunDir) {
        runDirVar = runDirVar.replaceAll('\\','\\\\');
    }
    const encodedPathSepVar: string = encodeURI(path.sep);

    const version: string = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;

    return contents.replaceAll('{{PATHSEP}}', pathSepVar)
        .replace("{{CORE_VERSION}}", version)
        .replaceAll(`{{ENCODEDPATHSEP}}`, encodedPathSepVar)
        .replaceAll('{{RUNDIR}}', runDirVar)
        .replaceAll('{{ENCODEDRUNDIR}}', encodedRunDir)
        .replaceAll('{{ESCAPEDRUNDIR}}', escapedRunDir)
        .replaceAll('{{###RUNDIR###}}', runDirVar)
        .replaceAll('{{###TIMESTAMP###}}', fixedTime.toLocaleString('en-us', {year: "numeric", month: "short",
            day: "numeric", hour: "numeric", minute: "numeric", hour12: true}))
}

async function createResultsWithUnexpectedError(): Promise<RunResults> {
    const codeAnalyzer: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
    codeAnalyzer._setClock(new FixedClock(fixedTime));
    await codeAnalyzer.addEnginePlugin(new stubs.ThrowingEnginePlugin());
    return codeAnalyzer.run(await codeAnalyzer.selectRules([]), {workspace: await codeAnalyzer.createWorkspace(['test'])});
}

async function createRulesWithEmptyTags(): Promise<RuleSelection> {
    const codeAnalyzer: CodeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
    codeAnalyzer._setClock(new FixedClock(fixedTime));
    await codeAnalyzer.addEnginePlugin(new stubs.EmptyTagEnginePlugin());
    return await codeAnalyzer.selectRules(['all'])
}
