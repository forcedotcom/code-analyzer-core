import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {
    DescribeOptions,
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    RuleDescription,
    RunOptions,
    RunRulesProgressEvent,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {CpdEngine} from "../src/cpd-engine";
import fs from "node:fs";
import path from "node:path";
import {DEFAULT_CPD_ENGINE_CONFIG} from "../src/config";
import {Language} from "../src/constants";
import os from "node:os";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

describe('Tests for the getName method of CpdEngine', () => {
    it('When getName is called, then cpd is returned', () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        expect(engine.getName()).toEqual('cpd');
    });
});

describe('Tests for the describeRules method of PmdEngine', () => {
    it('When using defaults without workspace, then all default language rules are returned', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        const progressEvents: DescribeRulesProgressEvent[] = [];
        engine.onEvent(EventType.DescribeRulesProgressEvent, (e: DescribeRulesProgressEvent) => progressEvents.push(e));

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_allDefaultLanguages.goldfile.json');

        // Also check that we have all the correct progress events
        expect(progressEvents.map(e => e.percentComplete)).toEqual([33, 100]);
    });

    it('When using defaults with workspace that only targets apex code, then only apex rule is returned', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace('id', [TEST_DATA_FOLDER], [
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1_ItselfContainsDuplicateBlocksOfMoreThan100Tokens.cls')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When file_extensions associates .txt file to apex language and workspace only has .txt file, then apex rule is returned', async () => {
        const engine: CpdEngine = new CpdEngine({
            ... DEFAULT_CPD_ENGINE_CONFIG,
            file_extensions: {
                ... DEFAULT_CPD_ENGINE_CONFIG.file_extensions,
                apex: ['.txt'],
            }
        });
        const workspace: Workspace = new Workspace('id', [
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'dummy.txt')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When selecting no languages, then zero rules are returned', async () => {
        const engine: CpdEngine = new CpdEngine({
            ... DEFAULT_CPD_ENGINE_CONFIG,
            rule_languages: []
        });

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());

        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When selecting only the apex language and no workspace, only apex rule is returned', async () => {
        const engine: CpdEngine = new CpdEngine({
            ... DEFAULT_CPD_ENGINE_CONFIG,
            rule_languages: [Language.APEX]
        });

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions());

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexOnly.goldfile.json');
    });

    it('When selecting three languages but workspace only contains files for two of the languages, then only those two rules are returned', async () => {
        const engine: CpdEngine = new CpdEngine({
            ... DEFAULT_CPD_ENGINE_CONFIG,
            rule_languages: [Language.APEX, Language.HTML, Language.XML]
        });
        const workspace: Workspace = new Workspace('id', [
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1_ItselfContainsDuplicateBlocksOfMoreThan100Tokens.cls'),
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'someReplicatedFileWithOver100Tokens.html')
        ]);

        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));

        await expectRulesToMatchGoldFile(ruleDescriptions, 'rules_apexAndHtmlOnly.goldfile.json');
    });
});

async function expectRulesToMatchGoldFile(actualRuleDescriptions: RuleDescription[], relativeExpectedFile: string): Promise<void> {
    const actualRuleDescriptionsJsonString: string = JSON.stringify(actualRuleDescriptions, undefined, 2);
    const expectedRuleDescriptionsJsonString: string = await fs.promises.readFile(
        path.join(TEST_DATA_FOLDER, 'cpdGoldfiles', relativeExpectedFile), 'utf-8');
    expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
}

