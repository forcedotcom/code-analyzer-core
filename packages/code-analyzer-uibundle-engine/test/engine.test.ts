import {
    EngineRunResults,
    RuleDescription,
    Workspace,
} from "@salesforce/code-analyzer-engine-api";
import * as fs from "node:fs";
import * as path from "node:path";
import { UIBundleEngine } from "../src/engine";
import {
    changeWorkingDirectoryToPackageRoot,
    createDescribeOptions,
    createRunOptions,
    makeTmpDir,
    writeFile,
} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');
const GOLDFILE = 'uibundle-engine-goldfile.json';

describe('UIBundleEngine Tests', () => {
    let expectedRules: RuleDescription[];

    beforeAll(async () => {
        const raw = await fs.promises.readFile(path.join(TEST_DATA_FOLDER, GOLDFILE), 'utf-8');
        expectedRules = JSON.parse(raw) as RuleDescription[];
    });

    describe('getName', () => {
        it('When getName is called, then the engine name is returned', () => {
            const engine = new UIBundleEngine();
            expect(engine.getName()).toEqual('uibundle');
        });
    });

    describe('getEngineVersion', () => {
        it('Outputs something resembling a semantic version', async () => {
            const engine = new UIBundleEngine();
            const version = await engine.getEngineVersion();
            expect(version).toMatch(/\d+\.\d+\.\d+.*/);
        });
    });

    describe('describeRules', () => {
        it('When describeRules is called, then all rules are returned', async () => {
            const engine = new UIBundleEngine();
            const rules = await engine.describeRules(createDescribeOptions());
            expect(rules).toEqual(expectedRules);
        });
    });

    describe('runRules', () => {
        it('When zero rule names are provided, then zero violations are returned', async () => {
            const engine = new UIBundleEngine();
            const results: EngineRunResults = await engine.runRules(
                [],
                createRunOptions(new Workspace('id', [TEST_DATA_FOLDER])),
            );
            expect(results.violations).toHaveLength(0);
        });

        it('When no bundle targets are found in the workspace, then zero violations are returned', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'README.md', '# not a bundle');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations).toHaveLength(0);
        });

        it('missing-sourcemap: raises a violation when a compiled .js has no adjacent .js.map and no //# sourceMappingURL', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hello");\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            const v = results.violations[0]!;
            expect(v.ruleName).toEqual('missing-sourcemap');
            expect(v.codeLocations[0]!.file).toContain(path.join('dist', 'main.js'));
            expect(v.codeLocations[0]!.startLine).toBeGreaterThanOrEqual(1);
            expect(v.codeLocations[0]!.startColumn).toBeGreaterThanOrEqual(1);
        });

        it('missing-sourcemap: no violation when a co-located .js.map exists', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hello");\n//# sourceMappingURL=main.js.map\n');
            writeFile(tmp, 'dist/main.js.map', JSON.stringify({
                version: 3,
                sources: ['../src/main.js'],
                names: [],
                mappings: '',
            }));
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations).toHaveLength(0);
        });

        it('path-leakage: raises a violation when sources[] contains an absolute unix home path', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'x\n');
            writeFile(tmp, 'dist/main.js.map', JSON.stringify({
                version: 3,
                sources: ['/Users/attacker/src/main.js'],
                names: [],
                mappings: '',
            }));
            const results: EngineRunResults = await engine.runRules(
                ['path-leakage'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            const leakage = results.violations.filter(v => v.ruleName === 'path-leakage');
            expect(leakage.length).toBeGreaterThan(0);
        });

        it('vlq-integrity: raises a violation when the sourcemap JSON has no "mappings" field', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'x\n');
            writeFile(tmp, 'dist/main.js.map', JSON.stringify({
                version: 3,
                sources: ['../src/main.js'],
                names: [],
            }));
            const results: EngineRunResults = await engine.runRules(
                ['vlq-integrity'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            const vlq = results.violations.filter(v => v.ruleName === 'vlq-integrity');
            expect(vlq.length).toBeGreaterThan(0);
        });

        it('vlq-integrity: raises a violation when segment source index is out of range', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'x\n');
            // Single VLQ segment "AICA" decodes to [0, 1, 1, 0] — source index 1,
            // but sources.length is 1 (indices 0..0), so 1 is out of range.
            writeFile(tmp, 'dist/main.js.map', JSON.stringify({
                version: 3,
                sources: ['../src/main.js'],
                names: [],
                mappings: 'AICA',
            }));
            const results: EngineRunResults = await engine.runRules(
                ['vlq-integrity'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            const vlq = results.violations.filter(v => v.ruleName === 'vlq-integrity');
            expect(vlq.length).toBeGreaterThan(0);
        });

        it('invalid-source-references: raises a violation when a sources[] entry does not exist on disk', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'x\n');
            writeFile(tmp, 'dist/main.js.map', JSON.stringify({
                version: 3,
                sources: ['../src/missing.js'],
                names: [],
                mappings: '',
            }));
            // Note: no src/missing.js on disk
            const results: EngineRunResults = await engine.runRules(
                ['invalid-source-references'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            const badRefs = results.violations.filter(v => v.ruleName === 'invalid-source-references');
            expect(badRefs.length).toBeGreaterThan(0);
        });

        it('bundle target detection: workspace containing files under dist/ still triggers rule execution', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            // No ui-bundle.json here — the engine should fall back to detecting bundles from any dist/ ancestor.
            writeFile(tmp, 'my-bundle/dist/main.js', 'console.log("hi");\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('violations use 1-based line and column numbers', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'x\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations[0]!.codeLocations[0]!.startLine).toBeGreaterThanOrEqual(1);
            expect(results.violations[0]!.codeLocations[0]!.startColumn).toBeGreaterThanOrEqual(1);
        });
    });
});
