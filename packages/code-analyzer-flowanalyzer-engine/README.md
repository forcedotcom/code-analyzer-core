# Flow Analyzer Engine

Salesforce Code Analyzer engine named `flowAnalyzer`. It sends local `.flow` / `.flow-meta.xml` files to an org-backed Connect API and maps findings back onto the original XML.

Analyze POST: `/services/data/v68.0/flowbuilder/flow-analyzer/analysis/metadata-archive` (`multipart/form-data` ZIP in `fileData`).

This package does **not** replace the local Python `flow` engine.

## Configuration

```yaml
engines:
  flowAnalyzer:
    target_org: myOrg
```

`target_org` is required. The CLI `--target-org` flag should populate it. The engine never falls back to the default Salesforce CLI org.

## Commands

```
sf code-analyzer run --rule-selector flowAnalyzer --target-org myOrg
sf code-analyzer rules --rule-selector flowAnalyzer --target-org myOrg
```
