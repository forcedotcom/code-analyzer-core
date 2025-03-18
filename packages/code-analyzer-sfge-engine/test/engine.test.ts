import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {
    DescribeOptions,
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunOptions,
    RunRulesProgressEvent,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {DEFAULT_SFGE_ENGINE_CONFIG} from "../src/config";
import {SfgeEngine} from "../src/engine";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

describe('SfgeEngine', () => {
    describe('#getName()', () => {
        it(`Returns 'sfge'`, () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            expect(engine.getName()).toEqual('sfge');
        });
    });

    describe('#getEngineVersion()', () => {
        it('Outputs something resembling a Semantic Version', async () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const version: string = await engine.getEngineVersion();

            expect(version).toMatch(/\d+\.\d+\.\d+.*/);
        });
    })

    describe('#describeRules()', () => {
        it('When no workspace is provided, all rules are returned', async () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
            const progressEvents: DescribeRulesProgressEvent[] = [];
            engine.onEvent(EventType.DescribeRulesProgressEvent, (e: DescribeRulesProgressEvent) => progressEvents.push(e));

            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());
            await expectRulesToMatchGoldfile(ruleDescriptions, 'all_rules.goldfile.json');

            // Also check that we have fine logs with the argument list and the duration in milliseconds.
            const fineLogEvents: LogEvent[] = logEvents.filter(e =>  e.logLevel === LogLevel.Fine);
            expect(fineLogEvents.length).toBeGreaterThanOrEqual(1);
            expect(fineLogEvents[0].message).toContain('Calling command:');

            // Also check that we have all the correct progress events
            expect(progressEvents.map(e => e.percentComplete)).toEqual([5, 14, 77, 86, 95, 100]);

            // Also sanity check that calling describeRules a second time gives save results (from cache):
            expect(await engine.describeRules(createDescribeOptions())).toEqual(ruleDescriptions);
        });

        it('When a workspace without Apex files is provided, no rules are returned', async () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([
                path.join(TEST_DATA_FOLDER, 'sampleIrrelevantWorkspace')
            ]);
            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));
            expect(ruleDescriptions).toHaveLength(0);
        });

        it('When a workspace with Apex files is provided, all rules are returned', async () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([
                path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace')
            ]);
            const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));
            await expectRulesToMatchGoldfile(ruleDescriptions, 'all_rules.goldfile.json');

        });
    });

    describe('#runRules()', () => {
        it('When no rule names are provided, no violations are returned', async () => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleWorkspace')]);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
            const progressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

            // ====== TESTED BEHAVIOR ======
            const results: EngineRunResults = await engine.runRules([], createRunOptions(workspace));

            // ====== ASSERTIONS ======
            // No violations
            expect(results.violations).toHaveLength(0);
            // Nothing notable happened, so no logs are expected.
            expect(logEvents).toHaveLength(0);
            // The progress events skip from the very first one (2%) to the very last one (100%).
            expect(progressEvents.map(e => e.percentComplete)).toEqual([2, 100]);
        });

        it.each([
            {case: 'a folder with no relevant files', workspacePath: path.join(TEST_DATA_FOLDER, 'sampleIrrelevantWorkspace')},
            {case: 'an irrelevant file', workspacePath: path.join(TEST_DATA_FOLDER, 'sampleIrrelevantWorkspace', 'someFile.txt')}
        ])('When workspace is $case, no violations are returned', async ({workspacePath}) => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([workspacePath]);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
            const progressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));
            const ruleNames: string[] = ['ApexFlsViolationRule'];

            // ====== TESTED BEHAVIOR ======
            const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

            // ====== ASSERTIONS ======
            // No violations
            expect(results.violations).toHaveLength(0);
            // Nothing notable happened, so no logs are expected.
            expect(logEvents).toHaveLength(0);
            // The progress events skip from the very first one (2%) to the very last one (100%).
            expect(progressEvents.map(e => e.percentComplete)).toEqual([2, 100]);
        });

        it.each([
            {case: 'a folder with relevant files that do not violate the selected rules', workspacePaths: [path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace')]},
            {
                case: 'a list of relevant files that do not violate the selected rules',
                workspacePaths: [
                    path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace', 'SomeClass.cls'),
                    path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace', 'SomeOtherClass.cls')
                ]
            }
        ])('When workspace is $case, no violations are returned', async ({workspacePaths}) => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace(workspacePaths);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
            const progressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));
            const ruleNames: string[] = ['RemoveUnusedMethod'];

            // ====== TESTED BEHAVIOR ======
            const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

            // ====== ASSERTIONS ======
            expect(results.violations).toHaveLength(0);
            // Make sure that we have no violations because SFGE was called and returned nothing, instead of some other reason.
            const fineLogEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Fine);
            expect(fineLogEvents.length).toBeGreaterThanOrEqual(2);
            expect(fineLogEvents[1].message).toContain('Calling command:');
            expect(fineLogEvents[1].message).toContain("execute");
            expect(progressEvents.map(pe => pe.percentComplete)).toEqual(
                [2, 2.3, 4.4, 4.7, 5, 6.86, 14.3, 22.21, 26.16, 34.06, 38.02, 85.45, 93.35, 98, 100]
            );
        });

        it.each([
            {case: 'a folder with a file that violates the selected rules', workspacePaths: [path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace')]},
            {
                case: 'a list of files including one that violates the selected rules',
                workspacePaths: [
                    path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace', 'SomeClass.cls'),
                    path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace', 'SomeOtherClass.cls')
                ]
            }
        ])('When workspace is $case, those violations are returned', async () => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace')]);
            const progressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));
            const ruleNames: string[] = ['ApexFlsViolationRule', 'UseWithSharingOnDatabaseOperation'];

            // ====== TESTED BEHAVIOR ======
            const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

            // ====== ASSERTIONS ======
            await expectResultsToMatchGoldfile(results, 'all_sampleRelevantWorkspace_violations.goldfile.json', path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace'));
            expect(progressEvents.map(pe => pe.percentComplete)).toEqual(
                [2, 2.3, 4.4, 4.7, 5, 6.86, 14.3, 22.21, 26.16, 34.06, 38.02, 85.45, 93.35, 98, 100]
            );
        });

        it('When only one of several selected rules is violated, violations are returned for only that rule', async () => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace')]);
            const progressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));
            const ruleNames: string[] = ['ApexFlsViolationRule', 'RemoveUnusedMethod'];

            // ====== TESTED BEHAVIOR ======
            const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

            // ====== ASSERTIONS ======
            await expectResultsToMatchGoldfile(results, 'ApexFlsViolationRule_sampleRelevantWorkspace_violations.goldfile.json', path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace'));
            const expectedProgressDescriptors: {percent: number, message?: string}[] = [
                {percent: 2, message: undefined},
                {percent: 2.3, message: undefined},
                {percent: 4.4, message: undefined},
                {percent: 4.7, message: undefined},
                {percent: 5, message: undefined},
                {percent: 6.86, message: undefined},
                {percent: 14.3, message: undefined},
                {percent: 22.21, message: 'Compiled 2 files.'},
                {percent: 26.16, message: 'Building graph.'},
                {percent: 34.06, message: 'Added all compilation units to graph.'},
                {percent: 38.02, message: 'Identified 1 path entry point(s).'},
                {percent: 85.45, message: 'Overall, analyzed 1 path(s) from 1 entry point(s). Detected 1 violation(s).'},
                {percent: 93.35, message: undefined},
                {percent: 98, message: undefined},
                {percent: 100, message: undefined}
            ];
            const actualProgressDescriptors: {percent: number, message?: string}[] = progressEvents.map(pe => {
                return {
                    percent: pe.percentComplete,
                    message: pe.message
                };
            });
            expect(actualProgressDescriptors).toEqual(expectedProgressDescriptors);
        });

        it('When a file cannot be scanned, an appropriate error is thrown', async () => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleInvalidWorkspace')]);
            const ruleNames: string[] = ['ApexFlsViolationRule', 'RemoveUnusedMethod'];

            // ====== TESTED BEHAVIOR/ASSERTIONS ======
            await expect(engine.runRules(ruleNames, createRunOptions(workspace)))
                .rejects.toThrow('Salesforce Graph Engine encountered an error and couldn\'t complete analysis: | Remove unreachable code to proceed with the analysis:');
        });

        it('When workspace is one relevant file in a folder with other relevant files, a warning is logged', async () => {
            // ====== SETUP ======
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace', 'SomeClass.cls')]);
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent) => logEvents.push(e));
            const ruleNames: string[] = ['ApexFlsViolationRule', 'RemoveUnusedMethod'];

            // ====== TESTED BEHAVIOR ======
            const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

            // ====== ASSERTIONS ======
            await expectResultsToMatchGoldfile(results, 'ApexFlsViolationRule_sampleRelevantWorkspace_violations.goldfile.json', path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace'));
            const warningLogEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Warn);
            expect(warningLogEvents.length).toBeGreaterThanOrEqual(1);
            expect(warningLogEvents[0].message).toEqual(`Specified workspace is missing 1 possibly-relevant file(s) in ${path.join(TEST_DATA_FOLDER, 'sampleRelevantWorkspace')}. SFGE results may be incomplete or incorrect.`);
        });
    });
})

