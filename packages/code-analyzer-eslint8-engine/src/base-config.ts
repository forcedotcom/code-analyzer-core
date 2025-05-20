import {Linter} from "eslint";
import {ESLint8EngineConfig} from "./config";
import rawLwcConfig from "@salesforce/eslint-config-lwc/recommended"


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
            overrides.push(this.createLwcConfig(baseRuleset));
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

    private createLwcConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        // Add in the lwc recommended rules (but remove the eslint:recommended since we add it in with the javascript base config)
        const lwcConfig: Linter.ConfigOverride = this.createJavascriptPlusLwcConfig(baseRuleset);

        // Remove the base javascript rules:
        // * First we remove the eslint:all or eslint:recommended from the extends
        lwcConfig.extends = (lwcConfig.extends as string[]).filter(s => !s.startsWith('eslint:'));
        // * Next we remove any explicitly listed rule that is a base rule - which doesn't have namespace like jest/*, @lwc/*, etc (and thus has no '/')
        lwcConfig.rules = Object.fromEntries(
            Object.entries(lwcConfig.rules as Linter.RulesRecord).filter(([key]) => key.includes('/'))
        );

        return lwcConfig;
    }

    private createJavascriptPlusLwcConfig(baseRuleset: BaseRuleset): Linter.ConfigOverride {
        const lwcAndJsConfig: Linter.ConfigOverride = {...rawLwcConfig};
        // Add in the recommended lwc-platform rules
        (lwcAndJsConfig.plugins as string[]).push("@lwc/lwc-platform");
        (lwcAndJsConfig.extends as string[]).push("plugin:@lwc/lwc-platform/recommended");
        // This one rule is broken, so we need to turn it off for now.
        // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/152
        (lwcAndJsConfig.rules as Linter.RulesRecord)['@lwc/lwc-platform/valid-offline-wire'] = 'off';

        if (baseRuleset === BaseRuleset.ALL) {
            lwcAndJsConfig.extends = (lwcAndJsConfig.extends as string[]).map(s => s === 'eslint:recommended' ? 'eslint:all' : s);
        }

        lwcAndJsConfig.files = this.config.file_extensions.javascript.map(ext => `*${ext}`);

        return this.addJavascriptParser(lwcAndJsConfig);
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
