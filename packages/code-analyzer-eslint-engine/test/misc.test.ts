import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {createESLint, ESLintWrapper, stringifyESLintOptions} from "../src/eslint-wrapper";

const DEFAULT_CONFIG_FOR_TESTING: ESLintEngineConfig = {
    ...DEFAULT_CONFIG,
    config_root: __dirname
}

describe("Miscellaneous tests", () => {
    it("Make sure that the ESLint.Options can be stringified to an output that is no larger than 1000 lines", () => {
        const eslint: ESLintWrapper = createESLint(DEFAULT_CONFIG_FOR_TESTING, __dirname, new Set(['dummyRuleName']));
        const optionsString: string = stringifyESLintOptions(eslint._options);
        const numLines: number = optionsString.split('\n').length;
        expect(numLines).toBeLessThanOrEqual(1000);

        // Checking a few substrings as sanity checks:
        expect(optionsString).toContain('"baseConfig":');
        expect(optionsString).toContain('"name": "@lwc/eslint-plugin-lwc"');
        expect(optionsString).toContain('"@typescript-eslint/no-unsafe-return": "error"');
        expect(optionsString).toContain('"ruleFilter": "[Function]"');
    });
});
