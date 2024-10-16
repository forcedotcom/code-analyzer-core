import {RegexEngine} from "../src/engine";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    EngineRunResults,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "../src/messages";
import {
    RegexRules,
    DEFAULT_TAGS,
    DEFAULT_SEVERITY_LEVEL
} from "../src/config";
import {createBaseRegexRules, RULE_RESOURCE_URLS, TERMS_WITH_IMPLICIT_BIAS} from "../src/plugin";

changeWorkingDirectoryToPackageRoot();

const SAMPLE_CUSTOM_RULES: RegexRules = {
    NoTodos: {
        regex: '/TODO:/gi',
        description: "Detects TODO comments in code base.",
        file_extensions: [".js", ".cls"],
        violation_message: "sample violation message",
        severity: DEFAULT_SEVERITY_LEVEL,
        tags: DEFAULT_TAGS
    },
    NoHellos: {
        regex: '/hello/gi',
        description: "Detects hellos in project.",
        violation_message: "sample violation message",
        severity: DEFAULT_SEVERITY_LEVEL,
        tags: DEFAULT_TAGS
    }
};

const EXPECTED_NoTrailingWhitespace_RULE_DESCRIPTION: RuleDescription = {
    name: "NoTrailingWhitespace",
    severityLevel: SeverityLevel.Info,
    type: RuleType.Standard,
    tags: ["Recommended", "CodeStyle"],
    description: getMessage('TrailingWhitespaceRuleDescription'),
    resourceUrls: []
};

const EXPECTED_NoTodos_RULE_DESCRIPTION: RuleDescription = {
    name: "NoTodos",
    severityLevel: DEFAULT_SEVERITY_LEVEL,
    type: RuleType.Standard,
    tags: DEFAULT_TAGS,
    description: "Detects TODO comments in code base.",
    resourceUrls: []
};

const EXPECTED_NoHellos_RULE_DESCRIPTION = {
    name: "NoHellos",
    severityLevel: DEFAULT_SEVERITY_LEVEL,
    type: RuleType.Standard,
    tags: DEFAULT_TAGS,
    description: "Detects hellos in project.",
    resourceUrls: []
};

const EXPECTED_AvoidTermsWithImplicitBias_RULE_DESCRIPTION: RuleDescription = {
    name: "AvoidTermsWithImplicitBias",
    description: getMessage('AvoidTermsWithImplicitBiasRuleDescription'),
    severityLevel: SeverityLevel.Info,
    type: RuleType.Standard,
    tags: ['Recommended'],
    resourceUrls: ['https://www.salesforce.com/news/stories/salesforce-updates-technical-language-in-ongoing-effort-to-address-implicit-bias/'],
}

const EXPECTED_AvoidOldSalesforceApiVersions_RULE_DESCRIPTION: RuleDescription = {
    name: "AvoidOldSalesforceApiVersions",
    description: getMessage('AvoidOldSalesforceApiVersionsRuleDescription'),
    severityLevel: SeverityLevel.High,
    type: RuleType.Standard,
    tags: ['Recommended', 'Security'],
    resourceUrls: []
}

const EXPECTED_NoGetHeapSizeInLoop_RULE_DESCRIPTION: RuleDescription = {
    name: "AvoidGetHeapSizeInLoop",
    description: getMessage('AvoidGetHeapSizeInLoopRuleDescription'),
    severityLevel: SeverityLevel.High,
    type: RuleType.Standard,
    tags: ['Recommended', 'Performance'],
    resourceUrls: []
}

const EXPECTED_MinVersionForAbstractVirtualClassesWithPrivateMethod_RULE_DESCRIPTION: RuleDescription = {
    name: "MinVersionForAbstractVirtualClassesWithPrivateMethod",
    description: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleDescription'),
    severityLevel: SeverityLevel.High,
    type: RuleType.Standard,
    tags: ['Recommended'],
    resourceUrls: []
}

const SAMPLE_DATE: Date = new Date(Date.UTC(2024, 8, 1, 0, 0, 0));

let engine: RegexEngine;
beforeAll(() => {
    engine = new RegexEngine({
        ... createBaseRegexRules(SAMPLE_DATE),
        ... SAMPLE_CUSTOM_RULES
    }, RULE_RESOURCE_URLS);
});

