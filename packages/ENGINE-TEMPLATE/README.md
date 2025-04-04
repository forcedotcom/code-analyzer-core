# Adding New Engines

The [code-analyzer-core](../code-analyzer-core/) package has the capability to dynamically load any and all engines that live in this monorepo, based on both available engines and JIT user configurations. If you are an internal team looking to add plugin configuration that can be leveraged through the [code-analyzer Salesforce CLI plugin](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_code-analyzer_commands_unified.htm) and [Salesforce Code Analyzer VS Code Extension](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze-vscode.html), this is where you should start.


## Start with the Scaffolding

1. Copy This Template

Copy this entire template folder, and rename the directory to `code-analyzer-x-engine`, where `x` will be the name of your engine. For example, the `code-analyzer-sfge-engine` has `sfge` as the engine name for the capabilities referred to as the "Salesforce Graph Engine". Engine names should be lowercased and succinct. Engine names are subject to Salesforce Code Analyzer team approval.

2. Add Dependencies

Add any dependencies you might need for external rule retrieval or other functionality. Important to note in the included dependencies is the code analyzer engine api, which is also published from this monorepo:

```
"@salesforce/code-analyzer-engine-api": "0.21.0-SNAPSHOT"
```

Use the value provided in the template today, and do not try to modify it. It may say "SNAPSHOT" which is what indicates a new version will be available with our next release, but the value should match whatever the template uses, and will keep this up to date.

3. Create Your Engine

Open the [engine](src/engine.ts) file. Set your engine name, which should match the name of `x` above. Follow the rest of the instructions in the file.

4. Create Your Plugin Provider

Open the [plugin.ts](src/plugin.ts) file. This currently extends EnginePluginV1, managed from the Engine API. Set your available engine name, which should match the name of `x` above (thought there is the option of adding multiple engines within your plugin as well).

5. Export Your Plugin

Update the [index.ts](src/index.ts) to update your imports. This will allow for dynamic JIT loading when users decide which engines they want to use to scan their projects.

6. Add Configuration (Optional)

With v5 of Code Analyzer, users are able to add engine-specific [configuration](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/config-custom.html). If your engine would like to have specific configuration details, add this via a `config.ts` file, and consume it in the Engine constructor.

## About Rules and Violations

When building out the implementation of your rules and violations, we are less prescriptive about how rules need to be stored and written, but encourage flexible solutions that are easy to maintain. Testing is also a must, and note that this monorepo requires 100% testing coverage. We recommend working with [goldfiles](test/test-data/temp-goldfile.json) for reference test data.

## Request Build Support

When you are ready for your engine to be available in the Code Analyzer product suite, work with the CA team to publish your engine and update the build process to include the engine in our available engines.

## Release and Documentation

Code Analyzer publishes new versions at the end of every month. Documentation for your engine will need to be updated at the same time, so you will need to work with Code Analyzer Documentation writer to understand the rules that your engine will be provided. Documentation will be available with the other Code Analyzer [Engines](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engines.html).