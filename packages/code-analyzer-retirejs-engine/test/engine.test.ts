import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {RetireJsEngine} from "../src/engine";
import {RetireJsExecutor} from "../src/executor";
import {changeWorkingDirectoryToPackageRoot, createDescribeOptions, createRunOptions} from "./test-helpers";
import * as path from "node:path";
import * as fs from "node:fs";
import {Finding} from "retire/lib/types";
import {getMessage} from "../src/messages";

changeWorkingDirectoryToPackageRoot();

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: "/temp/some-folder/jquery-3.1.0.js",
    startLine: 1,
    startColumn: 1
}

const EXPECTED_CODE_LOCATION_2: CodeLocation = {
    file: "/temp/someZipFile.zip",
    startLine: 1,
    startColumn: 1
}

const EXPECTED_VIOLATION_1: Violation = {
    ruleName: "LibraryWithKnownMediumSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_1],
    primaryLocationIndex: 0,
    message: `${getMessage('LibraryContainsKnownVulnerability', 'jquery v3.1.0')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "jQuery before 3.4.0, as used in Drupal, Backdrop CMS, and other products, mishandles jQuery.extend(true, {}, ...) because of Object.prototype pollution",\n  "CVE": [\n    "CVE-2019-11358"\n  ],\n  "PR": "4333",\n  "githubID": "GHSA-6c3j-c64m-qhgq"\n}`),
    resourceUrls: [
        "https://blog.jquery.com/2019/04/10/jquery-3-4-0-released/",
        "https://github.com/jquery/jquery/commit/753d591aea698e57d6db58c9f722cd0808619b1b",
        "https://nvd.nist.gov/vuln/detail/CVE-2019-11358"
    ]
};

const EXPECTED_VIOLATION_2: Violation = {
    ruleName: "LibraryWithKnownMediumSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_1],
    primaryLocationIndex: 0,
    message: `${getMessage('LibraryContainsKnownVulnerability', 'jquery v3.1.0')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "passing HTML containing <option> elements from untrusted sources - even after sanitizing it - to one of jQuery's DOM manipulation methods (i.e. .html(), .append(), and others) may execute untrusted code.",\n  "CVE": [\n    "CVE-2020-11023"\n  ],\n  "issue": "4647",\n  "githubID": "GHSA-jpcq-cgw6-v4j6"\n}`),
    resourceUrls: [
        "https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/"
    ],
}

const EXPECTED_VIOLATION_3: Violation = {
    ruleName: "LibraryWithKnownHighSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_1],
    primaryLocationIndex: 0,
    message: `${getMessage('LibraryContainsKnownVulnerability', 'jquery v3.1.0')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "Regex in its jQuery.htmlPrefilter sometimes may introduce XSS",\n  "CVE": [\n    "CVE-2020-11022"\n  ],\n  "issue": "4642",\n  "githubID": "GHSA-gxr4-xjj5-5px2"\n}`),
    resourceUrls: [
        "https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/"
    ]
}

const EXPECTED_VIOLATION_4: Violation = {
    ruleName: "LibraryWithKnownLowSeverityVulnerability",
    codeLocations: [EXPECTED_CODE_LOCATION_2],
    primaryLocationIndex: 0,
    message: `${getMessage('VulnerableLibraryFoundInZipArchive', 'sessvars v1.0.0', 'innerFolder/sessvars-1.0.0.min.js')} ${getMessage('UpgradeToLatestVersion')}\n`
        + getMessage('VulnerabilityDetails', `{\n  "summary": "Unsanitized data passed to eval()",\n  "CVE": [\n    "CWE-79"\n  ]\n}`),
    resourceUrls: [
        "http://www.thomasfrank.se/sessionvars.html"
    ]
}

const DUMMY_WORKSPACE: Workspace = new Workspace('dummy', [path.resolve(__dirname,'test-data','scenarios','1_hasJsLibraryWithVulnerability')]);
const DUMMY_DESCRIBE_OPTIONS: DescribeOptions = createDescribeOptions(DUMMY_WORKSPACE);
const DUMMY_RUN_OPTIONS: RunOptions = createRunOptions(DUMMY_WORKSPACE);

