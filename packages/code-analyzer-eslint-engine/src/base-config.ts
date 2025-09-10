import {Linter} from "eslint";
import eslintJs from "@eslint/js";
import eslintTs from "typescript-eslint";
import lwcEslintPluginLwcPlatform from "@lwc/eslint-plugin-lwc-platform";
import salesforceEslintConfigLwc from "@salesforce/eslint-config-lwc";
import sldsEslintPlugin from "@salesforce-ux/eslint-plugin-slds";
import {ESLintEngineConfig} from "./config";
import globals from "globals";

export class BaseConfigFactory {
    private readonly engineConfig: ESLintEngineConfig;
    
    constructor(engineConfig: ESLintEngineConfig) {
        this.engineConfig = engineConfig;
    }
    
    createBaseConfigArray(): Linter.Config[] {
        const configArray: Linter.Config[] = [{
            linterOptions: {
                reportUnusedDisableDirectives: false,
            },
            languageOptions: {
                globals: {
                    // Mark variables as known globals for Aura
                    "$A": "readonly",            // See: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/ref_jsapi_dollarA.htm
                    "$Browser": "readonly",      // See: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/expr_source.htm
                    "$ContentAsset": "readonly", // ^
                    "$Label": "readonly",        // ^
                    "$Locale": "readonly",       // ^
                    "$Resource": "readonly",     // ^
                    
                    // ESLint doesn't natively know about various browser and node globals. So we add them here to
                    // remove false positives for our users.
                    ... globals.node,
                    ... globals.browser,
                    ... globals.es2017
                }
            }
        }];
        
        if (this.useJsBaseConfig() && this.useLwcBaseConfig()) {
            configArray.push(...this.createJavascriptPlusLwcConfigArray());
        } else if (this.useJsBaseConfig()) {
            configArray.push(...this.createJavascriptConfigArray());
        } else if (this.useLwcBaseConfig()) {
            configArray.push(...this.createLwcConfigArray());
        }
        if (this.useSldsCSSBaseConfig()) {
            configArray.push(...this.createSldsCSSConfigArray());
        }
        if (this.useSldsHTMLBaseConfig()) {
            configArray.push(...this.createSldsHTMLConfigArray());
        }
        if (this.useTsBaseConfig()) {
            configArray.push(...this.createTypescriptConfigArray());
        }
        return configArray;
    }
    
    private createJavascriptPlusLwcConfigArray(): Linter.Config[] {
        let configs: Linter.Config[] = validateAndGetRawLwcConfigArray();
        
        // TODO: Remove the For the following 2 updates when https://github.com/salesforce/eslint-config-lwc/issues/158 is fixed
        // 1) Turn off the babel parser's configFile option from the lwc base plugin
        configs[0].languageOptions!.parserOptions!.babelOptions.configFile = false;
        // 2) For some reason babel doesn't like .cjs files unless we explicitly set this to undefined because I think
        // ESLint 9 is setting it to "commonjs" automatically when the field doesn't exist in the parserOptions (and for
        // babel "commonjs" isn't a valid option)
        configs[0].languageOptions!.parserOptions!.sourceType = undefined;
        
        // Swap out eslintJs.configs.recommended with eslintJs.configs.all
        configs[1] = eslintJs.configs.all;
        
        // This one rule is broken and thus, we need to turn it off for now.
        // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/152
        configs[5].rules = {
            ...configs[5].rules,
            '@lwc/lwc-platform/valid-offline-wire': 'off'
        }
        
        // Restrict these configs to just javascript files
        configs = configs.map(config => {
            return {
                ...config,
                files: this.engineConfig.file_extensions.javascript.map(ext => `**/*${ext}`)
            }
        });
        
        return configs;
    }
    
