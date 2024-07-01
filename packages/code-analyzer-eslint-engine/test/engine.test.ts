import {Engine, EnginePluginV1, RuleDescription} from "@salesforce/code-analyzer-engine-api";
import * as testTools from "@salesforce/code-analyzer-engine-api/testtools";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {ESLintEngine, ESLintEnginePlugin} from "../src/engine";
import {getMessage} from "../src/messages";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

changeWorkingDirectoryToPackageRoot();

describe('Tests for the ESLintEnginePlugin', () => {
    let plugin: EnginePluginV1;
    beforeAll(() => {
        plugin = new ESLintEnginePlugin();
    });

    it('When the getAvailableEngineNames method is called then only eslint is returned', () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['eslint']);
    });

    it('When createEngine is passed eslint then an ESLintEngine instance is returned', async () => {
        expect(await plugin.createEngine('eslint', {})).toBeInstanceOf(ESLintEngine);
    });

    it('When createEngine is passed anything else then an error is thrown', () => {
        expect(plugin.createEngine('oops', {})).rejects.toThrow(
            getMessage('CantCreateEngineWithUnknownEngineName' ,'oops'));
    });
});

describe('Tests for the ESLintEngine', () => {
    let engine: Engine;
    beforeEach(() => {
        engine = new ESLintEngine();
    });

    it('When getName is called, then eslint is returned', () => {
        expect(engine.getName()).toEqual('eslint');
    });

    async function testFromCwdWithoutWorkspaceDescribeRules(caseParentFolder: string, caseName: string): Promise<void> {
        const caseFolder: string = path.resolve(__dirname, 'test-data', caseParentFolder, caseName);

        const origWorkingDir: string = process.cwd();
        process.chdir(caseFolder);
        try {
            const ruleDescriptions: RuleDescription[] = await engine.describeRules({});
            const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
            const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
                path.join(caseFolder, 'expectedRuleDescriptions.json'), 'utf8')
                .replaceAll('\r',''); // Remove carriage return characters from files in windows
            expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
        } finally {
            process.chdir(origWorkingDir);
        }
    }

    it('When describing rules while cwd is folder with no customizations, then return expected', async () => {
        await testFromCwdWithoutWorkspaceDescribeRules('legacyConfigCases', '1_NoCustomization');
    });

    it('When describing rules while cwd is folder with config that modifies existing rules, then return expected', async () => {
        await testFromCwdWithoutWorkspaceDescribeRules('legacyConfigCases', '2_CustomizationOfExistingRules');
    });

    it('When describing rules while cwd is folder with config that adds a new plugin and rules, then return expected', async () => {
        await testFromCwdWithoutWorkspaceDescribeRules('legacyConfigCases', '3_CustomizationWithNewRules');
    });

    async function testNotFromCwdWithWorkspaceDescribeRules(caseParentFolder: string, caseName: string): Promise<void> {
        const caseFolder: string = path.resolve(__dirname, 'test-data', caseParentFolder, caseName);
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([caseFolder])});
        const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
        const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
            path.join(caseFolder, 'expectedRuleDescriptions.json'), 'utf8')
            .replaceAll('\r',''); // Remove carriage return characters from files in windows
        expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
    }

    it('When describing rules while from a workspace with no customizations, then return expected', async () => {
        await testNotFromCwdWithWorkspaceDescribeRules('legacyConfigCases', '1_NoCustomization');
    });

    it('When describing rules while from a workspace with config that modifies existing rules, then return expected', async () => {
        await testNotFromCwdWithWorkspaceDescribeRules('legacyConfigCases', '2_CustomizationOfExistingRules');
    });

    it('When describing rules while from a workspace with config that adds a new plugin and rules, then return expected', async () => {
        await testNotFromCwdWithWorkspaceDescribeRules('legacyConfigCases', '3_CustomizationWithNewRules');
    });

    it('When describing rules from a workspace with no javascript files, then no javascript rules should return', async () => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', 'legacyConfigCases', '1_NoCustomization');
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(caseFolder, 'dummy3.txt'), path.join(caseFolder, 'dummy2.ts')])});

        const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);

        // Note that it important to note that typescript uses the base eslint rules and additional typescript rules. So
        // the base eslint rules should not be removed.
        const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
            path.join(caseFolder, 'expectedRuleDescriptionsWithNoJavascript.json'), 'utf8')
            .replaceAll('\r',''); // Remove carriage return characters from files in windows
        expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
    });

    it('When describing rules from a workspace with no typescript files, then no typescript rules should returned', async () => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', 'legacyConfigCases', '1_NoCustomization');
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
            path.join(caseFolder, 'dummy1.js'), path.join(caseFolder, 'dummy3.txt')])});

        const actualRuleDescriptionsJsonString: string = JSON.stringify(ruleDescriptions, undefined, 2);
        const expectedRuleDescriptionsJsonString: string = fs.readFileSync(
            path.join(caseFolder, 'expectedRuleDescriptionsWithNoTypescript.json'), 'utf8')
            .replaceAll('\r',''); // Remove carriage return characters from files in windows
        expect(actualRuleDescriptionsJsonString).toEqual(expectedRuleDescriptionsJsonString);
    });

    it('When describing rules from a workspace with no javascript or typescript files, then no rules should return', async () => {
        const caseFolder: string = path.resolve(__dirname, 'test-data', 'legacyConfigCases', '1_NoCustomization');
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([
                path.join(caseFolder, 'dummy3.txt')])});
        expect(ruleDescriptions).toHaveLength(0);
    });

    it('When describing rules from an empty workspace, then no rules should return', async () => {
        const ruleDescriptions: RuleDescription[] = await engine.describeRules({workspace: testTools.createWorkspace([])});
        expect(ruleDescriptions).toHaveLength(0);
    });
});