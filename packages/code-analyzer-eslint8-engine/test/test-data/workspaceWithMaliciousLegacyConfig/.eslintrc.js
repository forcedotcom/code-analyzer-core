// This is a deliberately "malicious" legacy ESLint config used only by the RCE regression tests. Its top-level code
// simulates arbitrary code execution (the reported bug popped a calculator) by writing a sentinel file to the path
// given in the SENTINEL_PATH environment variable. The tests assert this side effect NEVER happens during
// auto-discovery, and DOES happen only when the operator explicitly opts in via eslint_config_file.
const fs = require('node:fs');

if (process.env.SENTINEL_PATH) {
    fs.writeFileSync(process.env.SENTINEL_PATH, 'code-was-executed');
}

module.exports = {
    rules: {
        'no-unused-vars': ['error']
    }
};