    private createLwcConfigArray(): Linter.Config[] {
        const configs: Linter.Config[] = this.createJavascriptPlusLwcConfigArray();
        
        // Remove any explicitly listed rule that is a base javascript rule from the recommended LWC/Lightning rules.
        // Note the modified base rules don't have namespace like jest/*, @lwc/*, etc (and thus has no '/').
        configs[4].rules = Object.fromEntries(
            Object.entries(configs[4].rules as Linter.RulesRecord).filter(([key]) => key.includes('/'))
        );
        
        // Remove the eslintJs.configs.all (at element 1). Note that this delete is after the configs[4] update above so
        // we can work with the original index [4] instead of [3] to avoid confusion.
        configs.splice(1, 1);
        
        return configs;
    }
    
    private createJavascriptConfigArray(): Linter.Config[] {
        return [{
            ... eslintJs.configs.all,
            files: this.engineConfig.file_extensions.javascript.map(ext => `**/*${ext}`)
        }];
    }
    
    private createSldsConfigArray(): Linter.Config[] {
        const configs: Linter.Config[] = [];
        
        // Add HTML config if HTML files are configured
        if (this.engineConfig.file_extensions.html.length > 0) {
            const htmlConfig = sldsEslintPlugin.configs['flat/recommended'].find(conf => 
                conf.files && conf.files.includes('**/*.html')
            );
            if (htmlConfig) {
                configs.push({
                    ...htmlConfig,
                    files: this.engineConfig.file_extensions.html.map(ext => `**/*${ext}`)
                });
            }
        }
        
        // Add CSS config if CSS files are configured
        if (this.engineConfig.file_extensions.css.length > 0) {
            const cssConfig = sldsEslintPlugin.configs['flat/recommended'].find(conf => 
                conf.files && conf.files.includes('**/*.{css,scss}')
            );
            if (cssConfig) {
                configs.push({
                    ...cssConfig,
                    files: this.engineConfig.file_extensions.css.map(ext => `**/*${ext}`)
                });
            }
        }
        
        return configs;
    }
    
    private createSldsHTMLConfigArray(): Linter.Config[] {
        const configs: Linter.Config[] = [];
        
        // Add HTML config if HTML files are configured
        const htmlConfig = sldsEslintPlugin.configs['flat/recommended'].find(conf => 
            conf.files && conf.files.includes('**/*.html')
        );
        if (htmlConfig) {
            configs.push({
                ...htmlConfig,
                files: this.engineConfig.file_extensions.html.map(ext => `**/*${ext}`)
            });
        }
        return configs;
        //Ideally:
        // return sldsEslintPlugin.configs['flat/recommended-html'].map((htmlConfig: Linter.Config) => {
        //     return {
        //         ...htmlConfig,
        //         files: this.engineConfig.file_extensions.html.map(ext => `**/*${ext}`)
        //     };
        // });
    }
    
    private createSldsCSSConfigArray(): Linter.Config[] {
        const configs: Linter.Config[] = [];
        
        // Add CSS config if CSS files are configured
        const cssConfig = sldsEslintPlugin.configs['flat/recommended'].find(conf => 
            conf.files && conf.files.includes('**/*.{css,scss}')
        );
        if (cssConfig) {
            configs.push({
                ...cssConfig,
                files: this.engineConfig.file_extensions.css.map(ext => `**/*${ext}`)
            });
        }
        
        return configs;
        //Ideally:
        // return sldsEslintPlugin.configs['flat/recommended-css'].map((cssConfig: Linter.Config) => {
        //     return {
        //         ...cssConfig,
        //         files: this.engineConfig.file_extensions.css.map(ext => `**/*${ext}`)
        //     };
        // });
    }
    