describe('Tests for the RetireJsEngine', () => {
    let engine: Engine;
    let allRuleNames: string[];

    beforeEach(async () => {
        engine = new RetireJsEngine(new StubRetireJsExecutor());
        allRuleNames = (await engine.describeRules(DUMMY_DESCRIBE_OPTIONS)).map(r => r.name);
    });

    it('When getName is called, then retire-js is returned', () => {
        expect(engine.getName()).toEqual('retire-js');
    });

    it('When getEngineVersion is called, it returns something resembling a Semantic Version', async () => {
        const version: string = await engine.getEngineVersion();

        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });

    it('When describeRules is called, then the expected rules are returned', async () => {
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(DUMMY_DESCRIBE_OPTIONS);
        expect(ruleDescriptions).toHaveLength(4);
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownCriticalSeverityVulnerability',
            severityLevel: SeverityLevel.Critical,
            tags: ['Recommended', 'Security', 'JavaScript'],
            description: getMessage('RetireJsRuleDescription', 'critical'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownHighSeverityVulnerability',
            severityLevel: SeverityLevel.High,
            tags: ['Recommended', 'Security', 'JavaScript'],
            description: getMessage('RetireJsRuleDescription', 'high'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownMediumSeverityVulnerability',
            severityLevel: SeverityLevel.Moderate,
            tags: ['Recommended', 'Security', 'JavaScript'],
            description: getMessage('RetireJsRuleDescription', 'medium'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
        expect(ruleDescriptions).toContainEqual({
            name: 'LibraryWithKnownLowSeverityVulnerability',
            severityLevel: SeverityLevel.Low,
            tags: ['Recommended', 'Security', 'JavaScript'],
            description: getMessage('RetireJsRuleDescription', 'low'),
            resourceUrls: ['https://retirejs.github.io/retire.js/']
        });
    });

    it('When runRules is called, then the RetireJsExecutor is called with the correct inputs', async () => {
        // Note: This test replaces the StubRetireJsExecutor with a SpyRetireJsExecutor instead.
        const spyExecutor: SpyRetireJsExecutor = new SpyRetireJsExecutor();
        engine = new RetireJsEngine(spyExecutor);

        const workspace: Workspace = new Workspace('id', [path.resolve('build-tools'), path.resolve('test/test-helpers.ts')]);
        const runOptions: RunOptions = createRunOptions(workspace);
        const results: EngineRunResults = await engine.runRules(allRuleNames, runOptions);

        expect(spyExecutor.executeCallHistory).toEqual([{targetFiles: [
            path.resolve('build-tools', 'updateRetireJsVulns.mjs') // This is the only file that should be targeted from workspace
            ]}]);
        expect(results).toEqual({violations: []}); // Sanity check that zero vulnerabilities gives zero violations.
    });

    it('When using all rules and violations are found, then the engine correctly returns the results', async () => {
        const allRuleNames: string[] = (await engine.describeRules(DUMMY_DESCRIBE_OPTIONS)).map(r => r.name);
        const engineRunResults: EngineRunResults = await engine.runRules(allRuleNames, DUMMY_RUN_OPTIONS);

        expect(engineRunResults.violations).toHaveLength(4);
        expect(engineRunResults.violations[0]).toEqual(EXPECTED_VIOLATION_1);
        expect(engineRunResults.violations[1]).toEqual(EXPECTED_VIOLATION_2);
        expect(engineRunResults.violations[2]).toEqual(EXPECTED_VIOLATION_3);
        expect(engineRunResults.violations[3]).toEqual(EXPECTED_VIOLATION_4);
    });

    it('When only selecting some rules, then only violations for those rules are returned', async () => {
        const engineRunResults1: EngineRunResults = await engine.runRules(
            ['LibraryWithKnownHighSeverityVulnerability', 'LibraryWithKnownLowSeverityVulnerability'],
            DUMMY_RUN_OPTIONS);
        expect(engineRunResults1).toEqual({
            violations: [EXPECTED_VIOLATION_3, EXPECTED_VIOLATION_4]
        });

        const engineRunResults2: EngineRunResults = await engine.runRules(
            ['LibraryWithKnownMediumSeverityVulnerability', 'LibraryWithKnownCriticalSeverityVulnerability'],
            DUMMY_RUN_OPTIONS);
        expect(engineRunResults2).toEqual({
            violations: [EXPECTED_VIOLATION_1, EXPECTED_VIOLATION_2]
        });


        const engineRunResults3: EngineRunResults = await engine.runRules(
            ['LibraryWithKnownCriticalSeverityVulnerability'], DUMMY_RUN_OPTIONS);
        expect(engineRunResults3).toEqual({violations: []});
    });

    it('When vulnerable targeted file is underneath a node_modules or bower_components folder, then they are not included in the target files to scan', async () => {
        const spyExecutor: SpyRetireJsExecutor = new SpyRetireJsExecutor();
        engine = new RetireJsEngine(spyExecutor);
        const workspace: Workspace = new Workspace('id', [path.resolve('test', 'test-data')], [
            path.resolve('test','test-data','scenarios','8_hasVulnerabilitiesUnderFoldersToSkip')]);
        await engine.runRules(allRuleNames, createRunOptions(workspace));
        expect(spyExecutor.executeCallHistory).toEqual([{targetFiles: []}]);
    });

    it('When vulnerable file is a non-relevant text file, then they are not included in the relevant files to scan', async () => {
        const spyExecutor: SpyRetireJsExecutor = new SpyRetireJsExecutor();
        engine = new RetireJsEngine(spyExecutor);
        const workspace: Workspace = new Workspace('id', [
            path.resolve('test','test-data','scenarios','9_hasVulnerabilityInNonTargetedTextFile')]);
        await engine.runRules(allRuleNames, createRunOptions(workspace));
        expect(spyExecutor.executeCallHistory).toEqual([{targetFiles: []}]);
    });

    it('When no relevant files are targeted, then describeRules returns zero rules', async () => {
        const workspace: Workspace = new Workspace('id', [path.resolve('test','test-data')], [
            path.resolve('test','test-data','scenarios','9_hasVulnerabilityInNonTargetedTextFile')
        ]);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules(createDescribeOptions(workspace));
        expect(ruleDescriptions).toHaveLength(0);
    });
});

class SpyRetireJsExecutor implements RetireJsExecutor {
    readonly executeCallHistory: {targetFiles: string[]}[] = [];

    async execute(targetFiles: string[]): Promise<Finding[]> {
        this.executeCallHistory.push({targetFiles});
        return [];
    }
}

class StubRetireJsExecutor implements RetireJsExecutor {
    async execute(_targetFiles: string[]): Promise<Finding[]> {
        const jsonStr: string = fs.readFileSync(path.resolve('test','test-data','sampleRetireJsExecutorFindings.json'),'utf-8');
        return JSON.parse(jsonStr) as Finding[];
    }
}