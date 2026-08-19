import { encode, type SourceMapSegment } from "@jridgewell/sourcemap-codec";
import { TraceMap, type SourceMapInput } from "@jridgewell/trace-mapping";
import { EngineRunResults, Workspace } from "@salesforce/code-analyzer-engine-api";
import * as path from "node:path";
import { UIBundleEngine } from "../src/engine";
import {
    containsDangerousApi,
    containsDangerousPattern,
    isAsset,
    isDependency,
    isVirtualSource,
    normalizeSourcePath,
} from "../src/validators/classification";
import { analyzeCoverage } from "../src/validators/coverage-analysis";
import { validateInvalidSourceReferences } from "../src/validators/invalid-source-references";
import { validateMissingSourcemaps } from "../src/validators/missing-sourcemap";
import { validatePathLeakage } from "../src/validators/path-leakage";
import { validateSourceContent } from "../src/validators/source-content-verification";
import {
    analyzeCoherence,
    pointsToWhitespaceOrComment,
    validateStructuralCoherence,
} from "../src/validators/structural-coherence";
import {
    analyzeTokenConsistency,
    classifyTokenAt,
    validateTokenConsistency,
} from "../src/validators/token-consistency";
import { validateVlqIntegrity } from "../src/validators/vlq-integrity";
import { changeWorkingDirectoryToPackageRoot, createRunOptions, installTmpDirCleanup, makeTmpDir, writeFile } from "./test-helpers";

changeWorkingDirectoryToPackageRoot();
installTmpDirCleanup();

describe('classification', () => {
    it('normalizes leading dot-slash and dot-dot segments and bundler URL schemes', () => {
        expect(normalizeSourcePath('./src/foo.js')).toEqual('src/foo.js');
        expect(normalizeSourcePath('../src/foo.js')).toEqual('src/foo.js');
        expect(normalizeSourcePath('/src/foo.js')).toEqual('src/foo.js');
        expect(normalizeSourcePath('webpack:///src/foo.js')).toEqual('src/foo.js');
        expect(normalizeSourcePath('webpack://src/foo.js')).toEqual('src/foo.js');
    });

    it('identifies virtual, dependency, and asset sources', () => {
        // The virtual predicate hits on bundler-runtime prefixes and query-string embellishments.
        expect(isVirtualSource('webpack/runtime/hasOwnProperty')).toEqual(true);
        expect(isVirtualSource('vite/dist/client/env.mjs')).toEqual(true);
        expect(isVirtualSource('src/x.js?vue&type=script')).toEqual(true);
        expect(isVirtualSource('src/x.js')).toEqual(false);
        expect(isDependency('node_modules/foo/index.js')).toEqual(true);
        expect(isDependency('packages/pkg/node_modules/foo/index.js')).toEqual(true);
        expect(isDependency('src/x.js')).toEqual(false);
        expect(isAsset('logo.png')).toEqual(true);
        expect(isAsset('src/x.ts')).toEqual(false);
    });

    it('flags dangerous API patterns in code and dangerous-only extras', () => {
        // Detects known API-scan strings (e.g. eval/Function tokens are stored split at rest).
        expect(containsDangerousApi('document.cookie = "x=1"')).toEqual(true);
        expect(containsDangerousApi('localStorage.setItem("a", "b")')).toEqual(true);
        expect(containsDangerousApi('const a = 1;')).toEqual(false);

        // AST-extra patterns catch bundler-safe helpers plus the base set.
        expect(containsDangerousPattern('fetch("https://x")')).toEqual(true);
        expect(containsDangerousPattern('doc.createElement("script")')).toEqual(true);
        expect(containsDangerousPattern('normal function foo() {}')).toEqual(false);
    });
});

describe('analyzeCoverage', () => {
    function makeTraceMapWithCoverage(mappings: SourceMapSegment[][]): TraceMap {
        const encoded = encode(mappings);
        return new TraceMap({
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encoded,
        } as SourceMapInput);
    }

    it('flags a long fully-unmapped line as an unmapped region', () => {
        const tracer = makeTraceMapWithCoverage([[]]);
        const compiled = 'a'.repeat(60) + '\n';
        const report = analyzeCoverage(tracer, compiled);
        expect(report.unmappedRegions.length).toBeGreaterThan(0);
        expect(report.unmappedRegions[0]!.length).toBeGreaterThanOrEqual(50);
    });

    it('does not flag a short line', () => {
        const tracer = makeTraceMapWithCoverage([[]]);
        const compiled = 'short\n';
        const report = analyzeCoverage(tracer, compiled);
        expect(report.unmappedRegions).toHaveLength(0);
    });

    it('exempts up to 150 chars on line 1 when computing excessive-unmapped budget', () => {
        // line 1 is fully unmapped but only 100 chars — should NOT count toward budget.
        const tracer = makeTraceMapWithCoverage([[]]);
        const compiled = 'a'.repeat(100) + '\n';
        const report = analyzeCoverage(tracer, compiled);
        expect(report.excessiveUnmapped).toEqual(false);
    });

    it('does not over-credit a minified line with a single mapping at column 0', () => {
        // A single mapping cannot silently credit the whole line — anything past the
        // per-mapping reach must be flagged unmapped and reduce mappedChars.
        const tracer = makeTraceMapWithCoverage([[[0, 0, 0, 0]]]);
        const lineLen = 5000;
        const compiled = 'a'.repeat(lineLen);
        const report = analyzeCoverage(tracer, compiled);
        expect(report.coveragePct).toBeLessThan(50);
        expect(report.unmappedRegions.length).toBeGreaterThan(0);
    });
});

