# @salesforce/code-analyzer-lwc-engine

POC implementation of the LWC compiler engine for Salesforce Code Analyzer.

This engine runs the LWC compiler (`@lwc/compiler`) against `.js` / `.html` / `.css`
files inside LWC component bundles and translates each `CompilerDiagnostic` into
a Code Analyzer `Violation`.

See [`handoff-notes/lwc-engine-spike-doc.md`](../../../handoff-notes/lwc-engine-spike-doc.md)
for the full design.

## Requirements

Full rule coverage needs **Node >= 20.19** (or >= 22.12). The platform rule ranges
(`@lwc/sfdc-lwc-compiler` 1500s, `@lwc/metadata` 1700s) are loaded via `import()`, which
relies on flagless `require(ESM)` — added in those Node versions. On Node 20.0–20.18 those
registries fail to load; this is non-fatal and the engine falls back to the open-source
range (codes 1001–1213 only), logging the reason at debug level. The `engines` floor stays
`>=20.0.0` to match the rest of the monorepo.

## Status

Draft / proof-of-concept. Not yet wired into `code-analyzer-core`'s plugin loader.
