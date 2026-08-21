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
    installTmpDirCleanup,
    makeTmpDir,
    writeFile,
} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();
installTmpDirCleanup();

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

        it('missing-sourcemap: raises a violation when //# sourceMappingURL points at a nonexistent .map file', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hello");\n//# sourceMappingURL=nonexistent.map\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: raises a violation when //# sourceMappingURL is a remote HTTP URL (unverifiable locally)', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hi");\n//# sourceMappingURL=https://evil.example/fake.map\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: raises a violation when //# sourceMappingURL is an inline data URL (no downstream validator decodes it)', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("ok");\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: raises a violation when //# sourceMappingURL points at a non-sourcemap file (evades downstream scans)', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hi");\n//# sourceMappingURL=../README.md\n');
            writeFile(tmp, 'README.md', '# not a sourcemap\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: raises a violation when the colocated .js.map is a directory (walk skips non-files)', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hi");\n');
            writeFile(tmp, 'dist/main.js.map/placeholder', 'x');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: raises a violation when //# sourceMappingURL points outside distPath', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hi");\n//# sourceMappingURL=../planted.js.map\n');
            writeFile(tmp, 'planted.js.map', JSON.stringify({
                version: 3,
                sources: ['../src/main.js'],
                names: [],
                mappings: '',
            }));
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: raises a violation when //# sourceMappingURL is a self-reference to the .js file', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hi");\n//# sourceMappingURL=main.js\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
        });

        it('missing-sourcemap: no violation when //# sourceMappingURL points at a real .js.map at a custom path', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'console.log("hi");\n//# sourceMappingURL=elsewhere.js.map\n');
            writeFile(tmp, 'dist/elsewhere.js.map', JSON.stringify({
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

        const perRuleViolationCases: Array<{ desc: string; rule: string; mapJson: unknown }> = [
            {
                desc: 'path-leakage: absolute unix home path in sources[]',
                rule: 'path-leakage',
                mapJson: {
                    version: 3,
                    sources: ['/Users/attacker/src/main.js'],
                    names: [],
                    mappings: '',
                },
            },
            {
                desc: 'vlq-integrity: sourcemap JSON has no "mappings" field',
                rule: 'vlq-integrity',
                mapJson: {
                    version: 3,
                    sources: ['../src/main.js'],
                    names: [],
                },
            },
            {
                desc: 'vlq-integrity: segment source index out of range',
                rule: 'vlq-integrity',
                mapJson: {
                    version: 3,
                    sources: ['../src/main.js'],
                    names: [],
                    mappings: 'AICA',
                },
            },
            {
                desc: 'invalid-source-references: sources[] entry does not exist on disk',
                rule: 'invalid-source-references',
                mapJson: {
                    version: 3,
                    sources: ['../src/missing.js'],
                    names: [],
                    mappings: '',
                },
            },
        ];

        it.each(perRuleViolationCases)('$desc', async ({ rule, mapJson }) => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/main.js', 'x\n');
            writeFile(tmp, 'dist/main.js.map', JSON.stringify(mapJson));
            const results: EngineRunResults = await engine.runRules(
                [rule],
                createRunOptions(new Workspace('id', [tmp])),
            );
            const matched = results.violations.filter(v => v.ruleName === rule);
            expect(matched.length).toBeGreaterThan(0);
        });

        it.each([
            { ext: 'mjs', desc: 'ESM output' },
            { ext: 'cjs', desc: 'CommonJS output' },
        ])('missing-sourcemap: flags orphan dist/main.$ext ($desc) without a co-located sourcemap', async ({ ext }) => {
            // Bundlers configured for ESM (.mjs) or CJS (.cjs) output must be scanned the
            // same as .js output — otherwise an attacker could ship a tampered .mjs bundle
            // with no sourcemap and every tamper detector would silently skip the file.
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, `dist/main.${ext}`, 'export const x = 1;\n');
            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.length).toBeGreaterThan(0);
            expect(results.violations[0]!.ruleName).toEqual('missing-sourcemap');
            expect(results.violations[0]!.codeLocations[0]!.file).toContain(`main.${ext}`);
        });

        it.each([
            { ext: 'mjs' },
            { ext: 'cjs' },
        ])('path-leakage: fires on a .$ext bundle with a leaked absolute path in sources[]', async ({ ext }) => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, `dist/main.${ext}`, 'x\n');
            writeFile(tmp, `dist/main.${ext}.map`, JSON.stringify({
                version: 3,
                sources: ['/Users/attacker/src/main.js'],
                names: [],
                mappings: '',
            }));
            const results: EngineRunResults = await engine.runRules(
                ['path-leakage'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.some(v => v.ruleName === 'path-leakage')).toBe(true);
        });

        it.each([
            { ext: 'mjs' },
            { ext: 'cjs' },
        ])('vlq-integrity: scans .$ext.map sourcemaps for out-of-range source indices', async ({ ext }) => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, `dist/main.${ext}`, 'x\n');
            writeFile(tmp, `dist/main.${ext}.map`, JSON.stringify({
                version: 3,
                sources: ['../src/main.js'],
                names: [],
                mappings: 'AICA', // second field = source index 1, out of range for 1-entry sources[]
            }));
            const results: EngineRunResults = await engine.runRules(
                ['vlq-integrity'],
                createRunOptions(new Workspace('id', [tmp])),
            );
            expect(results.violations.some(v => v.ruleName === 'vlq-integrity')).toBe(true);
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

        it('emits SFCA 1-based startColumn for whole-file findings across missing-sourcemap, path-leakage, invalid-source-references and coverage-analysis', async () => {
            const engine = new UIBundleEngine();
            const tmp = makeTmpDir();
            writeFile(tmp, 'ui-bundle.json', '{}');
            writeFile(tmp, 'dist/orphan.js', 'document.cookie = "x=1";\n');
            writeFile(tmp, 'dist/main.js', 'a'.repeat(200) + '\n');
            writeFile(tmp, 'dist/main.js.map', JSON.stringify({
                version: 3,
                sources: ['/Users/attacker/src/main.js', '../src/missing.js'],
                names: [],
                mappings: '',
            }));

            const results: EngineRunResults = await engine.runRules(
                ['missing-sourcemap', 'path-leakage', 'invalid-source-references', 'coverage-analysis'],
                createRunOptions(new Workspace('id', [tmp])),
            );

            const byRule = new Map<string, number>();
            for (const v of results.violations) {
                byRule.set(v.ruleName, (byRule.get(v.ruleName) ?? 0) + 1);
                expect(v.codeLocations[0]!.startLine).toBeGreaterThanOrEqual(1);
                expect(v.codeLocations[0]!.startColumn).toBeGreaterThanOrEqual(1);
            }
            expect(byRule.get('missing-sourcemap')).toBeGreaterThan(0);
            expect(byRule.get('path-leakage')).toBeGreaterThan(0);
            expect(byRule.get('invalid-source-references')).toBeGreaterThan(0);

            const wholeFile = results.violations.filter(v =>
                v.ruleName === 'missing-sourcemap' ||
                v.ruleName === 'path-leakage' ||
                v.ruleName === 'invalid-source-references'
            );
            expect(wholeFile.length).toBeGreaterThan(0);
            for (const v of wholeFile) {
                expect(v.codeLocations[0]!.startColumn).toEqual(1);
            }
        });
    });
});
