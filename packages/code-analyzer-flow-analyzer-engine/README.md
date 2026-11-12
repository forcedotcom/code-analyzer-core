# Flow Analyzer Engine

Salesforce Code Analyzer engine named `flow-analyzer`. It sends local `.flow` / `.flow-meta.xml` files to an org-backed Connect API and maps findings back onto the original XML.

Analyze POST: `/services/data/vXX.X/flowbuilder/flow-analyzer/analysis/metadata-archive` (`multipart/form-data` ZIP in `fileData`).

This package does **not** replace the local Python `flow` engine.

## Configuration

```yaml
engines:
  flow-analyzer:
    target_org: myOrg
```

`vXX.X` is the target org's API version, but never lower than 68.0, the first version with the Flow Analyzer endpoints. To pin a version, set `api_version` (for example `api_version: "69.0"`).

The CLI `--target-org` flag populates `target_org`. When `target_org` isn't set, the engine is inactive: it offers no rules and makes no network calls, so scans without `--target-org` are unaffected. The engine never falls back to the default Salesforce CLI org.

## Commands

```
sf code-analyzer run --rule-selector flow-analyzer --target-org myOrg
sf code-analyzer rules --rule-selector flow-analyzer --target-org myOrg
```
