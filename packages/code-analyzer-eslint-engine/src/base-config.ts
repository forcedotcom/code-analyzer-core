import {Linter} from "eslint";

export function createJavascriptPlusLwcBaseConfig(allOrRecommended: string): Linter.ConfigOverride {
    return {
        files: ["*.js", "*.mjs", "*.cjs"],
        extends: [
            `eslint:${allOrRecommended}`,
            "@salesforce/eslint-config-lwc/base" // Always using base for now. all and recommended both require additional plugins
        ],
        plugins: [
            "@lwc/eslint-plugin-lwc"
        ],
        parser: "@babel/eslint-parser",
        parserOptions: {
            requireConfigFile: false,
            babelOptions: {
                parserOpts: {
                    plugins: [
                        "classProperties",
                        ["decorators", { "decoratorsBeforeExport": false }]
                    ]
                }
            }
        }
    }
}

export function createTypescriptBaseConfig(allOrRecommended: string): Linter.ConfigOverride {
    return {
        files: ["*.ts"],
        extends: [
            `eslint:${allOrRecommended}`,
            `plugin:@typescript-eslint/${allOrRecommended}`,
        ],
        plugins: [
            "@typescript-eslint"
        ],
        parser: '@typescript-eslint/parser',
        parserOptions: {
            project: true // Finds the tsconfig.json file nearest to each source file. TODO: Consider letting user specify this.
        }
    }
}