describe("Tests for RegexEngine's getName and describeRules methods", () => {
    it('Engine name is accessible and correct', () => {
        const name: string = engine.getName();
        expect(name).toEqual("regex");
    });

    it('Calling describeRules without workspace, returns all available rules', async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({});
        expect(rulesDescriptions).toHaveLength(7);
        expect(rulesDescriptions[0]).toMatchObject(EXPECTED_NoTrailingWhitespace_RULE_DESCRIPTION);
        expect(rulesDescriptions[1]).toMatchObject(EXPECTED_AvoidTermsWithImplicitBias_RULE_DESCRIPTION)
        expect(rulesDescriptions[2]).toMatchObject(EXPECTED_AvoidOldSalesforceApiVersions_RULE_DESCRIPTION)
        expect(rulesDescriptions[3]).toMatchObject(EXPECTED_NoGetHeapSizeInLoop_RULE_DESCRIPTION)
        expect(rulesDescriptions[4]).toMatchObject(EXPECTED_MinVersionForAbstractVirtualClassesWithPrivateMethod_RULE_DESCRIPTION)
        expect(rulesDescriptions[5]).toMatchObject(EXPECTED_NoTodos_RULE_DESCRIPTION);
        expect(rulesDescriptions[6]).toMatchObject(EXPECTED_NoHellos_RULE_DESCRIPTION);
    });

    it("When workspace contains zero applicable files, then describeRules returns no rules", async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.resolve(__dirname, 'test-data', 'workspaceWithNoTextFiles')
            ])});
        expect(rulesDescriptions).toHaveLength(0);
    });

    it("When workspace contains files only applicable to only some of the rules, then describeRules only returns those rules", async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'dummy3.js')
            ])});

        expect(rulesDescriptions).toHaveLength(4);
        expect(rulesDescriptions[0]).toMatchObject(EXPECTED_AvoidTermsWithImplicitBias_RULE_DESCRIPTION);
        expect(rulesDescriptions[1]).toMatchObject(EXPECTED_NoGetHeapSizeInLoop_RULE_DESCRIPTION);
        expect(rulesDescriptions[2]).toMatchObject(EXPECTED_NoTodos_RULE_DESCRIPTION);
        expect(rulesDescriptions[3]).toMatchObject(EXPECTED_NoHellos_RULE_DESCRIPTION);
    });

    it("When workspace contains files are applicable to all available rules, then describeRules returns all rules", async () => {
        const rulesDescriptions: RuleDescription[] = await engine.describeRules({workspace: new Workspace([
                path.resolve(__dirname, 'test-data', 'sampleWorkspace')
            ])});
        expect(rulesDescriptions).toHaveLength(7);
        expect(rulesDescriptions[0]).toMatchObject(EXPECTED_NoTrailingWhitespace_RULE_DESCRIPTION);
        expect(rulesDescriptions[1]).toMatchObject(EXPECTED_AvoidTermsWithImplicitBias_RULE_DESCRIPTION);
        expect(rulesDescriptions[2]).toMatchObject(EXPECTED_AvoidOldSalesforceApiVersions_RULE_DESCRIPTION);
        expect(rulesDescriptions[3]).toMatchObject(EXPECTED_NoGetHeapSizeInLoop_RULE_DESCRIPTION);
        expect(rulesDescriptions[4]).toMatchObject(EXPECTED_MinVersionForAbstractVirtualClassesWithPrivateMethod_RULE_DESCRIPTION);
        expect(rulesDescriptions[5]).toMatchObject(EXPECTED_NoTodos_RULE_DESCRIPTION);
        expect(rulesDescriptions[6]).toMatchObject(EXPECTED_NoHellos_RULE_DESCRIPTION);
    });
});