    private createTypescriptConfigArray(): Linter.Config[] {
        const configs: Linter.Config[] = [];
        for (const conf of ([eslintJs.configs.all, ...eslintTs.configs.all] as Linter.Config[])) {
            configs.push({
                ...conf,
                files: this.engineConfig.file_extensions.typescript.map(ext => `**/*${ext}`),
                languageOptions: {
                    ... (conf.languageOptions ?? {}),
                    parserOptions: {
                        ... (conf.languageOptions?.parserOptions ?? {}),
                        
                        // Finds the tsconfig.json file nearest to each source file. This should work for most users.
                        // If not, then we may consider letting user specify this via config or alternatively users can
                        // just set disable_typescript_base_config=true and configure typescript in their own eslint
                        // config file. See https://typescript-eslint.io/packages/parser/#projectservice
                        projectService: true
                    }
                }
            });
        }
        return configs;
    }
    
    private useJsBaseConfig(): boolean {
        return !this.engineConfig.disable_javascript_base_config && this.engineConfig.file_extensions.javascript.length > 0;
    }
    
    private useLwcBaseConfig(): boolean {
        return !this.engineConfig.disable_lwc_base_config && this.engineConfig.file_extensions.javascript.length > 0;
    }
    
    private useSldsCSSBaseConfig(): boolean {
        return !this.engineConfig.disable_slds_base_config && this.engineConfig.file_extensions.css.length > 0;
    }
    
    private useSldsHTMLBaseConfig(): boolean {
        return !this.engineConfig.disable_slds_base_config && this.engineConfig.file_extensions.html.length > 0;
    }
    
    private useTsBaseConfig(): boolean {
        return !this.engineConfig.disable_typescript_base_config && this.engineConfig.file_extensions.typescript.length > 0;
    }
}

// In order to supply all the eslint rules (instead of just the recommended ones) to be selectable, and in order to
// allow users to have disable_javascript_base_config=true while keeping disable_lwc_base_config=false, we need to be
// able to modify the recommended configuration array from "@salesforce/eslint-config-lwc". Since the config objects in
// the array do not have a name, we need to verify it hasn't changed since our last update, so we simply check the size
// of the array and confirm one expected rule from each config.
function validateAndGetRawLwcConfigArray(): Linter.Config[] {
    const rawLwcConfigs: Linter.Config[] = [
        ...salesforceEslintConfigLwc.configs.recommended,
        ...lwcEslintPluginLwcPlatform.configs.recommended
    ];
    /* istanbul ignore if */
    if (rawLwcConfigs.length !== 6 ||
        !hasRule(rawLwcConfigs[0], "@lwc/lwc/no-deprecated") ||        // Should be the LWC base config
        !containsBabelOptions(rawLwcConfigs[0]) ||                     // The LWC base config contains babel options
        !hasRule(rawLwcConfigs[1], "no-debugger") ||                   // Should be eslintJs.configs.recommended
        !hasRule(rawLwcConfigs[2], "import/default") ||                // Should be "errors" config from eslint-plugin-import
        !hasRule(rawLwcConfigs[3], "jest/expect-expect") ||            // Should be "flat/recommended" config from eslint-plugin-jest
        !hasRule(rawLwcConfigs[4], "@lwc/lwc/no-api-reassignments") || // Should be LWC/Lightning rules for recommended config
        !hasRule(rawLwcConfigs[5], "@lwc/lwc-platform/no-aura-libs")   // Should be the lwc-platform recommended config
    ){
        // If this errors when we upgrade then we should update this file to reflect:
        //   - https://github.com/salesforce/eslint-config-lwc/blob/master/recommended.js
        //   - and lib/configs/recommended.js of https://www.npmjs.com/package/@lwc/eslint-plugin-lwc-platform?activeTab=code
        throw new Error("INTERNAL ERROR: The recommended config for @salesforce/eslint-config-lwc or @lwc/eslint-plugin-lwc-platform must have changed.");
    }
    
    // Return a shallow copy since we will be making modifications
    return rawLwcConfigs.map(config => { return {... config}});
}

function containsBabelOptions(config: Linter.Config): boolean {
    return config.languageOptions?.parserOptions?.babelOptions !== undefined;
}

function hasRule(config: Linter.Config, ruleName: string): boolean {
    return config.rules !== undefined && ruleName in config.rules;
}
