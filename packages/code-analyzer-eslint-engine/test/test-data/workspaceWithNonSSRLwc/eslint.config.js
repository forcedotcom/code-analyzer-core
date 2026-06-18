const eslintPluginLwc = require('@lwc/eslint-plugin-lwc');

// SSR rules are scoped to .ssrjs virtual files. The @lwc/lwc/ssr processor
// (configured by the engine's base config) creates a virtual .ssrjs sibling
// only for components whose -meta.xml declares SSR capabilities — so this
// rule block fires only on SSR-enabled components.
module.exports = [
    {
        files: ['**/*.ssrjs'],
        plugins: {
            '@lwc/lwc': eslintPluginLwc,
        },
        rules: {
            '@lwc/lwc/ssr-no-restricted-browser-globals': 'error',
            '@lwc/lwc/ssr-no-node-env': 'error',
        },
    },
];
