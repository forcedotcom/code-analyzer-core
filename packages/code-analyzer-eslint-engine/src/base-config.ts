import {Linter} from "eslint";
import eslintJs from "@eslint/js";
import eslintTs from "typescript-eslint";
import lwcEslintPluginLwcPlatform from "@lwc/eslint-plugin-lwc-platform";
import salesforceEslintConfigLwc from "@salesforce/eslint-config-lwc";
import sldsEslintPlugin from "@salesforce-ux/eslint-plugin-slds";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintPluginJsxA11y from "eslint-plugin-jsx-a11y";
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
        // Add React plugin config for JSX files
        if (this.useReactBaseConfig()) {
            configArray.push(...this.createReactConfigArray());
        }
        return configArray;
    }

    private createJavascriptPlusLwcConfigArray(): Linter.Config[] {
        const configs: Linter.Config[] = validateAndGetRawLwcConfigArray();

        // Reconstruct languageOptions to avoid mutating the original shared config from the LWC package
        // TODO: Remove configFile and sourceType overrides when https://github.com/salesforce/eslint-config-lwc/issues/158 is fixed
        const originalParserOptions = configs[0].languageOptions!.parserOptions as Linter.ParserOptions;
        const originalBabelOptions = originalParserOptions.babelOptions || {};
        configs[0].languageOptions = {
            ...configs[0].languageOptions,
            parserOptions: {
                ...originalParserOptions,
                // For some reason babel doesn't like .cjs files unless we explicitly set this to undefined
                // because ESLint 9 is setting it to "commonjs" automatically when the field doesn't exist
                // in the parserOptions (and for babel "commonjs" isn't a valid option)
                sourceType: undefined,
                babelOptions: {
                    ...originalBabelOptions,
                    // Turn off the babel parser's configFile option from the lwc base plugin
                    configFile: false,
                    // Add @babel/preset-react to enable JSX parsing for React/JSX files
                    // Use require.resolve() to get absolute path - otherwise Babel looks in target project's node_modules
                    presets: [...(originalBabelOptions.presets || []), require.resolve('@babel/preset-react')]
                }
            }
        };

        // File patterns for different config types
        const allJsExtensions = this.engineConfig.file_extensions.javascript;
        const lwcExtensions = allJsExtensions.filter(ext => ext !== '.jsx');
        const allJsFilePatterns = allJsExtensions.map(ext => `**/*${ext}`);
        const lwcFilePatterns = lwcExtensions.map(ext => `**/*${ext}`);

        // Base JS rules (eslintJs.configs.all) - applies to ALL JS files including .jsx
        // Includes Babel parser with @babel/preset-react to enable JSX parsing for .jsx files
        const baseJsConfig: Linter.Config = {
            ...eslintJs.configs.all,
            files: allJsFilePatterns,
            languageOptions: {
                ...configs[0].languageOptions  // Reuses Babel parser with @babel/preset-react
            }
        };

        // This one rule makes eslint throw an exception if the user doesn't have jest installed (which should be
        // optional), so we turn it off for now. See https://github.com/salesforce/eslint-config-lwc/issues/161
        configs[3].rules = {
            ...configs[3].rules,
            'jest/no-deprecated-functions': 'off'
        }

        // This one rule is broken and thus, we need to turn it off for now.
        // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/152
        configs[5].rules = {
            ...configs[5].rules,
            '@lwc/lwc-platform/valid-offline-wire': 'off'
        }

        // Apply LWC file patterns to LWC-specific configs (excludes .jsx - React files aren't LWC)
        // Then insert the base JS config at position 1
        const lwcConfigs: Linter.Config[] = configs.map(config => ({
            ...config,
            files: lwcFilePatterns
        }));
        lwcConfigs[1] = baseJsConfig;

        return lwcConfigs;
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
            files: this.engineConfig.file_extensions.javascript.map(ext => `**/*${ext}`),
            languageOptions: {
                parserOptions: {
                    ecmaFeatures: {
                        jsx: true  // Enable JSX parsing for React/JSX files
                    }
                }
            }
        }];
    }

    private createSldsHTMLConfigArray(): Linter.Config[] {
        return sldsEslintPlugin.configs['flat/recommended-html'].map((htmlConfig: Linter.Config) => {
            return {
                ...htmlConfig,
                files: this.engineConfig.file_extensions.html.map(ext => `**/*${ext}`)
            };
        });
    }

    private createSldsCSSConfigArray(): Linter.Config[] {
        return sldsEslintPlugin.configs['flat/recommended-css'].map((cssConfig: Linter.Config) => {
            return {
                ...cssConfig,
                files: this.engineConfig.file_extensions.css.map(ext => `**/*${ext}`)
            };
        });
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

    /**
     * Creates React plugin config for JavaScript and TypeScript files.
     * 
     * Includes both eslint-plugin-react and eslint-plugin-react-hooks:
     * - react/*: All React rules for JSX/TSX and component patterns
     * - react-hooks/rules-of-hooks: Enforces the Rules of Hooks
     * - react-hooks/exhaustive-deps: Verifies the list of dependencies for Hooks
     * 
     * React rules are applied to all JS/TS files - if a file doesn't contain React code, 
     * the rules simply won't report any violations.
     */
    private createReactConfigArray(): Linter.Config[] {
        const jsExtensions = this.engineConfig.file_extensions.javascript;
        const tsExtensions = this.engineConfig.file_extensions.typescript;
        const reactExtensions = [...new Set([...jsExtensions, ...tsExtensions])];

        if (reactExtensions.length === 0) {
            return [];
        }

        const filePatterns = reactExtensions.map(ext => `**/*${ext}`);

        // Get all rules from eslint-plugin-react's flat config
        const reactAllConfig = eslintPluginReact.configs.flat.all;

        // Get jsx-runtime config to disable outdated rules (react-in-jsx-scope, jsx-uses-react)
        // These rules are not needed for React 17+ which is now the standard (released Oct 2020)
        const jsxRuntimeConfig = eslintPluginReact.configs.flat['jsx-runtime'];



        return [
            // React all rules config
            {
                ...reactAllConfig,
                files: filePatterns,
                settings: {
                    ...reactAllConfig.settings,
                    react: {
                        // React version - "detect" automatically picks the installed version, falls back to latest
                        version: 'detect',
                        // Pragma is the function JSX compiles to (e.g., <div> → React.createElement('div'))
                        pragma: 'React'
                    }
                }
            },
            // jsx-runtime config disables outdated rules for React 17+
            {
                ...jsxRuntimeConfig,
                files: filePatterns
            },
            // React Hooks plugin config - use flat.recommended but only enable the 2 classic rules
            // (v7.x includes many React Compiler rules that we filter out)
            {
                ...eslintPluginReactHooks.configs.flat.recommended,
                files: filePatterns,
                rules: {
                    'react-hooks/rules-of-hooks': 'error',
                    'react-hooks/exhaustive-deps': 'warn'
                }
            },
            // jsx-a11y plugin config
            {
                ...eslintPluginJsxA11y.flatConfigs?.strict,
                files: filePatterns
            }
        ];
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

    private useReactBaseConfig(): boolean {
        // React config is independently controlled by disable_react_base_config
        // React rules apply to all JS and TS files - no harm if file has no React code
        return !this.engineConfig.disable_react_base_config && 
               (this.engineConfig.file_extensions.javascript.length > 0 ||
                this.engineConfig.file_extensions.typescript.length > 0);
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
    return (config.languageOptions?.parserOptions as Linter.ParserOptions)?.babelOptions !== undefined;
}

function hasRule(config: Linter.Config, ruleName: string): boolean {
    return config.rules !== undefined && ruleName in config.rules;
}
