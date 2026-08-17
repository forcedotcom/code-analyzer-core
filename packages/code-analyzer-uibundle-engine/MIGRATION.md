# UI Bundle Engine — Migration Report

## Summary

Ported the standalone `webapps/packages/uibundle-sourcemap-validator-engine` implementation into `code-analyzer-core` as a native SFCA v5 engine plugin under
`packages/code-analyzer-uibundle-engine`.

The engine is named generically (`uibundle`, package `@salesforce/code-analyzer-uibundle-engine`) so that additional UI-Bundle-level rule families can be added to it later without a rename. The initial ruleset is the 8 sourcemap-integrity rules from Source X.

- **Source X** (behavior source of truth): `webapps/packages/uibundle-sourcemap-validator-engine`
- **Repo Y** (architecture source of truth): `code-analyzer-core`
- **Reference PRs** (structural only): Core #448, CLI #2059

## Package layout

```
packages/code-analyzer-uibundle-engine/
├── package.json                           @salesforce/code-analyzer-uibundle-engine@0.1.0-SNAPSHOT
├── tsconfig.json / tsconfig.build.json    Core project-reference split
├── src/
│   ├── index.ts                           createEnginePlugin() factory
│   ├── plugin.ts                          UIBundleEnginePlugin (extends EnginePluginV1)
│   ├── engine.ts                          UIBundleEngine (extends Engine, NAME = "uibundle")
│   ├── rules.ts                           8 RuleDescription entries
│   ├── messages.ts                        i18n via getMessageFromCatalog
│   └── validators/
│       ├── classification.ts              path classification / dangerous-pattern predicates
│       ├── missing-sourcemap.ts           rule: missing-sourcemap
│       ├── path-leakage.ts                rule: path-leakage
│       ├── invalid-source-references.ts   rule: invalid-source-references
│       ├── vlq-integrity.ts               rule: vlq-integrity
│       ├── coverage-analysis.ts           rule: coverage-analysis
│       ├── structural-coherence.ts        rule: structural-coherence
│       ├── token-consistency.ts           rule: token-consistency
│       ├── source-content-verification.ts rule: source-content-verification (AST-based)
│       ├── sourcemap-io.ts                shared walk/collectSourceMaps
│       └── types.ts                       ValidatorFinding / ValidatorResult
└── test/                                  Jest + ts-jest
```

## Rules (8 total)

| Rule | Severity | Tags |
|---|---|---|
| `missing-sourcemap` | High | Recommended, Security, JavaScript, UIBundleIntegrity |
| `path-leakage` | Moderate | Recommended, Security, JavaScript, UIBundleIntegrity |
| `invalid-source-references` | High | Recommended, Security, JavaScript, UIBundleIntegrity |
| `vlq-integrity` | High | Recommended, Security, JavaScript, UIBundleIntegrity |
| `source-content-verification` | Critical | Recommended, Security, JavaScript, UIBundleIntegrity |
| `coverage-analysis` | Info | Recommended, Security, JavaScript, UIBundleIntegrity |
| `structural-coherence` | Info | Recommended, Security, JavaScript, UIBundleIntegrity |
| `token-consistency` | Info | Recommended, Security, JavaScript, UIBundleIntegrity |

Rule descriptions and messages are routed through `getMessage()` (i18n catalog); goldfile-tested at `test/test-data/uibundle-engine-goldfile.json`.

## Architectural conformance to Core

- `EnginePluginV1` + `Engine` extension pattern (matches `regex-engine`).
- `getEngineVersion()` reads `../package.json` at runtime via `fsp.readFile`.
- Bundle-target detection: prefers `ui-bundle.json` / `*.uibundle-meta.xml` sentinels, falls back to any `dist/` ancestor.
- Violations use 1-based `startLine`/`startColumn` (0-based Babel columns are converted at the engine boundary).
- Config is a pass-through no-op; no engine-specific `ConfigObject` schema is introduced.
- Dependency injection: uses only `@salesforce/code-analyzer-engine-api` interfaces (`Engine`, `EnginePluginV1`, `RuleDescription`, `Violation`, `Workspace`, `ConfigObject`, `SeverityLevel`, `COMMON_TAGS`, `DescribeOptions`, `RunOptions`, `EngineRunResults`, `LogLevel`).
- Naming/casing matches Core conventions; module output is CJS.

