const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
    {
        // Should globally ignore js files - making the base js and lwc config not applicable
        // See https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
        ignores: ["**/*.js"]
    },
    {
        rules: {
            "@typescript-eslint/no-unused-vars": ["error",
                {
                    "args": "all",
                    "argsIgnorePattern": "^_",
                    "caughtErrors": "all",
                    "caughtErrorsIgnorePattern": "^_",
                    "destructuredArrayIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "ignoreRestSiblings": true
                }]
        }
    }
]);