describe('Tests for runRules', () => {
    it('if runRules() is called on a directory with no Apex files, it should correctly return no violations', async () => {
        const runOptions: RunOptions = {
            workspace: new Workspace([
                path.resolve(__dirname, "test-data", "apexClassWhitespace", "1_notApexClassWithWhitespace")
            ])};
        const runResults: EngineRunResults = await engine.runRules( ["NoTrailingWhitespace"], runOptions);
        expect(runResults.violations).toHaveLength(0);
    });

    it("Ensure runRules when called on a directory of Apex classes, it properly emits violations", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
            path.resolve(__dirname, "test-data", "apexClassWhitespace")
        ])};
        const runResults: EngineRunResults = await engine.runRules(["NoTrailingWhitespace", "NoTodos", "AvoidOldSalesforceApiVersions"], runOptions);

        const expectedViolations: Violation[] = [
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls"),
                        startLine: 6,
                        startColumn: 2,
                        endLine: 6,
                        endColumn: 4
                    }
                ]
            },
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls"),
                    startLine: 6,
                    startColumn: 2,
                    endLine: 6,
                    endColumn: 4
                }]
            },
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls"),
                    startLine: 1,
                    startColumn: 21,
                    endLine: 1,
                    endColumn: 23
                }]
            },
            {
                ruleName: "NoTrailingWhitespace",
                message: getMessage('TrailingWhitespaceRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myOuterClass.cls"),
                    startLine: 7,
                    startColumn: 2,
                    endLine: 7,
                    endColumn: 4
                }]
            },
            {
                ruleName: "AvoidOldSalesforceApiVersions",
                message: getMessage('AvoidOldSalesforceApiVersionsRuleMessage', 52),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "2_apexClasses", "myClass.cls-meta.xml"),
                    startLine: 4,
                    startColumn: 17,
                    endLine: 4,
                    endColumn: 21
                }]
            },
            {
                ruleName: "AvoidOldSalesforceApiVersions",
                message: getMessage('AvoidOldSalesforceApiVersionsRuleMessage', 52),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "3_apexClassWithoutWhitespace", "myOuterClass.cls-meta.xml"),
                    startLine: 3,
                    startColumn: 17,
                    endLine: 3,
                    endColumn: 21
                }]
            },
            {
                ruleName: "AvoidOldSalesforceApiVersions",
                message: getMessage('AvoidOldSalesforceApiVersionsRuleMessage', 52),
                primaryLocationIndex: 0,
                codeLocations: [{
                    file: path.resolve(__dirname, "test-data", "apexClassWhitespace", "lwc_component.js-meta.xml"),
                    startLine: 3,
                    startColumn: 17,
                    endLine: 3,
                    endColumn: 21
                }]
            },

        ];

        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }
    });

    it("Ensure runRules when called on a directory of Apex classes with getHeapSize in a loop, it properly emits violations", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
            path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop")
        ])};
        const runResults: EngineRunResults = await engine.runRules(["AvoidGetHeapSizeInLoop"], runOptions);

        const expectedViolations: Violation[] = [
            {
                ruleName: "AvoidGetHeapSizeInLoop",
                message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop", "testClass.cls"),
                        startLine: 5,
                        startColumn: 13,
                        endLine: 5,
                        endColumn: 33
                    }
                ]
            },
            {
                ruleName: "AvoidGetHeapSizeInLoop",
                message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop", "testClass.cls"),
                        startLine: 9,
                        startColumn: 13,
                        endLine: 9,
                        endColumn: 33
                    }
                ]
            },
            {
                ruleName: "AvoidGetHeapSizeInLoop",
                message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop", "testClass.cls"),
                        startLine: 17,
                        startColumn: 25,
                        endLine: 17,
                        endColumn: 45
                    }
                ]
            },
            {
                ruleName: "AvoidGetHeapSizeInLoop",
                message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop", "testClass.cls"),
                        startLine: 23,
                        startColumn: 23,
                        endLine: 23,
                        endColumn: 43
                    }
                ]
            },
            {
                ruleName: "AvoidGetHeapSizeInLoop",
                message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop", "testClass.cls"),
                        startLine: 31,
                        startColumn: 26,
                        endLine: 31,
                        endColumn: 46
                    }
                ]
            },
            {
                ruleName: "AvoidGetHeapSizeInLoop",
                message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassGetLimitsInLoop", "testClass.cls"),
                        startLine: 36,
                        startColumn: 27,
                        endLine: 36,
                        endColumn: 47
                    }
                ]
            },
        ];

        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }
    });

    it("Ensure runRules when called on a directory of Apex classes with private method in abstract/private class, it properly emits violations", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
            path.resolve(__dirname, "test-data", "apexClassWithPrivateMethod")
        ])};
        const runResults: EngineRunResults = await engine.runRules(["MinVersionForAbstractVirtualClassesWithPrivateMethod"], runOptions);

        const expectedViolations: Violation[] = [
            {
                ruleName: "MinVersionForAbstractVirtualClassesWithPrivateMethod",
                message: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassWithPrivateMethod", "testAbstractClassWithPrivateMethod.cls"),
                        startLine: 8,
                        startColumn: 5,
                        endLine: 8,
                        endColumn: 36
                    }
                ]
            },
            {
                ruleName: "MinVersionForAbstractVirtualClassesWithPrivateMethod",
                message: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassWithPrivateMethod", "testVirtualClassWithPrivateMethod.cls"),
                        startLine: 2,
                        startColumn: 5,
                        endLine: 2,
                        endColumn: 36
                    }
                ]
            },
            {
                ruleName: "MinVersionForAbstractVirtualClassesWithPrivateMethod",
                message: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassWithPrivateMethod", "testAbstractClassWithPrivateMethod2.cls"),
                        startLine: 6,
                        startColumn: 5,
                        endLine: 6,
                        endColumn: 44
                    }
                ]
            },
            {
                ruleName: "MinVersionForAbstractVirtualClassesWithPrivateMethod",
                message: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleMessage'),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "apexClassWithPrivateMethod", "testVirtualClassWithPrivateMethod2.cls"),
                        startLine: 6,
                        startColumn: 5,
                        endLine: 6,
                        endColumn: 56
                    }
                ]
            },
        ];

        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }
    });

    it("Ensure when runRules is called on a directory of files with inclusivity rule violations, engine emits violations correctly", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
                path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace")
            ])};
        const runResults: EngineRunResults = await engine.runRules(["AvoidTermsWithImplicitBias"], runOptions);
        const expectedViolations: Violation[] = [
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy1.cls'),
                        startLine: 8,
                        startColumn: 4,
                        endLine: 8,
                        endColumn: 13
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy1.cls'),
                        startLine: 8,
                        startColumn: 15,
                        endLine: 8,
                        endColumn: 26
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy1.cls'),
                        startLine: 6,
                        startColumn: 6,
                        endLine: 6,
                        endColumn: 11
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy2.ts'),
                        startLine: 2,
                        startColumn: 17,
                        endLine: 2,
                        endColumn: 28
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy2.ts'),
                        startLine: 4,
                        startColumn: 7,
                        endLine: 4,
                        endColumn: 21
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy2.ts'),
                        startLine: 5,
                        startColumn: 13,
                        endLine: 5,
                        endColumn: 27
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy2.ts'),
                        startLine: 5,
                        startColumn: 32,
                        endLine: 5,
                        endColumn: 41
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy2.ts'),
                        startLine: 5,
                        startColumn: 43,
                        endLine: 5,
                        endColumn: 52
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy3.js'),
                        startLine: 1,
                        startColumn: 17,
                        endLine: 1,
                        endColumn: 25
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy3.js'),
                        startLine: 3,
                        startColumn: 18,
                        endLine: 3,
                        endColumn: 23
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy4.txt'),
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 9
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy4.txt'),
                        startLine: 5,
                        startColumn: 1,
                        endLine: 5,
                        endColumn: 11
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy6.mjs'),
                        startLine: 3,
                        startColumn: 18,
                        endLine: 3,
                        endColumn: 23
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy7.trigger'),
                        startLine: 1,
                        startColumn: 4,
                        endLine: 1,
                        endColumn: 16
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy8.tsx'),
                        startLine: 3,
                        startColumn: 7,
                        endLine: 3,
                        endColumn: 21
                    }
                ]
            },
            {
                ruleName: "AvoidTermsWithImplicitBias",
                message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "inclusivityRuleWorkspace", 'dummy9.jsx'),
                        startLine: 3,
                        startColumn: 22,
                        endLine: 3,
                        endColumn: 28
                    }
                ]
            },
        ]
        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }

    });

    it("When workspace contains files that violate custom rules, then emit violation correctly", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
            path.resolve(__dirname, "test-data", "sampleWorkspace")
        ])};
        const runResults: EngineRunResults = await engine.runRules(["NoTodos", "NoHellos"], runOptions);

        const expectedViolations: Violation[] = [
            {
                ruleName: "NoTodos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy3.js"),
                        startLine: 1,
                        startColumn: 3,
                        endLine: 1,
                        endColumn: 8
                    }
                ]
            },
            {
                ruleName: "NoTodos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy3.js"),
                        startLine: 3,
                        startColumn: 17,
                        endLine: 3,
                        endColumn: 22
                    }
                ]
            },
            {
                ruleName: "NoHellos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy3.js"),
                        startLine: 3,
                        startColumn: 29,
                        endLine: 3,
                        endColumn: 34
                    }
                ]
            },
            {
                ruleName: "NoHellos",
                message: "sample violation message",
                primaryLocationIndex: 0,
                codeLocations: [
                    {
                        file: path.resolve(__dirname, "test-data", "sampleWorkspace", "dummy4.txt"),
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 6
                    }
                ]
            }

        ];

        expect(runResults.violations).toHaveLength(expectedViolations.length);
        for (const expectedViolation of expectedViolations) {
            expect(runResults.violations).toContainEqual(expectedViolation);
        }
    });

    it("When running all rules compared to some rules, then output correctly returns what the correct violations according to specified rules", async () => {
        const runOptions: RunOptions = {workspace: new Workspace([
                path.resolve(__dirname, "test-data", "sampleWorkspace")
            ])};
        const ruleNames: string[] = ['NoTrailingWhitespace', 'AvoidTermsWithImplicitBias', 'AvoidOldSalesforceApiVersions', 'NoHellos', 'NoTodos']
        const individualRunViolations: Violation[] = []

        for (const rule of ruleNames) {
            individualRunViolations.push(... (await engine.runRules([rule], runOptions)).violations);
        }

        const combinedRunViolations: Violation[] = (await engine.runRules(ruleNames, runOptions)).violations
        expect(individualRunViolations.length).toEqual(combinedRunViolations.length)
        for (const individualRunViolation of individualRunViolations) {
            expect(combinedRunViolations).toContainEqual(individualRunViolation);
        }
    });
});