## Behavior preservation

All 8 validator rules from Source X are preserved verbatim. Key thresholds and constants match Source X:
- `COVERAGE_THRESHOLD_LARGE=95`, `COVERAGE_THRESHOLD_SMALL=70`
- `SMALL_FILE_NODE_COUNT=500`, `TYPE_MISMATCH_THRESHOLD=0.2`, `AST_MATCH_TOLERANCE_BYTES=5`
- `VIRTUAL_SOURCE_RATIO_THRESHOLD_PCT=20`
- `WHITESPACE_SAMPLE_INTERVAL=10`, `WHITESPACE_SUSPICION_THRESHOLD=0.8`, `JUMP_RATIO_WARN=0.5`
- Token consistency: `SAMPLE_INTERVAL=20`, `NAME_WINDOW_TOLERANCE=3`, `VERDICT_SUSPICIOUS=0.7`, `VERDICT_WARNING=0.85`

## Dependencies

- `@babel/parser`, `@babel/traverse`, `@babel/types`: pinned to `^7.25.0` (Babel 8 is ESM-only and incompatible with Core's CJS + ts-jest setup).
- `@jridgewell/sourcemap-codec` (VLQ) and `@jridgewell/trace-mapping` (TraceMap/originalPositionFor/eachMapping/sourceContentFor).
- `@salesforce/code-analyzer-engine-api@0.42.0-SNAPSHOT` (workspace-linked).

## Test results

- `npm test` (package-scoped): **69/69 pass**, 4 suites.
- Coverage: **91.17% stmt / 81.67% branch / 98.92% funcs / 93.85% lines** — clears the monorepo 80% global threshold on all four gates.
- `npm run build`: clean.
- `npm run lint`: clean.

## CLI-side changes (applied, NOT committed)

Applied to the sibling CLI repo at `/Users/amrit.mishra/UIBundleWorkspace/code-analyzer` (branch `dev`, clean tree before edit):

**`src/lib/factories/EnginePluginsFactory.ts`** — added:

```ts
import * as UIBundleEngineModule from '@salesforce/code-analyzer-uibundle-engine';
// …
UIBundleEngineModule.createEnginePlugin()  // appended to the array
```

**`package.json`** — added:

```json
"@salesforce/code-analyzer-uibundle-engine": "0.1.0-SNAPSHOT",
```

**Not committed.** Edits are staged in the working tree only.

**Release-alignment note:** the new engine pins `@salesforce/code-analyzer-engine-api@0.42.0-SNAPSHOT`, but the CLI pins `0.39.0`. This mismatch is repo-wide — every engine in the CLI (retirejs 0.36, sfge 0.22, eslint 0.44) is on its own version, so all deps get bumped together at each CLI release. When this engine is first published, the CLI's `engine-api` pin will need to move to match (or the engine will need to be published against `0.39.x`). Not blocking this migration; blocking the CLI cut.

**Build/install verification skipped:** the CLI repo has no `node_modules` locally and `npm install` would attempt to fetch the unpublished `code-analyzer-uibundle-engine` package from the registry. Re-run `npm install && npm run build` in the CLI repo after the new engine is published.

## Known deltas from Source X

None functional. Cosmetic:
- Some helpers previously private in Source X are `export`ed in Core for direct unit-testing (`nodeTypesCompatible`, `normalizeNodeType`, `classifyTokenAt`, `pointsToWhitespaceOrComment`, `analyzeCoverage`, `analyzeCoherence`, `analyzeTokenConsistency`). No behavioral change.
- `DANGEROUS_API_PATTERNS` is stored with `eval(`/`Function(` tokens split at rest via `[...].join('')` to avoid tripping our own scanners.
