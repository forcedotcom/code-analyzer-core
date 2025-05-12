import {Linter} from "eslint";
import {ESLint8EngineConfig} from "./config";

export enum BaseRuleset {
    ALL = "all",
    RECOMMENDED = "recommended"
}

export class LegacyBaseConfigFactory {
    private readonly config: ESLint8EngineConfig;

    constructor(config: ESLint8EngineConfig) {
        this.config = config;
    }

    createBaseConfig(baseRuleset: BaseRuleset): Linter.LegacyConfig  {
        const overrides: Linter.ConfigOverride[] = [];
        if (this.useJsConfig() && this.useLwcConfig()) {
            overrides.push(this.createJavascriptPlusLwcConfig(baseRuleset));
        } else if (this.useJsConfig()) {
            overrides.push(this.createJavascriptConfig(baseRuleset));
        } else if (this.useLwcConfig()) {
            overrides.push(this.createLwcConfig());
        }
        if (this.useTsConfig()) {
            overrides.push(this.createTypescriptConfig(baseRuleset));
        }

        return {
            globals: {
                // Mark variables as known globals for Aura
                "$A": "readonly",            // See: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/ref_jsapi_dollarA.htm
                "$Browser": "readonly",      // See: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/expr_source.htm
                "$ContentAsset": "readonly", // ^
                "$Label": "readonly",        // ^
                "$Locale": "readonly",       // ^
                "$Resource": "readonly"      // ^
            },
            overrides: overrides
        };
    }

    private useJsConfig(): boolean {
        return !this.config.disable_javascript_base_config && this.config.file_extensions.javascript.length > 0;
    }

    private useLwcConfig(): boolean {
        return !this.config.disable_lwc_base_config && this.config.file_extensions.javascript.length > 0;
    }

    private useTsConfig(): boolean {
        return !this.config.disable_typescript_base_config && this.config.file_extensions.typescript.length > 0;
    }

    private createJavascriptConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        const jsConfig: Linter.ConfigOverride = {
            files: this.config.file_extensions.javascript.map(ext => `*${ext}`),
            extends: [`eslint:${baseRuleset}`]
        }
        return this.addJavascriptParser(jsConfig);
    }

    private createLwcConfig(): Linter.ConfigOverride {
        const lwcConfig: Linter.ConfigOverride = {
            files: this.config.file_extensions.javascript.map(ext => `*${ext}`),
            extends: [
                "@salesforce/eslint-config-lwc/base", // Using base instead of recommended. See the comment below.
                "plugin:@lwc/lwc-platform/recommended"
            ],
            plugins: [
                "@lwc/eslint-plugin-lwc",
                "@lwc/lwc-platform",
                "@salesforce/eslint-plugin-lightning"
            ],
            rules: {
                // The following is a better alternative than extending from @salesforce/eslint-config-lwc/recommended:
                //   Note that we don't want to pull in all the base javascript rules again (from eslint:Recommended),
                //   which is why we don't just extend from @salesforce/eslint-config-lwc/lwc/recommended (which
                //   pulls in everything again). Therefore, we just add in the recommended @lwc/lwc/* and
                //   @salesforce/lightning/* rules that aren't included in @salesforce/eslint-config-lwc/base here.
                '@lwc/lwc/no-api-reassignments': 'error',
                '@lwc/lwc/no-async-operation': 'error',
                '@lwc/lwc/no-attributes-during-construction': 'error',
                '@lwc/lwc/no-document-query': 'error',
                '@lwc/lwc/no-inner-html': 'error',
                '@lwc/lwc/no-leading-uppercase-api-name': 'error',
                '@lwc/lwc/no-template-children': 'error',
                '@lwc/lwc/prefer-custom-event': 'error',
                '@lwc/lwc/valid-api': ['error', {disallowUnderscoreUppercaseMix: true,}],
                '@lwc/lwc/valid-graphql-wire-adapter-callback-parameters': 'error',
                '@salesforce/lightning/valid-apex-method-invocation': 'error',

                // This one rule is broken and thus we need to turn it off for now.
                // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/152
                // TODO: Turn it back on when the rule has been fixed
                '@lwc/lwc-platform/valid-offline-wire': 'off'
            }
        }
        return this.addJavascriptParser(lwcConfig);
    }

    private createJavascriptPlusLwcConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        const jsPlusLwcConfig: Linter.ConfigOverride = this.createLwcConfig();
        (jsPlusLwcConfig.extends as string[]).push(`eslint:${baseRuleset}`);
        return jsPlusLwcConfig;
    }

    private createTypescriptConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        const tsConfig: Linter.ConfigOverride = {
            files: this.config.file_extensions.typescript.map(ext => `*${ext}`),
            extends: [
                `eslint:${baseRuleset}`, // The typescript plugin applies the base rules to the typescript files, so we want this
                `plugin:@typescript-eslint/${baseRuleset}`, // May override some rules from eslint:<all|recommended> as needed
            ],
            plugins: [
                "@typescript-eslint"
            ]
        };
        return this.addTypescriptParser(tsConfig);
    }

    private addJavascriptParser(config: Linter.ConfigOverride): Linter.ConfigOverride {
        config.parser = "@babel/eslint-parser";
        config.parserOptions = {
            requireConfigFile: false,
            babelOptions: {
                babelrc: false,
                configFile: false,
                parserOpts: {
                    plugins: [
                        "classProperties",
                        ["decorators", {"decoratorsBeforeExport": false}]
                    ]
                }
            }
        };
        return config;
    }

    private addTypescriptParser(config: Linter.ConfigOverride): Linter.ConfigOverride {
        config.parser = '@typescript-eslint/parser';
        config.parserOptions = {
            // Finds the tsconfig.json file nearest to each source file. This should work for most users.
            // If not, then we may consider letting user specify this via config or alternatively, users can just
            // set disable_typescript_base_config=true and configure typescript in their own eslint config file.
            // See https://typescript-eslint.io/packages/parser/#project
            project: true
        }
        return config;
    }
}
