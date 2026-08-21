# @salesforce/code-analyzer-lwc-engine

POC implementation of the LWC compiler engine for Salesforce Code Analyzer.

This engine runs the LWC compiler (`@lwc/compiler`) against `.js` / `.html` / `.css`
files inside LWC component bundles and translates each `CompilerDiagnostic` into
a Code Analyzer `Violation`.

See [`handoff-notes/lwc-engine-spike-doc.md`](../../../handoff-notes/lwc-engine-spike-doc.md)
for the full design.

## Status

Draft / proof-of-concept. Not yet wired into `code-analyzer-core`'s plugin loader.
