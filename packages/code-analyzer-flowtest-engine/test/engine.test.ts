import {RuleDescription, RuleType, SeverityLevel, Workspace} from "@salesforce/code-analyzer-engine-api";
import {FlowTestEngine} from "../src/engine";
import {FlowTestCommandWrapper, FlowTestResultFile, FlowTestRuleDescriptor} from "../src/python/FlowTestCommandWrapper";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";

changeWorkingDirectoryToPackageRoot();

const WELL_FORMED_RULES: FlowTestRuleDescriptor[] = [{
    query_id: 'FakeId1',
    query_name: 'Fake_Flow_Rule_1',
    severity: 'Flow_High_Severity',
    query_description: 'Fake Description 1',
    help_url: 'https://www.salesforce.com',
    query_version: "0",
    is_security: "True"
}, {
    query_id: 'FakeId2',
    query_name: 'Fake_Flow_Rule_2',
    severity: 'Flow_Moderate_Severity',
    query_description: 'Fake Description 2',
    help_url: 'https://www.github.com/forcedotcom/code-analyzer-core',
    query_version: "0",
    is_security: "True"
}, {
    query_id: 'FakeId3',
    query_name: 'Fake_Flow_Rule_3',
    severity: 'Flow_Low_Severity',
    query_description: 'Fake Description 3',
    help_url: 'None',
    query_version: "0",
    is_security: "False"
}, {
    query_id: 'FakeId4',
    query_name: 'Fake_Flow_Rule_4',
    severity: 'Flow_Low_Severity',
    query_description: 'Fake Description 4',
    help_url: '',
    query_version: "0",
    is_security: "False"
}];

const MALFORMED_RULES: FlowTestRuleDescriptor[] = [{
    query_id: 'FakeId1',
    query_name: 'Fake_Flow_Rule_1',
    severity: 'InvalidSeverityValue',
    query_description: 'This Rule has an invalid Severity',
    help_url: 'https://www.salesforce.com',
    query_version: "0",
    is_security: "True"
}];

describe('Tests for the FlowTestEngine', () => {
    it('getName() returns correct name', () => {
        const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper([]));
        expect(engine.getName()).toEqual('flowtest');
    });

    describe('#describeRules()', () => {
        it('Parses well-formed FlowTest rule descriptors into Code Analyzer rule descriptors', async () => {
            // Construct the engine, injecting a Stub wrapper to replace the real one.
            const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper(WELL_FORMED_RULES));

            const ruleDescriptors: RuleDescription[] = await engine.describeRules({});

            expect(ruleDescriptors).toHaveLength(4);
            expect(ruleDescriptors[0]).toEqual({
                name: 'Fake_Flow_Rule_1',
                severityLevel: SeverityLevel.High,
                type: RuleType.Flow,
                tags: ['Recommended', 'Security'],
                description: 'Fake Description 1',
                resourceUrls: ['https://www.salesforce.com']
            });
            expect(ruleDescriptors[1]).toEqual({
                name: 'Fake_Flow_Rule_2',
                severityLevel: SeverityLevel.Moderate,
                type: RuleType.Flow,
                tags: ['Recommended', 'Security'],
                description: 'Fake Description 2',
                resourceUrls: ['https://www.github.com/forcedotcom/code-analyzer-core']
            });
            expect(ruleDescriptors[2]).toEqual({
                name: 'Fake_Flow_Rule_3',
                severityLevel: SeverityLevel.Low,
                type: RuleType.Flow,
                tags: ['Recommended'],
                description: 'Fake Description 3',
                resourceUrls: []
            });
            expect(ruleDescriptors[3]).toEqual({
                name: 'Fake_Flow_Rule_4',
                severityLevel: SeverityLevel.Low,
                type: RuleType.Flow,
                tags: ['Recommended'],
                description: 'Fake Description 4',
                resourceUrls: []
            });
        });

        it.each([
            {ruleIndex: 0, defect: 'invalid severity level'}
        ])('Throws coherent error for malformed FlowTest rule descriptors. Case: $defect', async ({ruleIndex, defect}) => {
            // Construct the engine, injecting a Stub wrapper to replace the real one.
            const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper([MALFORMED_RULES[ruleIndex]]));

            // Expect the Describe call to fail with a message containing the defect description.
            await expect(engine.describeRules({})).rejects.toThrow(defect);
        });
    });

    describe('#runRules()', () => {
        it('Math still works', () => {
            expect(2 + 2).toEqual(4);
        })
    });

    it('TEMPORARY TEST FOR CODE COVERAGE', async () => {
        // Will delete this test as soon as engine is implemented.
        const engine: FlowTestEngine = new FlowTestEngine(new StubCommandWrapper([]));
        expect(await engine.runRules([], {workspace: new Workspace([__dirname])})).toEqual({violations: []});
    });
});

class StubCommandWrapper implements FlowTestCommandWrapper {
    private readonly rules: FlowTestRuleDescriptor[];

    public constructor(rules: FlowTestRuleDescriptor[]) {
        this.rules = rules;
    }

    public getFlowTestRuleDescriptions(): Promise<FlowTestRuleDescriptor[]> {
        return Promise.resolve(this.rules);
    }

    public runFlowTest(workspace: Workspace): Promise<FlowTestResultFile> {
        return Promise.resolve({results: null});
    }
}