import os from 'node:os';
import path from 'node:path';
import {
    DescribeOptions,
    EngineRunResults,
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
        it('TEMP TEST: Returns no rules', async () => {
            const engine: SfgeEngine = new SfgeEngine(DEFAULT_SFGE_ENGINE_CONFIG);
            await expect(engine.describeRules(createDescribeOptions())).resolves.toEqual([]);
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