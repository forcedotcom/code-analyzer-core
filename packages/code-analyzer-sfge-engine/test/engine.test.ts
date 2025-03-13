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
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleWorkspace')]);
            const results: EngineRunResults = await engine.runRules([], createRunOptions(workspace));
            expect(results.violations).toHaveLength(0);
        });

        it.skip('When workspace contains no relevant files, no violations are returned', async () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            const workspace: Workspace = new Workspace([path.join(TEST_DATA_FOLDER, 'sampleWorkspace', 'notARealFile.txt')]);
            // TODO: ADD SOME ACTUAL RULES HERE.
            const ruleNames: string[] = ['ThisIsNotARealRule'];
            const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));
            expect(results.violations).toHaveLength(0);
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