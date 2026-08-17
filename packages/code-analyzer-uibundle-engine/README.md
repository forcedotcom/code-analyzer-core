# @salesforce/code-analyzer-uibundle-engine

The **uibundle** engine plugin for Salesforce Code Analyzer (SFCA v5+).

Validates the integrity of a UI Bundle's compiled JavaScript output against its submitted source. Runs alongside the other engines (ESLint, PMD, RetireJS, etc.) when you invoke `sf code-analyzer run`.

## What this engine is for

When someone ships a UI Bundle, the artifact that ends up in production is compiled JavaScript in `dist/`, not the human-written source in `src/`. The compiled code is opaque, but every reputable build tool also emits a **sourcemap** — a JSON file that claims each byte of compiled output came from a specific location in the source.

Sourcemaps are how a reviewer verifies that "what's shipped is what was written." But sourcemaps are just JSON, so nothing prevents them from being **fabricated**: a well-formed sourcemap can point to plausible-looking source that has nothing to do with the compiled code. If the reviewer only looks at the source and trusts the sourcemap, unmapped or misrepresented code can sail through review.

This engine runs a battery of checks against the sourcemap–source–compiled triple to catch:
- Missing / malformed sourcemaps,
- Sourcemaps that leak developer environment details,
- Sourcemaps that reference sources that don't exist,
- Sourcemaps whose byte content disagrees with the shipped source,
- Compiled code that has **no** provenance back to the submitted source (unmapped or orphan regions), and
- Sourcemaps whose token structure looks fabricated rather than emitted by a real bundler.

## When to use it

- **UI Bundle security review** — as a gate before a bundle is approved for packaging or release.
- **CI on any repo that ships bundled JavaScript** to a Salesforce-managed surface — catches build-tool misconfiguration (missing sourcemaps, absolute-path leaks) before it lands.
- **Ad-hoc audits** of a shipped bundle — point the analyzer at a directory containing a `dist/` and get a per-file report.

You do **not** need to configure it. The engine is pass-through and auto-detects bundle targets in the workspace.

## How bundle targets are detected

The engine scans the workspace for a `dist/` directory. A "bundle root" is:

1. **Preferred:** the directory containing a `ui-bundle.json` file or a `*.uibundle-meta.xml` file.
2. **Fallback:** any ancestor directory of a file under a `dist/` folder.

For each bundle root, it uses `<root>/dist/` for the compiled output. If a sibling `<root>/src/` exists, the source-aware rules run too; if not, they're skipped with a warning and only the dist-only rules run.

## The rules

Eight rules ship on day one. All are tagged `Recommended`, `Security`, `JavaScript`, and `UIBundleIntegrity`.

