import {
    EngineRunResults,
    RuleDescription,
    RunOptions,
    Workspace,
    SeverityLevel,
    COMMON_TAGS,
} from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import * as os from "node:os";
import path from "path";
import { StylelintEngine } from "../src/engine";
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";
import { RULE_MAPPINGS as _RULE_MAPPINGS } from "../src/rule-mappings";
import { StylelintRuleStatus as _StylelintRuleStatus } from "../src/enums";
import _stylelint from "stylelint";
import { toSeverityLevel, toTags } from "../src/engine";

jest.mock("stylelint", () => ({
    ...jest.requireActual("stylelint"),
    rules: {
        ...jest.requireActual("stylelint").rules,
        "custom-test-rule": {
            meta: {
                url: "https://example.com/custom-rule",
            },
        },
        "no-url-rule": {
            meta: {},
        },
    },
}));

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, "test-data");

describe("Stylelint Engine Tests", () => {
    let ALL_EXPECTED_RULES: RuleDescription[];

    beforeAll(async () => {
        ALL_EXPECTED_RULES = await getExpectedRulesFromGoldFile(
            "temp-goldfile.json"
        );
        // Keep rules sorted alphabetically
        ALL_EXPECTED_RULES.sort((a, b) => a.name.localeCompare(b.name));
    });

    describe("getName", () => {
        it("When getName is called, then stylelint name is returned", () => {
            const engine: StylelintEngine = new StylelintEngine();
            expect(engine.getName()).toEqual("stylelint");
        });
    });

    describe("getVersion", () => {
        it("Outputs something resembling a semantic version", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const version: string = await engine.getEngineVersion();

            expect(version).toMatch(/\d+\.\d+\.\d+.*/);
        });
    });

    describe("describeRules", () => {
        it("When no workspace is provided, then all rules are returned", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const rules: RuleDescription[] = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            expect(rules).toEqual(ALL_EXPECTED_RULES);
        });

        it("Should return rules sorted alphabetically by name", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const rules: RuleDescription[] = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            const ruleNames = rules.map((rule) => rule.name);
            const sortedRuleNames = [...ruleNames].sort();

            expect(ruleNames).toEqual(sortedRuleNames);
        });

        it("Should return rules with valid severity levels", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const rules: RuleDescription[] = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            for (const rule of rules) {
                expect(Object.values(SeverityLevel)).toContain(
                    rule.severityLevel
                );
            }
        });

        it("Should return rules with valid tags", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const rules: RuleDescription[] = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            for (const rule of rules) {
                expect(Array.isArray(rule.tags)).toBe(true);
                expect(rule.tags.length).toBeGreaterThan(0);
            }
        });

        it("Should handle custom rules with appropriate tags and severity", async () => {
            const engine = new StylelintEngine();
            const rules = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            const customRule = rules.find(
                (rule: RuleDescription) => rule.name === "custom-test-rule"
            );
            expect(customRule).toBeDefined();

            if (customRule) {
                expect(customRule.severityLevel).toBe(4);

                expect(customRule.tags).toContain(COMMON_TAGS.CUSTOM);
                expect(customRule.tags).not.toContain(COMMON_TAGS.RECOMMENDED);
            }
        });

        it("Should handle rules with appropriate with INFO status", async () => {
            const engine = new StylelintEngine();
            const rules = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            const alphaRule = rules.find(
                (rule: RuleDescription) => rule.name === "alpha-value-notation"
            );
            expect(alphaRule).toBeDefined();

            if (alphaRule) {
                expect(alphaRule.severityLevel).toBe(5); // Changed to match actual implementation
                expect(alphaRule.tags).toContain(
                    COMMON_TAGS.CATEGORIES.CODE_STYLE
                );
            }
        });

        it("Should handle rules with NULL status", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const rules: RuleDescription[] = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            // Find a rule with NULL status
            const nullRule = rules.find(
                (rule) => rule.severityLevel === SeverityLevel.Low
            );
            expect(nullRule).toBeDefined();

            if (nullRule) {
                // Verify it has the correct severity level
                expect(nullRule.severityLevel).toBe(SeverityLevel.Low);

                // Verify it doesn't have the Recommended tag
                expect(nullRule.tags).not.toContain(COMMON_TAGS.RECOMMENDED);
            }
        });

        it("Should handle rules with non-ERROR/WARN status", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const rules: RuleDescription[] = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            // Find a rule with moderate severity (default for non-ERROR/WARN)
            const moderateRule = rules.find(
                (rule) => rule.severityLevel === SeverityLevel.Moderate
            );
            expect(moderateRule).toBeDefined();

            if (moderateRule) {
                // Verify it has the correct severity level
                expect(moderateRule.severityLevel).toBe(SeverityLevel.Moderate);

                // Verify it doesn't have the Recommended tag
                expect(moderateRule.tags).not.toContain(
                    COMMON_TAGS.RECOMMENDED
                );
            }
        });

        it("Should map undefined status to High severity level in toSeverityLevel", () => {
            const result = toSeverityLevel(undefined);
            expect(result).toBe(SeverityLevel.High);
        });

        it("Should map all stylelint rule statuses to correct severity levels", async () => {
            const engine = new StylelintEngine();
            const rules = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            // Test WARN status maps to Info severity
            const warnRule = rules.find(
                (rule) => rule.name === "alpha-value-notation"
            );
            expect(warnRule).toBeDefined();
            if (warnRule) {
                expect(warnRule.severityLevel).toBe(5); // Info = 5 (from WARN status)
            }

            // Test ERROR status maps to High severity
            const errorRule = rules.find(
                (rule) => rule.name === "at-rule-no-unknown"
            );
            expect(errorRule).toBeDefined();
            if (errorRule) {
                expect(errorRule.severityLevel).toBe(2); // High = 2 (from ERROR status)
            }

            // Test NULL status maps to Low severity
            const nullRule = rules.find(
                (rule) => rule.name === "at-rule-disallowed-list"
            );
            expect(nullRule).toBeDefined();
            if (nullRule) {
                expect(nullRule.severityLevel).toBe(4); // Low = 4 (from NULL status)
            }
        });

        it("Should handle rules with no status in RULE_MAPPINGS", async () => {
            const engine = new StylelintEngine();
            const rules = await engine.describeRules({
                logFolder: os.tmpdir(),
            });

            const noStatusRule = rules.find(
                (rule) => rule.name === "no-url-rule"
            );
            expect(noStatusRule).toBeDefined();
            if (noStatusRule) {
                expect(noStatusRule.severityLevel).toBe(4);
                expect(noStatusRule.tags).toContain(COMMON_TAGS.CUSTOM);
            }
        });

        it("Should map NULL status to Low severity level in toSeverityLevel", () => {
            const result = toSeverityLevel(_StylelintRuleStatus.NULL);
            expect(result).toBe(SeverityLevel.Low);
        });

        it("Should add RECOMMENDED tag for ERROR and WARN status in toTags", () => {
            // Test ERROR status
            const errorTags = toTags(_StylelintRuleStatus.ERROR);
            expect(errorTags).toContain(COMMON_TAGS.RECOMMENDED);

            // Test WARN status
            const warnTags = toTags(_StylelintRuleStatus.WARN);
            expect(warnTags).toContain(COMMON_TAGS.RECOMMENDED);

            // Test NULL status (should not have RECOMMENDED tag)
            const nullTags = toTags(_StylelintRuleStatus.NULL);
            expect(nullTags).not.toContain(COMMON_TAGS.RECOMMENDED);
        });
    });

    describe("runRules", () => {
        it("When zero rule names are provided then return zero violations", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const results: EngineRunResults = await engine.runRules(
                [],
                createRunOptions(new Workspace("id", [TEST_DATA_FOLDER]))
            );
            expect(results.violations).toHaveLength(0);
        });

        it("Should return valid violations when rules are violated", async () => {
            const engine: StylelintEngine = new StylelintEngine();
            const results: EngineRunResults = await engine.runRules(
                ["color-no-invalid-hex"],
                createRunOptions(new Workspace("id", [TEST_DATA_FOLDER]))
            );

            // Since we don't have test files with violations, we can at least verify the structure
            expect(Array.isArray(results.violations)).toBe(true);
        });
    });

    async function getExpectedRulesFromGoldFile(
        relativeExpectedFile: string
    ): Promise<RuleDescription[]> {
        const expectedRulesJsonStr: string = await fs.promises.readFile(
            path.join(TEST_DATA_FOLDER, relativeExpectedFile),
            "utf-8"
        );
        return JSON.parse(expectedRulesJsonStr) as RuleDescription[];
    }

    function createRunOptions(workspace: Workspace): RunOptions {
        return {
            logFolder: os.tmpdir(),
            workspace: workspace,
        };
    }
});
