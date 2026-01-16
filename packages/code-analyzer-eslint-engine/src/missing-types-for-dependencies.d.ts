// This declaration adds in the missing types for "@lwc/eslint-plugin-lwc-platform" whose package.json file's main field points to:
//     node_modules/@lwc/eslint-plugin-lwc-platform/lib/index.js
declare module '@lwc/eslint-plugin-lwc-platform' {
    import type { ESLint, Linter } from 'eslint';
    import type { RuleDefinition } from "@eslint/core";

    const plugin: ESLint.ObjectMetaProperties & {
        readonly rules: Record<string, RuleDefinition>;
        readonly configs: {
            platform: Linter.Config[];
            recommended: Linter.Config[];
            style: Linter.Config[];
        }
    };
    export = plugin;
}

// This declaration adds in the missing types for "eslint-plugin-jsx-a11y"
declare module 'eslint-plugin-jsx-a11y' {
    import type { ESLint, Linter } from 'eslint';
    import type { RuleDefinition } from '@eslint/core';

    const plugin: ESLint.Plugin & {
        readonly rules: Record<string, RuleDefinition>;

        // Newer flat API (some versions)
        readonly configs?: {
            readonly flat?: {
                readonly recommended: Linter.Config;
                readonly strict: Linter.Config;
            };
            // Some versions expose this key instead
            readonly 'flat/recommended'?: Linter.Config;
            readonly 'flat/strict'?: Linter.Config;
        };

        // Some versions expose flat configs here
        readonly flatConfigs?: {
            readonly recommended: Linter.Config;
            readonly strict: Linter.Config;
        };
    };
    export = plugin;
}

// This declaration adds in the missing types for "@salesforce/eslint-config-lwc" whose package.json file's main field points to:
//     node_modules/@salesforce/eslint-config-lwc/index.js
declare module '@salesforce/eslint-config-lwc' {
    import type { ESLint, Linter } from 'eslint';
    const moduleObject: ESLint.ObjectMetaProperties & {
        readonly configs: {
            readonly base: Linter.Config[];
            readonly baseTs: Linter.Config[];
            readonly extended: Linter.Config[];
            readonly extendedTs: Linter.Config[];
            readonly i18n: Linter.Config[];
            readonly i18nTs: Linter.Config[];
            readonly recommended: Linter.Config[];
            readonly recommendedTs: Linter.Config[];
            readonly ssr: Linter.Config[];
            readonly ssrTs: Linter.Config[];
        };
    };
    export = moduleObject;
}

// This declaration adds in the missing types for "@salesforce-ux/eslint-plugin-slds" whose package.json file's main field points to:
//     node_modules/@salesforce-ux/eslint-plugin-slds/build/index.js
declare module '@salesforce-ux/eslint-plugin-slds' {
    import type { ESLint, Linter } from 'eslint';
    import type { RuleDefinition } from "@eslint/core";

    const plugin: ESLint.ObjectMetaProperties & {
        readonly rules: Record<string, RuleDefinition>;
        readonly configs: {
            readonly "flat/recommended-html": Linter.Config[];
            readonly "flat/recommended-css": Linter.Config[];
        };
    };
    export = plugin;
}

// This declaration adds in the missing types for "eslint-plugin-react"
declare module 'eslint-plugin-react' {
    import type { ESLint, Linter } from 'eslint';
    import type { RuleDefinition } from "@eslint/core";

    const plugin: ESLint.Plugin & {
        readonly rules: Record<string, RuleDefinition>;
        readonly configs: {
            readonly flat: {
                readonly all: Linter.Config;
                readonly "jsx-runtime": Linter.Config;
            };
        };
    };
    export = plugin;
}

// This declaration adds in the missing types for "eslint-plugin-react-hooks"
// We use configs.flat.recommended but override rules to only enable rules-of-hooks and exhaustive-deps
declare module 'eslint-plugin-react-hooks' {
    import type { ESLint, Linter } from 'eslint';
    import type { RuleDefinition } from "@eslint/core";

    const plugin: ESLint.Plugin & {
        readonly rules: Record<string, RuleDefinition>;
        readonly configs: {
            readonly flat: {
                readonly recommended: Linter.Config;
            };
        };
    };
    export = plugin;
}
