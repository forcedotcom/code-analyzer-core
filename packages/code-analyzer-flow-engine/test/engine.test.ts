import path from 'node:path';
import {
    DescribeOptions,
    DescribeRulesProgressEvent,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunOptions,
    RunRulesProgressEvent,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {FixedClock} from "@salesforce/code-analyzer-engine-api/utils";
import {FlowScannerEngine} from "../src/engine";
import {RunTimeFlowScannerCommandWrapper} from "../src/python/FlowScannerCommandWrapper";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import os from "node:os";
import {getMessage} from "../src/messages";
import fs from "node:fs";

changeWorkingDirectoryToPackageRoot();

//the space in the "example workspaces" path is important for testing purposes. do not remove.
const PATH_TO_NO_FLOWS_WORKSPACE = path.resolve(__dirname, 'test-data', 'example workspaces', 'contains-no-flows');
const PATH_TO_MULTIPLE_FLOWS_WORKSPACE = path.resolve(__dirname, 'test-data', 'example workspaces', 'contains-multiple-flows');
const PATH_TO_ONE_FLOW_NO_VIOLATIONS_WORKSPACE = path.resolve(__dirname, 'test-data', 'example workspaces', 'contains-one-flow-no-violations');
const PATH_TO_EXAMPLE1: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example1_containsWithoutSharingViolations.flow-meta.xml');
const PATH_TO_EXAMPLE2: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example2_containsWithSharingViolations.flow');
const PATH_TO_EXAMPLE3: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example3_containsNoViolations.flow');
const PATH_TO_EXAMPLE4_PARENTFLOW: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example4_parentFlow.flow-meta.xml');
const PATH_TO_EXAMPLE4_SUBFLOW: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example4_subflow.flow-meta.xml');
const PATH_TO_EXAMPLE5: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'shouldNotGetPickedUpByFlowScanner.xml');