describe('Tests for the runRules method of CpdEngine', () => {
    it('When zero rules names are provided then return zero violations', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        expect(await engine.runRules([], createRunOptions(new Workspace('id', [__dirname])))).toEqual({violations: []});
    });

    it('When rule name is not associated with a language that CPD knows about, then throw error', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        await expect(engine.runRules(['DetectCopyPasteForOops'], createRunOptions(new Workspace('id', [__dirname])))).rejects.toThrow(
            /Unexpected error: The rule 'DetectCopyPasteForOops' does not map to a supported CPD language:.*/);
    });

    it('When specified rules are not relevant to users workspace, then return zero violations', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1_ItselfContainsDuplicateBlocksOfMoreThan100Tokens.cls')]);
        const ruleNames: string[] = ['DetectCopyPasteForHtml'];
        const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

        expect(results.violations).toHaveLength(0);
    });

    it('When specified rules contain relevant files containing no duplicate blocks using the default minimumToken value, then return zero violations', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        const workspace: Workspace = new Workspace('id', [
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript1_ItselfContainsDuplicateBlocksButWithVeryFewTokens.js'),
            path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript2_ContainsNearlyAllTheSameTokensAsSampleJavascript1.js') // duplicate blocks are smaller than default 100 tokens
        ]);
        const ruleNames: string[] = ['DetectCopyPasteForJavascript'];
        const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

        expect(results.violations).toHaveLength(0);
    });

    it('When using defaults and workspace contains relevant files containing duplicate blocks, then return violations', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace')]);
        const ruleNames: string[] = ['DetectCopyPasteForApex', 'DetectCopyPasteForHtml', 'DetectCopyPasteForJavascript'];

        const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

        const expViolation1: Violation = {
            ruleName: "DetectCopyPasteForHtml",
            message: "Duplicate code detected for language 'html'. Found 2 code locations containing the same block of code consisting of 123 tokens across 43 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'someReplicatedFileWithOver100Tokens.html'),
                    startLine: 1,
                    startColumn: 1,
                    endLine: 43, // This should be 44 - this might be a bug with CPD: https://github.com/pmd/pmd/issues/5313
                    endColumn: 8
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'subFolder', 'someReplicatedFileWithOver100Tokens.html'),
                    startLine: 1,
                    startColumn: 1,
                    endLine: 43, // This should be 44 - this might be a bug with CPD: https://github.com/pmd/pmd/issues/5313
                    endColumn: 8
                }
            ]
        };

        const expViolation2: Violation = {
            ruleName: "DetectCopyPasteForApex",
            message: "Duplicate code detected for language 'apex'. Found 2 code locations containing the same block of code consisting of 113 tokens across 27 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1_ItselfContainsDuplicateBlocksOfMoreThan100Tokens.cls'),
                    startLine: 2,
                    startColumn: 34,
                    endLine: 28,
                    endColumn: 6
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass2_ContainsMoreThan100SameTokensAsApexClass1.cls'),
                    startLine: 2,
                    startColumn: 24,
                    endLine: 29,
                    endColumn: 4
                }
            ]
        };

        const expViolation3: Violation = {
            ruleName: "DetectCopyPasteForApex",
            message: "Duplicate code detected for language 'apex'. Found 3 code locations containing the same block of code consisting of 104 tokens across 24 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1_ItselfContainsDuplicateBlocksOfMoreThan100Tokens.cls'),
                    startLine: 5,
                    startColumn: 5,
                    endLine: 28,
                    endColumn: 6
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass1_ItselfContainsDuplicateBlocksOfMoreThan100Tokens.cls'),
                    startLine: 31,
                    startColumn: 9,
                    endLine: 54,
                    endColumn: 10
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'ApexClass2_ContainsMoreThan100SameTokensAsApexClass1.cls'),
                    startLine: 6,
                    startColumn: 3,
                    endLine: 29,
                    endColumn: 4
                }
            ]
        }

        expect(results.violations).toHaveLength(3);
        expect(results.violations).toContainEqual(expViolation1);
        expect(results.violations).toContainEqual(expViolation2);
        expect(results.violations).toContainEqual(expViolation3);

        // Notice how with the default 100 minimum_tokens that the sampleJavascript1_ItselfContainsDuplicateBlocksButWithVeryFewTokens
        // file doesn't get picked up even though we specified the DetectCopyPasteForJavascript rule. See the next test.

        // Also check that we have all the correct progress events
        expect(progressEvents.map(e => e.percentComplete)).toEqual([2, 5, 9.65, 14.3, 17.4, 20.5,
            26.7, 32.9, 39.1, 42.2, 45.3, 51.5, 57.7, 63.9, 67, 70.1, 76.3, 82.5, 88.7, 93.35, 98, 100]);
    });

    it('When specifying a minimum_tokens length that is small enough to pick up smaller code blocks, then violations are returned', async () => {
        const engine: CpdEngine = new CpdEngine({
            ...DEFAULT_CPD_ENGINE_CONFIG,
            minimum_tokens: {
                ... DEFAULT_CPD_ENGINE_CONFIG.minimum_tokens,
                [Language.JAVASCRIPT]: 10
            }
        });
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace')]);
        const ruleNames: string[] = ['DetectCopyPasteForJavascript'];

        const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

        const expViolation1: Violation = {
            ruleName: "DetectCopyPasteForJavascript",
            message: "Duplicate code detected for language 'javascript'. Found 2 code locations containing the same block of code consisting of 36 tokens across 10 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript1_ItselfContainsDuplicateBlocksButWithVeryFewTokens.js'),
                    startLine: 1,
                    startColumn: 14,
                    endLine: 10,
                    endColumn: 2
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript2_ContainsNearlyAllTheSameTokensAsSampleJavascript1.js'),
                    startLine: 1,
                    startColumn: 14,
                    endLine: 10,
                    endColumn: 2
                }
            ]
        };

        const expViolation2: Violation = {
            ruleName: "DetectCopyPasteForJavascript",
            message: "Duplicate code detected for language 'javascript'. Found 4 code locations containing the same block of code consisting of 13 tokens across 4 lines.",
            primaryLocationIndex: 0,
            codeLocations: [
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript1_ItselfContainsDuplicateBlocksButWithVeryFewTokens.js'),
                    startLine: 1,
                    startColumn: 15,
                    endLine: 4,
                    endColumn: 2
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript1_ItselfContainsDuplicateBlocksButWithVeryFewTokens.js'),
                    startLine: 6,
                    startColumn: 10,
                    endLine: 9,
                    endColumn: 4
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript2_ContainsNearlyAllTheSameTokensAsSampleJavascript1.js'),
                    startLine: 1,
                    startColumn: 15,
                    endLine: 4,
                    endColumn: 2
                },
                {
                    file: path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace', 'sampleJavascript2_ContainsNearlyAllTheSameTokensAsSampleJavascript1.js'),
                    startLine: 6,
                    startColumn: 10,
                    endLine: 9,
                    endColumn: 4
                }
            ]
        };

        expect(results.violations).toHaveLength(2);
        expect(results.violations).toContainEqual(expViolation1);
        expect(results.violations).toContainEqual(expViolation2);
    });

    it('When skipping duplicate files, then results should not include duplicates from files of same name and length', async () => {
        const engine: CpdEngine = new CpdEngine({
            ... DEFAULT_CPD_ENGINE_CONFIG,
            skip_duplicate_files: true
        });
        const progressEvents: RunRulesProgressEvent[] = [];
        engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => progressEvents.push(e));

        const workspace: Workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace')]);
        const ruleNames: string[] = ['DetectCopyPasteForHtml'];

        const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

        expect(results.violations).toHaveLength(0); // Should not pick up the someReplicatedFileWithOver100Tokens.html files
    });

    it('When file_extensions removes ".cls" but adds in ".txt" for apex language then runRules picks up correct files', async () => {
        const engine: CpdEngine = new CpdEngine({
            ... DEFAULT_CPD_ENGINE_CONFIG,
            file_extensions: {
                ... DEFAULT_CPD_ENGINE_CONFIG.file_extensions,
                apex: ['.txt']
            }
        });
        const workspace: Workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace')]);
        const ruleNames: string[] = ['DetectCopyPasteForApex'];
        const results: EngineRunResults = await engine.runRules(ruleNames, createRunOptions(workspace));

        expect(results.violations).toHaveLength(1);
        expect(results.violations[0].ruleName).toEqual('DetectCopyPasteForApex');
        expect(results.violations[0].codeLocations[0].file).toEqual(path.join(TEST_DATA_FOLDER, 'sampleCpdWorkspace','dummy.txt'));
    });
});

describe('Tests for the getEngineVersion method of CpdEngine', () => {
    it('Outputs something resembling a Semantic Version', async () => {
        const engine: CpdEngine = new CpdEngine(DEFAULT_CPD_ENGINE_CONFIG);
        const version: string = await engine.getEngineVersion();

        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });
});

function createDescribeOptions(workspace?: Workspace): DescribeOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace
    }
}

function createRunOptions(workspace: Workspace): RunOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace
    }
}