async function expectRulesToMatchGoldfile(actualRuleDescriptions: RuleDescription[], relativeExpectedFile: string): Promise<void> {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(actualRuleDescriptions, null, 2);
    const expectedRuleDescriptionsJsonString: string = await fs.promises.readFile(
        path.join(TEST_DATA_FOLDER, 'goldfiles', relativeExpectedFile), 'utf-8'
    );
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}

async function expectResultsToMatchGoldfile(actualResults: EngineRunResults, relativeExpectedFile: string, runDir: string): Promise<void> {
    const actualResultsJsonString: string = JSON.stringify(actualResults, null, 2);
    const expectedResultsJsonString: string = (await fs.promises.readFile(
        path.join(TEST_DATA_FOLDER, 'goldfiles', relativeExpectedFile), 'utf-8'
    ))
        .replaceAll("{{RUNDIR}}", runDir)
        .replaceAll("{{PATHSEP}}", path.sep);
    expect(actualResultsJsonString).toEqual(expectedResultsJsonString);
}

function createDescribeOptions(workspace?: Workspace): DescribeOptions {
    return {
        logFolder: os.tmpdir(),
        workspace
    };
}

function createRunOptions(workspace: Workspace): RunOptions {
    return {
        logFolder: os.tmpdir(),
        workspace
    };
}