describe('Tests for the TestEngine', () => {
    const flowScannerCommandWrapper: RunTimeFlowScannerCommandWrapper = new RunTimeFlowScannerCommandWrapper('python3');
    let tempFolder: string;

    beforeAll(async() => {
        tempFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'flow-engine-test'));
    });

    it('getName() returns correct name', () => {
        const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);
        expect(engine.getName()).toEqual('flow');
    });

    describe('End-to-End tests', () => {
        const sampleTimestamp: Date = new Date(2025, 1, 20, 14, 30, 18, 14);
        const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper, new FixedClock(sampleTimestamp));
        const workspace: Workspace = new Workspace('id', [PATH_TO_MULTIPLE_FLOWS_WORKSPACE]);

        it('Engine can describe rules, run them, and convert the results into standard format', async () => {
            const describeProgressEvents: DescribeRulesProgressEvent[] = [];
            engine.onEvent(EventType.DescribeRulesProgressEvent, (e: DescribeRulesProgressEvent) => describeProgressEvents.push(e));
            const runProgressEvents: RunRulesProgressEvent[] = [];
            engine.onEvent(EventType.RunRulesProgressEvent, (e: RunRulesProgressEvent) => runProgressEvents.push(e));
            const logEvents: LogEvent[] = [];
            engine.onEvent(EventType.LogEvent, (e: LogEvent)=> logEvents.push(e));

            // Part 1: Describing production rules.
            const ruleDescriptors: RuleDescription[] = await engine.describeRules(createDescribeOptions(tempFolder, workspace));
            // No need to do in-depth examination of the rules, since other tests already do that. Just make sure we got
            // the right number of rules.
            expect(ruleDescriptors).toHaveLength(2);
            expect(describeProgressEvents.map(e => e.percentComplete)).toEqual([0, 75, 100]);

            // Part 2: Running production rules.
            const results: EngineRunResults = await engine.runRules(ruleDescriptors.map(r => r.name),
                createRunOptions(tempFolder, workspace));
            // No need to do in-depth examination of the results, since other tests already do that. Just make sure we
            // got the right number of violations.
            expect(results.violations).toHaveLength(7);
            expect(runProgressEvents.map(e => e.percentComplete)).toEqual([0, 10, 10, 26, 42, 58, 74, 100]);

            // Confirm separate flow log file exists and the main log points to this file
            const debugLogMsgs: string[] = logEvents.filter(e => e.logLevel == LogLevel.Debug).map(e => e.message);
            expect(debugLogMsgs).toHaveLength(1);
            const expectedFlowLogFile: string = path.join(tempFolder, 'sfca-flow-2025_02_20_14_30_18_014.log');
            expect(debugLogMsgs[0]).toEqual(getMessage('WritingFlowLogToFile', expectedFlowLogFile));
            const flowLogContents: string = await fs.promises.readFile(expectedFlowLogFile, 'utf-8');
            expect(flowLogContents).toContain('DEBUG'); // Sanity check that we are using --debug log level
        });
    });

    describe('Unit tests', () => {
        describe('#describeRules()', () => {
            describe('Rule description parsing', () => {
                it('Consolidates well-formed Flow Scanner rule descriptors into Code Analyzer rule descriptors', async () => {
                    const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules(createDescribeOptions(tempFolder));

                    expect(ruleDescriptors).toHaveLength(2);
                    expect(ruleDescriptors[0]).toEqual({
                        name: 'PreventPassingUserDataIntoElementWithoutSharing',
                        severityLevel: SeverityLevel.High,
                        tags: ['Recommended', 'Security', 'XML'],
                        description: 'Avoid passing user data into Flow Scanner elements in run mode: Without Sharing',
                        resourceUrls: []
                    });
                    expect(ruleDescriptors[1]).toEqual({
                        name: 'PreventPassingUserDataIntoElementWithSharing',
                        severityLevel: SeverityLevel.Low,
                        tags: ['Recommended', 'Security', 'XML'],
                        description: 'Avoid passing user data into Flow Scanner elements in run mode: With Sharing',
                        resourceUrls: []
                    });
                });
            });

            describe('Workspace processing', () => {
                it.each([
                    {desc: 'is undefined', workspace: undefined},
                    {
                        desc: 'contains *.flow-meta.xml files only',
                        workspace: new Workspace('id', [PATH_TO_EXAMPLE1])
                    },
                    {
                        desc: 'contains *.flow files only',
                        workspace: new Workspace('id', [PATH_TO_EXAMPLE2])
                    },
                    {
                        desc: 'contains *.flow-meta.xml and *.flow files',
                        workspace: new Workspace('id', [PATH_TO_MULTIPLE_FLOWS_WORKSPACE])
                    },
                ])('When workspace $desc, rules are returned', async ({workspace}) => {
                    const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules(createDescribeOptions(tempFolder, workspace));

                    expect(ruleDescriptors).toHaveLength(2);
                });

                it.each([
                    {
                        desc: 'is folder that contains no flow files',
                        workspace: new Workspace('id', [PATH_TO_NO_FLOWS_WORKSPACE])
                    },
                    {
                        desc: 'is file that is not a flow file but lives in a folder with flow files',
                        workspace: new Workspace('id', [path.resolve(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'shouldNotGetPickedUpByFlowScanner.xml')])
                    },
                ])('When workspace $desc, no rules are returned', async ({workspace}) => {
                    const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                    const ruleDescriptors: RuleDescription[] = await engine.describeRules(createDescribeOptions(tempFolder, workspace));

                    expect(ruleDescriptors).toHaveLength(0);
                });
            });
        });

        describe('#runRules', () => {

            const expectedExample1Violation1: Violation = {
                ruleName: "PreventPassingUserDataIntoElementWithoutSharing",
                message: "User controlled data flows into recordUpdates element data in run mode: SystemModeWithoutSharing",
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences update_to_new_subject.update_to_new_subject: flow into recordUpdates via influence over update_to_new_subject in run mode SystemModeWithoutSharing",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 102
                    }
                ],
                primaryLocationIndex: 2,
                resourceUrls: []
            };

            const expectedExample1Violation2: Violation = {
                ruleName: "PreventPassingUserDataIntoElementWithoutSharing",
                message: "User controlled data flows into recordDeletes element selector in run mode: SystemModeWithoutSharing",
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences delete_created_case.delete_created_case: flow into recordDeletes via influence over delete_created_case in run mode SystemModeWithoutSharing",
                        file: PATH_TO_EXAMPLE1,
                        startColumn: 1,
                        startLine: 69
                    }
                ],
                primaryLocationIndex: 2,
                resourceUrls: []
            };

            const expectedExample2Violation1: Violation = {
                ruleName: "PreventPassingUserDataIntoElementWithSharing",
                message: "User controlled data flows into recordUpdates element data in run mode: SystemModeWithSharing",
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences update_to_new_subject.update_to_new_subject: flow into recordUpdates via influence over update_to_new_subject in run mode SystemModeWithSharing",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 102
                    }
                ],
                primaryLocationIndex: 2,
                resourceUrls: []
            };

            const expectedExample2Violation2: Violation = {
                ruleName: "PreventPassingUserDataIntoElementWithSharing",
                message: "User controlled data flows into recordDeletes element selector in run mode: SystemModeWithSharing",
                codeLocations: [
                    {
                        comment: "change_subject_of_case.change_subject_of_case: Initialization",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 124
                    },
                    {
                        comment: "change_subject_of_case.change_subject_of_case influences change_subj_assignment.another_case_holder.Subject: Variable Assignment",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 26
                    },
                    {
                        comment: "change_subj_assignment.another_case_holder.Subject influences delete_created_case.delete_created_case: flow into recordDeletes via influence over delete_created_case in run mode SystemModeWithSharing",
                        file: PATH_TO_EXAMPLE2,
                        startColumn: 1,
                        startLine: 69
                    }
                ],
                primaryLocationIndex: 2,
                resourceUrls: []
            };

            function createSharedExample4Violation(inputAssignmentField: string): Violation {
                return {
                    ruleName: "PreventPassingUserDataIntoElementWithoutSharing",
                    message: "User controlled data flows into recordCreates element data in run mode: SystemModeWithoutSharing",
                    codeLocations: [
                    {
                        file: PATH_TO_EXAMPLE4_PARENTFLOW,
                        startLine: 91,
                        startColumn: 1,
                        comment: "input_text.input_text: Initialization"
                    },
                    {
                        file: PATH_TO_EXAMPLE4_PARENTFLOW,
                        startLine: 10,
                        startColumn: 1,
                        comment: "input_text.input_text influences assign_input_to_var.parent_input_var: Variable Assignment"
                    },
                    {
                        file: PATH_TO_EXAMPLE4_SUBFLOW,
                        startLine: 109,
                        startColumn: 1,
                        comment: "assign_input_to_var.parent_input_var influences call_subflow.input_var1: output via subflow assignment"
                    },
                    {
                        file: PATH_TO_EXAMPLE4_SUBFLOW,
                        startLine: 46,
                        startColumn: 1,
                        comment: `call_subflow.input_var1 influences create_case.${inputAssignmentField}: flow into recordCreates via influence over ${inputAssignmentField} in run mode SystemModeWithoutSharing`
                    }
                ],
                    primaryLocationIndex: 3,
                    resourceUrls: []
                };
            }

            const expectedExample4Violation1: Violation = createSharedExample4Violation('AccountId');

            const expectedExample4Violation2: Violation = createSharedExample4Violation('SuppliedName');

            const expectedExample4Violation3: Violation = {
                ruleName: "PreventPassingUserDataIntoElementWithoutSharing",
                message: "User controlled data flows into recordLookups element selector in run mode: SystemModeWithoutSharing",
                codeLocations: [
                    {
                        file: PATH_TO_EXAMPLE4_SUBFLOW,
                        startLine: 82,
                        startColumn: 1,
                        comment: "enter_text_subflow.enter_text_subflow: Initialization"
                    },
                    {
                        file: PATH_TO_EXAMPLE4_SUBFLOW,
                        startLine: 19,
                        startColumn: 1,
                        comment: "enter_text_subflow.enter_text_subflow influences combine_vars.combine_vars: Parsed from formulas"
                    },
                    {
                    file: PATH_TO_EXAMPLE4_SUBFLOW,
                        startLine: 10,
                        startColumn: 1,
                        comment: "combine_vars.combine_vars influences assign_enter_to_output.output_var1: Variable Assignment"
                    },
                    {
                        file: PATH_TO_EXAMPLE4_PARENTFLOW,
                        startLine: 109,
                        startColumn: 1,
                        comment: "assign_enter_to_output.output_var1 influences call_subflow.call_subflow.output_var1: output via subflow assignment"
                    },
                    {
                        file: PATH_TO_EXAMPLE4_PARENTFLOW,
                        startLine: 42,
                        startColumn: 1,
                        comment: "call_subflow.call_subflow.output_var1 influences get_records.SuppliedName: flow into recordLookups via influence over SuppliedName in run mode SystemModeWithoutSharing"
                    }
                ],
                primaryLocationIndex: 4,
                resourceUrls: []
            };

            let engine: FlowScannerEngine;
            beforeEach(() => {
                engine = new FlowScannerEngine(flowScannerCommandWrapper);
            });

            afterEach(() => {
                jest.restoreAllMocks();
            });

            it('When running both rules on workspace that contains violations for SystemModeWithoutSharing and SystemModeWithSharing, then results are as expected', async () => {
                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];
                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(
                    tempFolder, new Workspace('id', [PATH_TO_MULTIPLE_FLOWS_WORKSPACE])));

                expect(engineResults.violations).toHaveLength(7);
                expect(engineResults.violations).toContainEqual(expectedExample1Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample1Violation2);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation2);
                expect(engineResults.violations).toContainEqual(expectedExample4Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample4Violation2);
                expect(engineResults.violations).toContainEqual(expectedExample4Violation3);
            });

            it('When running only one rule on workspace that targets files that contain violations for multiple rules, then results should only contain results for the selected rule', async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = ['PreventPassingUserDataIntoElementWithSharing'];
                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(
                    tempFolder, new Workspace('id', [path.resolve(__dirname, 'test-data', 'example workspaces')],
                        [PATH_TO_MULTIPLE_FLOWS_WORKSPACE])));

                expect(engineResults.violations).toHaveLength(2);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation2);
            });

            it('When workspace includes only some files from within a folder, then filters out results for files outside of workspace', async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(
                    tempFolder, new Workspace('id', [PATH_TO_EXAMPLE2])));

                expect(engineResults.violations).toHaveLength(2);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation1);
                expect(engineResults.violations).toContainEqual(expectedExample2Violation2);
            });

            it('When workspace does not contain flow files, then return zero violations', async () => {
                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];
                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(
                    tempFolder, new Workspace('id', [PATH_TO_NO_FLOWS_WORKSPACE])));

                expect(engineResults.violations).toHaveLength(0);
            });

            it('When workspace contains flow files that have no violations but is in folder with other flow files that do have violations, then return valid results with zero violations', async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(
                    tempFolder, new Workspace('id', [PATH_TO_EXAMPLE3])));

                expect(engineResults.violations).toHaveLength(0);
            });

            it('When workspace contains a flow file that has no violations and no other flow files are in the folder, then return valid results with zero violations', async () => {
                // Note that this test is needed because the implementation today currently runs on the
                // workspace root, and then we filter out the results based on the workspace files. Without this test
                // we might miss the flow utility returning results: null.
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(
                    tempFolder, new Workspace('id', [PATH_TO_ONE_FLOW_NO_VIOLATIONS_WORKSPACE])));

                expect(engineResults.violations).toHaveLength(0);
            });

            it.each([
                new Workspace('id', [path.resolve(__dirname, 'test-data', 'example workspaces','contains-parent-without-subflow')]),
                new Workspace('id', [path.resolve(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example4_parentFlow.flow-meta.xml')])
            ])('When workspace contains a parent flow but not its child subflow, then return valid results with zero violations', async (workspace) => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults1: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(tempFolder, workspace));
                expect(engineResults1.violations).toHaveLength(0);
            });

            it.each([
                new Workspace('id', [path.resolve(__dirname, 'test-data', 'example workspaces','contains-subflow-without-parent')]),
                new Workspace('id', [path.resolve(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example4_subflow.flow-meta.xml')])
            ])('When workspace contains a child subflow but not its parent flow, then return valid results with zero violations', async (workspace) => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    'PreventPassingUserDataIntoElementWithSharing',
                    'PreventPassingUserDataIntoElementWithoutSharing'
                ];

                const engineResults1: EngineRunResults = await engine.runRules(selectedRuleNames, createRunOptions(tempFolder, workspace));
                expect(engineResults1.violations).toHaveLength(0);
            });

            it("When no targeted files have violations but non-targeted files do, then no violations are returned.", async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    "PreventPassingUserDataIntoElementWithSharing",
                    "PreventPassingUserDataIntoElementWithoutSharing"
                ];

                const engineResults: EngineRunResults = await engine.runRules(
                    selectedRuleNames,
                    createRunOptions(tempFolder, new Workspace("id", [PATH_TO_MULTIPLE_FLOWS_WORKSPACE], [PATH_TO_EXAMPLE3]))
                );

                expect(engineResults.violations).toHaveLength(0);
            });

            it("When only non-flow files are targeted in a workspace with violations, then no violations are returned.", async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    "PreventPassingUserDataIntoElementWithSharing",
                    "PreventPassingUserDataIntoElementWithoutSharing"
                ];

                const engineResults: EngineRunResults = await engine.runRules(
                    selectedRuleNames,
                    createRunOptions(tempFolder, new Workspace("id", [PATH_TO_MULTIPLE_FLOWS_WORKSPACE], [PATH_TO_EXAMPLE5]))
                );

                expect(engineResults.violations).toHaveLength(0);
            });

            it("When both targeted files and non-targeted files have violations, then only the violations for the targeted files are returned.", async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    "PreventPassingUserDataIntoElementWithSharing",
                    "PreventPassingUserDataIntoElementWithoutSharing"
                ];

                const engineResults: EngineRunResults = await engine.runRules(
                    selectedRuleNames,
                    createRunOptions(tempFolder, new Workspace("id", [PATH_TO_MULTIPLE_FLOWS_WORKSPACE], [PATH_TO_EXAMPLE1]))
                );

                expect(engineResults.violations).toHaveLength(2);
            });

            it("When all files in a workspace are targeted and have violations, all of the violations are returned.", async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);

                const selectedRuleNames: string[] = [
                    "PreventPassingUserDataIntoElementWithSharing",
                    "PreventPassingUserDataIntoElementWithoutSharing"
                ];

                const engineResults: EngineRunResults = await engine.runRules(
                    selectedRuleNames,
                    createRunOptions(tempFolder, new Workspace("id", [PATH_TO_EXAMPLE1], [PATH_TO_EXAMPLE1]))
                );

                expect(engineResults.violations).toHaveLength(2);
            });

            // TODO: Add in tests for case of scanning 2 folders with the exact same flows.
            // Currently there is a bug here, and so we are waiting on:
            //    https://git.soma.salesforce.com/SecurityTools/FlowSecurityLinter/issues/62
        });

        describe('#getEngineVersion', () => {
            it('Returns something resembling a Semantic Version', async () => {
                const engine: FlowScannerEngine = new FlowScannerEngine(flowScannerCommandWrapper);
                const version: string = await engine.getEngineVersion();

                expect(version).toMatch(/\d+\.\d+\.\d+.*/);
            });
        });
    });
});

function createDescribeOptions(logFolder: string, workspace?: Workspace): DescribeOptions {
    return {
        logFolder: logFolder,
        workspace: workspace
    }
}

function createRunOptions(logFolder: string, workspace: Workspace): RunOptions {
    return {
        logFolder: logFolder,
        workspace: workspace
    }
}