describe('pointsToWhitespaceOrComment', () => {
    it('detects whitespace-only after column', () => {
        // Points into a run of trailing whitespace with no non-whitespace after it.
        expect(pointsToWhitespaceOrComment('let x = 1;    ', 0, 11)).toEqual(true);
    });
    it('detects line comment prefix', () => {
        expect(pointsToWhitespaceOrComment('// hello', 0, 0)).toEqual(true);
    });
    it('detects block comment prefix', () => {
        expect(pointsToWhitespaceOrComment('/* hello */', 0, 0)).toEqual(true);
    });
    it('returns false on a real identifier', () => {
        expect(pointsToWhitespaceOrComment('let x = 1;', 0, 4)).toEqual(false);
    });
});

describe('classifyTokenAt', () => {
    it('recognizes strings, numbers, identifiers, and punctuation', () => {
        expect(classifyTokenAt('"a"', 0, 0)).toEqual('StringLiteral');
        expect(classifyTokenAt("'a'", 0, 0)).toEqual('StringLiteral');
        expect(classifyTokenAt('`a`', 0, 0)).toEqual('StringLiteral');
        expect(classifyTokenAt('42', 0, 0)).toEqual('NumericLiteral');
        expect(classifyTokenAt('foo', 0, 0)).toEqual('Identifier');
        expect(classifyTokenAt('{', 0, 0)).toEqual('Punctuation');
        expect(classifyTokenAt(' ', 0, 0)).toEqual('Other');
        expect(classifyTokenAt('', 0, 0)).toEqual('Other');
        expect(classifyTokenAt('abc', 5, 0)).toEqual('Other');
    });
});

describe('analyzeCoherence', () => {
    it('reports zero bounds violations for an in-range mapping', () => {
        // Mapping [[[0,0,0,0]]] → generated line 1 col 0 → src 0 line 0 col 0
        const mapJson = {
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encode([[[0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const src = new Map<string, string>([['src/main.js', 'let x = 1;\nlet y = 2;\n']]);
        const report = analyzeCoherence(tracer, src);
        expect(report.totalMappingsChecked).toEqual(1);
        expect(report.boundsViolations).toHaveLength(0);
    });

    it('reports a bounds violation when the mapping claims a line past EOF', () => {
        // Segment [0,0,99,0] → src file line index 99 which does not exist.
        const mapJson = {
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encode([[[0, 0, 99, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const src = new Map<string, string>([['src/main.js', 'let x = 1;\n']]);
        const report = analyzeCoherence(tracer, src);
        expect(report.boundsViolations.length).toBeGreaterThan(0);
    });
});

describe('analyzeTokenConsistency', () => {
    it('returns a perfect score when compiled and source tokens agree', () => {
        // Both sides point to identifiers.
        const mapJson = {
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encode([[[0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = 'foo';
        const src = new Map<string, string>([['src/main.js', 'foo']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.totalSampled).toEqual(1);
        expect(report.consistencyScore).toEqual(1);
    });
});

describe('End-to-end validator dispatch (all rules together)', () => {
    it('dispatches all 8 rules against a fully-populated bundle without crashing', async () => {
        const engine = new UIBundleEngine();
        const tmp = makeTmpDir();
        writeFile(tmp, 'ui-bundle.json', '{}');

        const src = 'export const answer = 42;\n';
        const compiled = 'export const answer = 42;\n//# sourceMappingURL=main.js.map\n';
        writeFile(tmp, 'src/main.js', src);
        writeFile(tmp, 'dist/main.js', compiled);
        writeFile(tmp, 'dist/main.js.map', JSON.stringify({
            version: 3,
            sources: ['../src/main.js'],
            sourcesContent: [src],
            names: [],
            mappings: encode([[[0, 0, 0, 0]]]),
        }));

        const results: EngineRunResults = await engine.runRules(
            [
                'missing-sourcemap',
                'path-leakage',
                'invalid-source-references',
                'vlq-integrity',
                'source-content-verification',
                'coverage-analysis',
                'structural-coherence',
                'token-consistency',
            ],
            createRunOptions(new Workspace('id', [tmp])),
        );
        // Every violation should carry 1-based coordinates and be one of the 8 rule names.
        for (const v of results.violations) {
            expect([
                'missing-sourcemap',
                'path-leakage',
                'invalid-source-references',
                'vlq-integrity',
                'source-content-verification',
                'coverage-analysis',
                'structural-coherence',
                'token-consistency',
            ]).toContain(v.ruleName);
            expect(v.codeLocations[0]!.startLine).toBeGreaterThanOrEqual(1);
            expect(v.codeLocations[0]!.startColumn).toBeGreaterThanOrEqual(1);
        }
    });

    it('validators handle missing input paths gracefully', async () => {
        const missing = path.join(makeTmpDir(), 'does-not-exist');

        // Dist-only walkers silently return an empty result set for missing dirs.
        const missingRef = await validateInvalidSourceReferences(missing);
        expect(missingRef.findings).toEqual([]);
        const missingLeak = await validatePathLeakage(missing);
        expect(missingLeak.findings).toEqual([]);
        const missingVlq = await validateVlqIntegrity(missing);
        expect(missingVlq.findings).toEqual([]);

        // Explicit-stat validators emit a `skipped` reason instead.
        const missingMap = await validateMissingSourcemaps(missing);
        expect(missingMap.skipped).toBeDefined();
        const missingCoverage = await validateSourceContent({ sourcePath: missing, distPath: missing });
        expect(missingCoverage.skipped).toBeDefined();
        const missingCoh = await validateStructuralCoherence({ sourcePath: missing, distPath: missing });
        expect(missingCoh.skipped).toBeDefined();
        const missingTok = await validateTokenConsistency({ sourcePath: missing, distPath: missing });
        expect(missingTok.skipped).toBeDefined();
    });
});