| Rule | Severity | Needs `src/`? |
|---|---|---|
| [`missing-sourcemap`](#missing-sourcemap) | High | no |
| [`path-leakage`](#path-leakage) | Moderate | no |
| [`invalid-source-references`](#invalid-source-references) | High | no |
| [`vlq-integrity`](#vlq-integrity) | High | no |
| [`source-content-verification`](#source-content-verification) | **Critical** | yes |
| [`coverage-analysis`](#coverage-analysis) | Info | no |
| [`structural-coherence`](#structural-coherence) | Info | yes |
| [`token-consistency`](#token-consistency) | Info | yes |

Rules marked "Needs `src/`? yes" require the submitted source tree to be present alongside `dist/`. Without it those rules are skipped for that bundle.

---

### `missing-sourcemap`

**What it checks.** Every `.js` file under `dist/` has either a co-located `.js.map` on disk **or** a `//# sourceMappingURL=...` comment pointing at one.

**Why it matters.** A compiled `.js` without a sourcemap is fully opaque — a reviewer cannot verify what it was compiled from. Beyond auditability, an unmapped `.js` inside an otherwise-mapped bundle is a red flag: legitimate build tools emit sourcemaps uniformly for all outputs.

**How it works.** Walks `dist/` for `.js` files. For each, checks for a `.js.map` sibling, reads the last few KB looking for a `//# sourceMappingURL=` comment, and if the comment resolves to a file that also exists on disk. If neither is present, files a `MissingSourcemapForFile` finding.

**Extra check.** If an unmapped ("orphan") `.js` file contains any known-dangerous API pattern (e.g. `document.cookie`, `localStorage.setItem`, `innerHTML=`, `fetch(`, `atob(`, and the like), files an additional `OrphanJsWithDangerousApi` finding — orphan code with dangerous surface area is treated as a signal of unmapped/injected code rather than a bundler runtime shim.

---

### `path-leakage`

**What it checks.** Every entry in the sourcemap's `sources[]` array is a relative path — not an absolute local path.

**Why it matters.** Sourcemaps ride into production. An absolute path like `/Users/jane/code/my-app/src/…` or `C:\Users\jane\projects\…` leaks the developer's username and filesystem layout to anyone who downloads the shipped bundle. Beyond the disclosure, it's a build-tool misconfiguration signal — properly configured build tools emit portable relative paths.

**How it works.** Walks `dist/` for `*.js.map`. Parses each. For every `sources[]` entry, tests against a set of platform-specific absolute-path prefixes (`/Users/`, `/home/`, `/root/`, `C:\`, `D:\`, `\\?\`, `file:///`, etc.).

---

### `invalid-source-references`

**What it checks.** Every file in the sourcemap's `sources[]` list exists on disk (relative to the sourcemap's own directory), *unless* it's covered by an inline `sourcesContent` entry, is a virtual bundler-runtime path, or is a remote URL.

**Why it matters.** A sourcemap that claims to map to `../src/foo.js` when no such file exists is either broken or tampered with. Either the reviewer can't verify the claim, or the sourcemap is lying about where the compiled code came from.

**How it works.** Walks `dist/` for `*.js.map`. For each `sources[i]`:
- Skip if `sourcesContent[i]` is a non-null string (inline verification handled elsewhere).
- Skip if the source is a bundler virtual path (`webpack/runtime/…`, `vite/dist/…`, query-string-embellished `?vue&type=…`, etc.).
- Skip if it's a remote URL (`http://`, `https://`, `data:`).
- Otherwise, resolve to a real path and check `fs.stat`. Missing → finding.

---

### `vlq-integrity`

**What it checks.** The sourcemap's `mappings` string parses as valid Base64 VLQ, and every decoded segment references in-range `sources[]` and `names[]` indices.

**Why it matters.** VLQ segments are the smallest verifiable unit of a sourcemap. Malformed VLQ or out-of-range indices are a red flag: they indicate either a corrupted build, a fabricated sourcemap, or a deliberately truncated one designed to hide unmapped ranges.

**How it works.** Uses [`@jridgewell/sourcemap-codec`](https://github.com/jridgewell/sourcemap-codec) to decode `mappings` into `[genCol, sourceIdx, srcLine, srcCol, nameIdx]` segments. Emits:
- `SourcemapNotValidJson` / `SourcemapMissingMappings` / `SourcemapMissingSourcesArray` if the map JSON is unusable.
- `VlqDecodingFailed` if decoding throws.
- `SegmentSourceIndexOutOfRange` / `SegmentNameIndexOutOfRange` for any segment whose source or name index falls outside the declared arrays.

---

### `source-content-verification`  🔒 **Critical**

**What it checks.** This is the heavy hitter. AST-based verification that the compiled JS *actually* traces back to the submitted source. Combines several sub-checks:

1. **Byte-equal sourcesContent.** For every source listed in `sources[]` that has an inline `sourcesContent[i]`, compares that inline content byte-for-byte against the submitted `src/` tree. Any mismatch → `SourceContentBytewiseMismatch`.
2. **Virtual-source ratio cap.** No more than **20%** of a sourcemap's `sources[]` may be bundler-virtual paths. Above that ratio → `SourceContentExcessiveVirtualSources`. Reason: an attacker who fabricates a mostly-virtual sourcemap can hide arbitrary compiled code behind opaque virtual entries.
3. **AST-node coverage.** Parses the compiled JS with `@babel/parser`, walks with `@babel/traverse`, and for every "significant" AST node (identifiers, member accesses, calls, declarations, etc.) checks whether `originalPositionFor` returns a mapping. Coverage thresholds: **95%** for large files (500+ nodes), **70%** for small files. Below → `SourceContentCoverageBelowThreshold`.
4. **AST type-mismatch.** For each *mapped* node, compares the compiled node type against the AST node at the claimed source position. Unrelated types (e.g. compiled says `CallExpression`, source position says `StringLiteral`) are counted. Over **20%** mismatches → `SourceContentTypeMismatchRatio`. Prevents fabricated maps that satisfy coverage by pointing every node at plausible-but-unrelated source locations.
5. **Dangerous-in-unmapped scan.** For any *unmapped* AST node whose text matches a dangerous-API pattern, files an individual `SourceContentDangerousUnmapped` finding — flags injected code that hides in coverage gaps.
6. **Orphan mapped sources.** Any source referenced by mapped nodes that isn't present in the submitted `src/` tree → `SourceContentOrphanSources`. The compiled bundle claims provenance from a file that was never submitted for review.

**Why it matters.** Everything else in this engine is structural. This rule is what actually enforces "what's shipped is what was written." A bundle that clears every other rule but fails this one has a sourcemap that *looks* well-formed but doesn't correspond to reality.

**Constants.**
- `AST_MATCH_TOLERANCE_BYTES = 5` — how close a compiled node's source-mapped position must be to a real AST node in the source.
- `SMALL_FILE_NODE_COUNT = 500`, `COVERAGE_THRESHOLD_LARGE = 95%`, `COVERAGE_THRESHOLD_SMALL = 70%`.
- `TYPE_MISMATCH_THRESHOLD = 20%`.
- `VIRTUAL_SOURCE_RATIO_THRESHOLD_PCT = 20%`.

---

### `coverage-analysis`  ℹ️ informational

**What it checks.** Character-level (not AST-level) coverage of the compiled JS. Complements `source-content-verification` — that rule reasons about AST nodes; this one reasons about raw character regions.

**Why it matters.** Even a bundle that passes AST coverage can have large unmapped character ranges (e.g. a huge inline string constant that the AST treats as one node). Character-level flagging surfaces those.

**How it works.**
- **Per-line unmapped regions.** Any run of 50+ consecutive characters on a single line with no sourcemap coverage → `CoverageUnmappedRegion`.
- **Cumulative cap.** If more than 2% of the file's total characters are unmapped, files `CoverageExcessiveCumulative`. Line 1's first 150 characters are discounted (build-tool preambles, banners, and copyright headers legitimately have no source mapping).

---

### `structural-coherence`  ℹ️ informational

**What it checks.** The sourcemap tokens themselves look coherent — not fabricated. Three sub-checks.

**Why it matters.** A hand-crafted or fabricated sourcemap tends to have telltale structural artifacts: mappings that reference lines past the end of a file, mappings that point exclusively at whitespace or comments, or unnatural cross-file jumps.

**How it works.**
- **Bounds violations.** For every mapping, check whether the claimed source line exists in the source file. Out-of-bounds → `CoherenceBoundsSummary`+`CoherenceBoundsDetail`.
- **Whitespace/comment sampling.** Sample every 10th mapping; check whether it points at whitespace or a comment prefix (`//`, `/*`) in the source. Above **80%** → `CoherenceWhitespaceSuspicious`. Real bundlers emit tokens pointing at code, not padding.
- **Cross-file jump ratio.** For consecutive tokens on the same generated line, count how many jump between source files. Above **50%** → `CoherenceCrossFileJumpsSuspicious`. Normal bundlers group same-file mappings together.

**Constants.** `WHITESPACE_SAMPLE_INTERVAL = 10`, `WHITESPACE_SUSPICION_THRESHOLD = 0.8`, `JUMP_RATIO_WARN = 0.5`.

---

### `token-consistency`  ℹ️ informational

**What it checks.** Sampled sourcemap tokens agree in type between the compiled position and the claimed source position. And named tokens (`names[]` entries) actually appear at the claimed source position.

**Why it matters.** A fabricated sourcemap can satisfy coverage checks while pointing every mapping at semantically unrelated source. Type-level checks catch that: if the compiled position is a `StringLiteral` but the claimed source position is a `Punctuation`, the mapping is likely fake.

**How it works.**
- Sample every 20th sourcemap mapping. For each, classify the token at the compiled position and at the claimed source position; both should be the same broad category (`Identifier`, `StringLiteral`, `NumericLiteral`, `Punctuation`, `Other`).
- Score = matches / sampled. Below **85%** → `TokenConsistencyBelowWarning`; below **70%** → `TokenConsistencySuspicious`.
- For every `names[]` entry, verify the name text actually appears within ±3 columns of the mapping's claimed source position. Misses → `TokenNameMismatchSummary`+`TokenNameMismatchDetail`.

**Constants.** `SAMPLE_INTERVAL = 20`, `NAME_WINDOW_TOLERANCE = 3`, `VERDICT_SUSPICIOUS = 0.7`, `VERDICT_WARNING = 0.85`.

---

## How rules interact

There's deliberate overlap between the rules — each catches a different class of tampering, and defense-in-depth is the point. In rough order of "how obvious is the problem":

1. `missing-sourcemap` — is there a sourcemap at all?
2. `vlq-integrity` — does the sourcemap parse?
3. `invalid-source-references` — do the referenced sources exist?
4. `path-leakage` — do those references look local/portable?
5. `coverage-analysis` — do the mappings cover most of the compiled output?
6. `structural-coherence` + `token-consistency` — do the mappings look emitted by a real bundler?
7. `source-content-verification` — does the shipped source actually match what the sourcemap claims?

A bundle can fail an earlier rule and pass later ones (e.g. a missing sourcemap short-circuits everything for that file). A bundle can pass the earlier rules and fail the last one — that's the case worth reviewing most carefully.

## Configuration

None. The engine takes no `ConfigObject` and has no tuning knobs — it's opinionated by design. The thresholds and constants documented above are baked in.

## Package internals

```
src/
├── index.ts                            createEnginePlugin() factory
├── plugin.ts                           UIBundleEnginePlugin (extends EnginePluginV1)
├── engine.ts                           UIBundleEngine (extends Engine, NAME = "uibundle")
├── rules.ts                            8 RuleDescription entries
├── messages.ts                         i18n message catalog
└── validators/
    ├── classification.ts               path classification + dangerous-pattern predicates
    ├── missing-sourcemap.ts            rule: missing-sourcemap
    ├── path-leakage.ts                 rule: path-leakage
    ├── invalid-source-references.ts    rule: invalid-source-references
    ├── vlq-integrity.ts                rule: vlq-integrity
    ├── coverage-analysis.ts            rule: coverage-analysis
    ├── structural-coherence.ts         rule: structural-coherence
    ├── token-consistency.ts            rule: token-consistency
    ├── source-content-verification.ts  rule: source-content-verification (AST-based)
    ├── sourcemap-io.ts                 shared walk/collectSourceMaps
    └── types.ts                        ValidatorFinding / ValidatorResult
```

Depends on:
- [`@jridgewell/sourcemap-codec`](https://github.com/jridgewell/sourcemap-codec) — VLQ encode/decode
- [`@jridgewell/trace-mapping`](https://github.com/jridgewell/trace-mapping) — `TraceMap`, `originalPositionFor`, `eachMapping`
- [`@babel/parser`](https://babeljs.io/docs/babel-parser) + [`@babel/traverse`](https://babeljs.io/docs/babel-traverse) + [`@babel/types`](https://babeljs.io/docs/babel-types)
- [`@salesforce/code-analyzer-engine-api`](https://github.com/forcedotcom/code-analyzer-core)

## Development

```
npm run build   # tsc --build tsconfig.build.json
npm run lint    # eslint src/**/*.ts
npm test        # jest --coverage
```

Testing conventions match the other engines in `code-analyzer-core` — jest + ts-jest, with rule descriptions validated against a goldfile at `test/test-data/uibundle-engine-goldfile.json`.

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
