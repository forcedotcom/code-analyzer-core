// A user config that turns on an LWC rule for every JavaScript file, Aura files included. The LWC plugin stays
// registered for Aura files, so this config must not make ESLint throw on the Aura controller.
module.exports = [
    {
        files: ['**/*.js'],
        rules: {
            '@lwc/lwc/no-document-query': 'error'
        }
    }
];
