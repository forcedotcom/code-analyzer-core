import {
    CodeAnalyzer,
    CodeAnalyzerConfig,
    EngineLogEvent,
    EngineTelemetryEvent,
    EventType,
    LogEvent,
    LogLevel,
    Rule,
    RuleSelection,
    RuleSelectionProgressEvent,
    SelectOptions,
    SeverityLevel
} from "../src";
import * as engApi from "@salesforce/code-analyzer-engine-api"
import {Clock, FixedClock} from "@salesforce/code-analyzer-engine-api/utils";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot, FakeFileSystem, FixedUniqueIdGenerator} from "./test-helpers";
import {getMessage} from "../src/messages";
import * as stubs from "./stubs";
import os from "node:os";

changeWorkingDirectoryToPackageRoot();

describe('Tests for selecting rules', () => {
    let fileSystem: FakeFileSystem;
    let codeAnalyzer: CodeAnalyzer;
    let plugin: stubs.StubEnginePlugin;
    let sampleTimestamp: Date;
    let clock: Clock;

    function createCodeAnalyzer(config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults()): CodeAnalyzer {
        fileSystem = new FakeFileSystem();
        codeAnalyzer = new CodeAnalyzer(config, fileSystem);
        sampleTimestamp = new Date();
        clock = new FixedClock(sampleTimestamp);
        codeAnalyzer._setClock(clock);
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
        return codeAnalyzer;
    }

    async function setupCodeAnalyzerWithStubPlugin(config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults()): Promise<void> {
        codeAnalyzer = createCodeAnalyzer(config);
        plugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(plugin);
    }

    beforeEach(async () => {
        await setupCodeAnalyzerWithStubPlugin();
    })

    it('When no rule selectors are provided then the Recommended tag is used', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules([]);
        expect(selection).toEqual(await codeAnalyzer.selectRules(['Recommended']));

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2', 'stubEngine3']);
        expect(selection.getCount()).toEqual(6);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine3')).toEqual(['stub3RuleA']);

        // Sanity check one of the rules in detail:
        const selectedRulesForStubEngine1: Rule[] = selection.getRulesFor('stubEngine1');
        const stub1RuleB = selectedRulesForStubEngine1[1];
        expect(stub1RuleB.getEngineName()).toEqual('stubEngine1');
        expect(stub1RuleB.getDescription()).toEqual('Some description for stub1RuleB');
        expect(stub1RuleB.getName()).toEqual('stub1RuleB');
        expect(stub1RuleB.getResourceUrls()).toEqual(['https://example.com/stub1RuleB']);
        expect(stub1RuleB.getSeverityLevel()).toEqual(SeverityLevel.High);
        expect(stub1RuleB.getTags()).toEqual(['Recommended', 'Security']);

        // Sanity check we can directly get one of the rules from the selection
        expect(selection.getRule('stubEngine1', 'stub1RuleB')).toEqual(stub1RuleB);
    });

    it('When all is provide then all is returned', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['all']);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2', 'stubEngine3']);
        expect(selection.getCount()).toEqual(9);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleB', 'stub2RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine3')).toEqual(['stub3RuleA']);
    })

    it('When test selector is an individual rule name then only that rule is selected', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['stub2RuleB'])

        expect(selection.getEngineNames()).toEqual(['stubEngine2']);
        expect(selection.getCount()).toEqual(1);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual([]);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleB']);
    });

    it('When test selector is tag then all rules with that tag are selected', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['CodeStyle'])

        expect(selection.getEngineNames()).toEqual(['stubEngine1']);
        expect(selection.getCount()).toEqual(2);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When test selector is an engine name then all rules from that engine are selected', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['stubEngine1'])

        expect(selection.getEngineNames()).toEqual(['stubEngine1']);
        expect(selection.getCount()).toEqual(5);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD', 'stub1RuleE']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When test selector a severity level then all rules with that severity are selected', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['3'])

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2','stubEngine3']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC', 'stub1RuleE']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA']);
        expect(ruleNamesFor(selection, 'stubEngine3')).toEqual(['stub3RuleA']);
    });

    it('When using a colon with a rule selector, then it acts like an intersection of two selectors', async () => {
        const selection1: RuleSelection = await codeAnalyzer.selectRules(['stubEngine1:4'])
        expect(ruleNamesFor(selection1,'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleD'])
        expect(ruleNamesFor(selection1,'stubEngine2')).toEqual([])

        const selection2: RuleSelection = await codeAnalyzer.selectRules(['stubEngine2:Recommended'])
        expect(ruleNamesFor(selection2,'stubEngine1')).toEqual([])
        expect(ruleNamesFor(selection2,'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleC'])

        const selection3: RuleSelection = await codeAnalyzer.selectRules(['all:stub1RuleC'])
        expect(ruleNamesFor(selection3,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection3,'stubEngine2')).toEqual([])

        const selection4: RuleSelection = await codeAnalyzer.selectRules(['Recommended:2'])
        expect(ruleNamesFor(selection4,'stubEngine1')).toEqual(['stub1RuleB'])
        expect(ruleNamesFor(selection4,'stubEngine2')).toEqual(['stub2RuleC'])

        const selection5: RuleSelection = await codeAnalyzer.selectRules(['Custom:Performance'])
        expect(ruleNamesFor(selection5,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection5,'stubEngine2')).toEqual(['stub2RuleB'])

        const selection6: RuleSelection = await codeAnalyzer.selectRules(['Custom:Performance:3'])
        expect(ruleNamesFor(selection6,'stubEngine1')).toEqual(['stub1RuleC'])
        expect(ruleNamesFor(selection6,'stubEngine2')).toEqual([])

        const selection7: RuleSelection = await codeAnalyzer.selectRules(['Performance:2'])
        expect(ruleNamesFor(selection7,'stubEngine1')).toEqual([])
        expect(ruleNamesFor(selection7,'stubEngine2')).toEqual([])
    });

    it.each([
        {
            case: 'multiple selectors are provided',
            selectors: [
                'Security', // a tag
                'stubEngine2', // an engine name
                'stub1RuleD' // a rule name
            ]
        },
        {
            case: 'using a comma to join two rule selectors',
            selectors: ['Security,stubEngine2,stub1RuleD']
        }
    ])('When $case, then it acts like a union', async ({selectors}) => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(selectors);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleB', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleB', 'stub2RuleC']);

        // Sanity check against duplicates
        expect(await codeAnalyzer.selectRules(['all', 'Performance', 'DoesNotExist'])).toEqual(await codeAnalyzer.selectRules(['all']));
    });

    it.each([
        {
            selector: 'Recommended:Performance,2', // Equivalent to "(Recommended:Performance),2"
            engines: ['stubEngine1', 'stubEngine2'],
            stubEngine1Rules: ['stub1RuleB', 'stub1RuleC'],
            stubEngine2Rules: ['stub2RuleC'],
            stubEngine3Rules: []
        },
        {
            selector: '2,Recommended:Performance', // Equivalent to "2,(Recommended:Performance),2"
            engines: ['stubEngine1', 'stubEngine2'],
            stubEngine1Rules: ['stub1RuleB', 'stub1RuleC'],
            stubEngine2Rules: ['stub2RuleC'],
            stubEngine3Rules: []
        },
        {
            selector: 'Recommended,3:Performance', // Equivalent to "Recommended,(3:Performance)"
            engines: ['stubEngine1', 'stubEngine2', 'stubEngine3'],
            stubEngine1Rules: ['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleE'],
            stubEngine2Rules: ['stub2RuleA', 'stub2RuleC'],
            stubEngine3Rules: ['stub3RuleA']
        },
        {
            selector: '3:Performance,Recommended', // Equivalent to "(3:Performance),Recommended"
            engines: ['stubEngine1', 'stubEngine2', 'stubEngine3'],
            stubEngine1Rules: ['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleE'],
            stubEngine2Rules: ['stub2RuleA', 'stub2RuleC'],
            stubEngine3Rules: ['stub3RuleA']
        }
    ])('In the absence of parenthesis-defined ordering, commas are applied after colons. Case: $selector', async ({selector, engines, stubEngine1Rules, stubEngine2Rules, stubEngine3Rules}) => {
        const selection: RuleSelection = await codeAnalyzer.selectRules([selector]);

        expect(selection.getEngineNames()).toEqual(engines);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(stubEngine1Rules);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(stubEngine2Rules);
        expect(ruleNamesFor(selection, 'stubEngine3')).toEqual(stubEngine3Rules);
    });

    it.each([
        {
            case: 'colons are used and multiple selectors are provided',
            selectors: ['Recommended:Performance', 'stubEngine2:2', 'stubEngine2:DoesNotExist']
        },
        {
            case: 'colons and commas are nested via parentheses',
            selectors: ['(Recommended:Performance),(stubEngine2:2),(stubEngine2:DoesNotExist)']
        }
    ])('When $case, then we get correct union and intersection behavior', async ({selectors}) => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(selectors);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
    });

    it('Parentheses cannot be empty', async () => {
        await expect(codeAnalyzer.selectRules(['()'])).rejects.toThrow('empty');
    });

    it('Redundant parentheses are accepted', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['((((((((stub1RuleC))))))))']);

        expect(selection.getEngineNames()).toEqual(['stubEngine1']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC']);
    })

    it.each([
        {selector: 'a,b)'},
        {selector: '(a,b'},
        {selector: '((a,b)'},
        {selector: '(a),b)'},
        {selector: ')a,b)'},
        {selector: 'a,b('}
    ])('When parentheses are unbalanced, an error is thrown. Case: $selector', async ({selector}) => {
        await expect(codeAnalyzer.selectRules([selector])).rejects.toThrow('looks incorrect');
    });

    it.each([
        {selector: '2(a,b)'},
        {selector: '(a,b)2'},
        {selector: '2(a:b)'},
        {selector: '(a:b)2'}
    ])('When parentheses are not accompanied by valid joiners, an error is thrown. Case: $selector', async ({selector}) => {
        await expect(codeAnalyzer.selectRules([selector])).rejects.toThrow('looks incorrect');
    });


    it('When selecting rules based on severity names instead of severity number, then we correctly return the rules', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['High', 'Recommended:Low']);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA','stub1RuleB']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
    });

    it('When selector is the wrong case, then we still accept the selector since we treat selection with case insensitivity', async () => {
        const selection1: RuleSelection = await codeAnalyzer.selectRules(['RecOmmended:higH', 'perFORMance']);

        expect(selection1.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection1, 'stubEngine1')).toEqual(['stub1RuleB','stub1RuleC','stub1RuleE']);
        expect(ruleNamesFor(selection1, 'stubEngine2')).toEqual(['stub2RuleB','stub2RuleC']);

        expect(await codeAnalyzer.selectRules(['Stub1RulEd'])).toEqual(await codeAnalyzer.selectRules(['stub1RuleD']));
        expect(await codeAnalyzer.selectRules(['aLL'])).toEqual(await codeAnalyzer.selectRules(['all']));
    });

    it('When config contains rule overrides for the selected rules, then the rule selection contains these overrides', async () => {
        await setupCodeAnalyzerWithStubPlugin(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));

        const selection: RuleSelection = await codeAnalyzer.selectRules([]);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2', 'stubEngine3']);
        expect(selection.getCount()).toEqual(6);

        // sample-config-01.yaml makes stub1RuleD is now Recommended and stub2RuleA no longer Recommended
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleA', 'stub1RuleB', 'stub1RuleC', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine3')).toEqual(['stub3RuleA']);

        // sample-config-01.yaml stub1RuleB have changed severity
        const selectedRulesForStubEngine1: Rule[] = selection.getRulesFor('stubEngine1');
        const stub1RuleB = selectedRulesForStubEngine1[1];
        expect(stub1RuleB.getEngineName()).toEqual('stubEngine1');
        expect(stub1RuleB.getName()).toEqual('stub1RuleB');
        expect(stub1RuleB.getResourceUrls()).toEqual(['https://example.com/stub1RuleB']);
        expect(stub1RuleB.getSeverityLevel()).toEqual(SeverityLevel.Critical); // This changed
        expect(stub1RuleB.getTags()).toEqual(['Recommended', 'Security']);
    });

    it('When config contains rule overrides, then we can select based on the new tags', async () => {
        await setupCodeAnalyzerWithStubPlugin(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));

        const selection: RuleSelection = await codeAnalyzer.selectRules(['SomeNewTag']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual([]);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA']);

        // sample-config-01.yaml stub2RuleA have changed tags
        const selectedRulesForStubEngine2: Rule[] = selection.getRulesFor('stubEngine2');
        const stub2RuleA = selectedRulesForStubEngine2[0];
        expect(stub2RuleA.getEngineName()).toEqual('stubEngine2');
        expect(stub2RuleA.getName()).toEqual('stub2RuleA');
        expect(stub2RuleA.getResourceUrls()).toEqual(['https://example.com/stub2RuleA']);
        expect(stub2RuleA.getSeverityLevel()).toEqual(SeverityLevel.Moderate);
        expect(stub2RuleA.getTags()).toEqual(['Security', 'SomeNewTag']); // This changed
    });

    it('When config contains severity overrides, then we can select based on the severity values', async () => {
        await setupCodeAnalyzerWithStubPlugin(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));

        const selection: RuleSelection = await codeAnalyzer.selectRules(['5']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When an engine fails to return its rules, an error is logged and empty results are returned', async () => {
        // ====== TEST SETUP ======
        codeAnalyzer = createCodeAnalyzer();
        await codeAnalyzer.addEnginePlugin(new stubs.ThrowingEnginePlugin2());
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        // ====== TESTED BEHAVIOR ======
        const selection: RuleSelection = await codeAnalyzer.selectRules([]);

        // ====== ASSERTIONS ======
        expect(selection.getCount()).toEqual(0);
        const errorEvents: LogEvent[] = logEvents.filter(e => e.logLevel === LogLevel.Error);
        expect(errorEvents).toHaveLength(1);
        expect(errorEvents[0].message).toEqual(getMessage('PluginErrorWhenGettingRules', 'someEngine', 'SomeErrorFromDescribeRules') + '\n\n' +
            getMessage('InstructionsToIgnoreErrorAndDisableEngine', 'someEngine'));
    })

    it('When attempting to get a rule that does not exist in the selection, then error', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules([]);

        expect(() => selection.getRule('stubEngine1', 'doesNotExist')).toThrow(
            getMessage('RuleDoesNotExistInSelection', 'doesNotExist', 'stubEngine1'));
        expect(() => selection.getRule('oopsEngine', 'stub1RuleD')).toThrow(
            getMessage('RuleDoesNotExistInSelection', 'stub1RuleD', 'oopsEngine'));
    });

    it('When an engine returns multiple rules with the same name, then error', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.RepeatedRuleNameEnginePlugin());
        await expect(codeAnalyzer.selectRules([])).rejects.toThrow(
            getMessage('EngineReturnedMultipleRulesWithSameName', 'repeatedRuleNameEngine', 'repeatedRule'));
    });

    it('When selectRules is not provided with SelectOptions, then workspace should be undefined for all engines', async () => {
        await codeAnalyzer.selectRules(['all']);

        const expectedWorkingFolder1: string = path.join(os.tmpdir(), 'code-analyzer-0',
            'rules-' + clock.formatToDateTimeString(), 'stubEngine1');
        const expectedStub1DescribeOptions: engApi.DescribeOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workingFolder: expectedWorkingFolder1,
            workspace: undefined
        };
        const stubEngine1: stubs.StubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        expect(stubEngine1.describeRulesCallHistory).toEqual([{describeOptions: expectedStub1DescribeOptions}]);

        const expectedWorkingFolder2: string = path.join(os.tmpdir(), 'code-analyzer-0',
            'rules-' + clock.formatToDateTimeString(), 'stubEngine2');
        const expectedStub2DescribeOptions: engApi.DescribeOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workingFolder: expectedWorkingFolder2,
            workspace: undefined
        };
        const stubEngine2: stubs.StubEngine2 = plugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        expect(stubEngine2.describeRulesCallHistory).toEqual([{describeOptions: expectedStub2DescribeOptions}]);
    });

    it('When selectRules is provided with SelectOptions, then they are forwarded to the engines', async () => {
        const selectOptions: SelectOptions = {
            workspace: await codeAnalyzer.createWorkspace([path.resolve('src'), path.resolve('test')])
        }
        await codeAnalyzer.selectRules(['all'], selectOptions);

        const expectedDescribeOptions: Partial<engApi.DescribeOptions> = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: new engApi.Workspace('FixedId', [path.resolve('src'), path.resolve('test')])
        };
        const stubEngine1: stubs.StubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        expect(stubEngine1.describeRulesCallHistory).toHaveLength(1);
        expect(stubEngine1.describeRulesCallHistory[0].describeOptions.logFolder).toEqual(expectedDescribeOptions.logFolder);
        expect(stubEngine1.describeRulesCallHistory[0].describeOptions.workspace!.getWorkspaceId()).toEqual('FixedId');
        const stubEngine2: stubs.StubEngine2 = plugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        expect(stubEngine2.describeRulesCallHistory).toHaveLength(1);
        expect(stubEngine2.describeRulesCallHistory[0].describeOptions.logFolder).toEqual(expectedDescribeOptions.logFolder);
        expect(stubEngine2.describeRulesCallHistory[0].describeOptions.workspace!.getWorkspaceId()).toEqual('FixedId');

    });

    it("When selecting rules, then the log events should include the start and end of each engine's rule gathering", async () => {
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        await codeAnalyzer.selectRules([]);

        expect(logEvents.length).toBeGreaterThanOrEqual(4);
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('GatheringRulesFromEngine', 'stubEngine1'),
            timestamp: sampleTimestamp
        });
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('GatheringRulesFromEngine', 'stubEngine2'),
            timestamp: sampleTimestamp
        });
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('FinishedGatheringRulesFromEngine', 5, 'stubEngine1'),
            timestamp: sampleTimestamp
        });
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            message: getMessage('FinishedGatheringRulesFromEngine', 3, 'stubEngine2'),
            timestamp: sampleTimestamp
        });
    });

    it("When selecting rules, then the engine progress events should aggregated and emitted as RuleSelectionProgressEvent", async () => {
        const ruleSelectionProgressEvents: RuleSelectionProgressEvent[] = [];
        codeAnalyzer.onEvent(EventType.RuleSelectionProgressEvent,
            (event: RuleSelectionProgressEvent) => ruleSelectionProgressEvents.push(event));
        await codeAnalyzer.selectRules([]);

        expect(ruleSelectionProgressEvents).toHaveLength(11);
        const expectedPercentages: number[] = [
            0, // initial progress always reported
            6.666666666666667, // average of 20 from engine1, 0 from engine2, 0 from engine3
            26.666666666666668, // average of 80 from engine1, 0 from engine2, 0 from engine3
            36.666666666666664, // average of 80 from engine1, 30 from engine2, 0 from engine3
            56.666666666666664, // average of 80 from engine1, 90 from engine2, 0 from engine3
            73.33333333333333, // average of 80 from engine1, 90 from engine2, 50 from engine3
            85, // average of 80 from engine1, 90 from engine 2, 85 from engine3
            91.66666666666667, // average of 100 from engine1, 90 from engine 2, 85 from engine3
            95, // average of 100 from engine1, 100 from engine 2, 85 from engine3
            100 // final progress always reported (just in case there are no engines, we don't want to get stuck on 0)
        ]
        for (const [i, expectedPercentComplete] of expectedPercentages.entries()) {
            expect(ruleSelectionProgressEvents[i]).toEqual({
                type: EventType.RuleSelectionProgressEvent,
                timestamp: sampleTimestamp,
                percentComplete: expectedPercentComplete
            });
        }
    });

    it("When selecting rules, then engine-specific log events are wired up and emitted correctly", async () => {
        const engineLogEvents: EngineLogEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineLogEvent, (event: EngineLogEvent) => engineLogEvents.push(event));
        await codeAnalyzer.selectRules([]);

        expect(engineLogEvents).toHaveLength(3);
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine1",
            logLevel: LogLevel.Warn,
            message: "someMiscWarnMessageFromStubEngine1"
        });
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine2",
            logLevel: LogLevel.Error,
            message: "someMiscErrorMessageFromStubEngine2"
        });
        expect(engineLogEvents).toContainEqual({
            type: EventType.EngineLogEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine3",
            logLevel: LogLevel.Error,
            message: "someMiscErrorMessageFromStubEngine3"
        });
    });

    it("When selecting rules, then engine-level telemetry events are wired up and emitted correctly from the engines", async () => {
        const engineTelemetryEvents: EngineTelemetryEvent[] = [];
        codeAnalyzer.onEvent(EventType.EngineTelemetryEvent, (event: EngineTelemetryEvent) => engineTelemetryEvents.push(event));
        await codeAnalyzer.selectRules([]);

        expect(engineTelemetryEvents).toHaveLength(2);
        expect(engineTelemetryEvents).toContainEqual({
            type: EventType.EngineTelemetryEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine1",
            eventName: 'Engine1DescribeKey',
            uuid: "FixedUUID",
            data: {
                someProperty: 4,
                someOtherProperty: 'klmno',
                someThirdProperty: true
            }
        });
        expect(engineTelemetryEvents).toContainEqual({
            type: EventType.EngineTelemetryEvent,
            timestamp: sampleTimestamp,
            engineName: "stubEngine2",
            eventName: 'Engine2DescribeKey',
            uuid: "FixedUUID",
            data: {
                someProperty: 5,
                someOtherProperty: 'pqrst',
                someThirdProperty: false
            }
        });
    });

    it("When selecting rules, and one or more engines emit an error log, then their working folders are kept (and logged), but others are still removed", async () => {
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));

        await codeAnalyzer.selectRules(['all']);

        const expectedRulesWorkingFolderRoot: string = path.join(os.tmpdir(),'code-analyzer-0','rules-' + clock.formatToDateTimeString());
        const expectedRulesWorkingFolderForStubEngine1: string = path.join(expectedRulesWorkingFolderRoot, 'stubEngine1');
        const expectedRulesWorkingFolderForStubEngine2: string = path.join(expectedRulesWorkingFolderRoot, 'stubEngine2');
        const expectedRulesWorkingFolderForStubEngine3: string = path.join(expectedRulesWorkingFolderRoot, 'stubEngine3');

        // First confirm that the root folder and all 3 engine rule working folders were created
        const createdFolders: string[] = fileSystem.mkdirCallHistory.map(args => args.absPath.toString());
        expect(createdFolders).toContain(expectedRulesWorkingFolderRoot);
        expect(createdFolders).toContain(expectedRulesWorkingFolderForStubEngine1);
        expect(createdFolders).toContain(expectedRulesWorkingFolderForStubEngine2);
        expect(createdFolders).toContain(expectedRulesWorkingFolderForStubEngine3);

        // Next confirm that the root folder and 2 of the engine working folders were kept while 1 was removed (because all issued errors except for stubEngine1)
        const removedFolders: string[] = fileSystem.rmCallHistory.map(args => args.absPath.toString());
        expect(removedFolders).not.toContain(expectedRulesWorkingFolderRoot);
        expect(removedFolders).toContain(expectedRulesWorkingFolderForStubEngine1);
        expect(removedFolders).not.toContain(expectedRulesWorkingFolderForStubEngine2);
        expect(removedFolders).not.toContain(expectedRulesWorkingFolderForStubEngine3);

        // Verify end result
        expect(fileSystem.files).toContain(expectedRulesWorkingFolderRoot);
        expect(fileSystem.files).not.toContain(expectedRulesWorkingFolderForStubEngine1);
        expect(fileSystem.files).toContain(expectedRulesWorkingFolderForStubEngine2);
        expect(fileSystem.files).toContain(expectedRulesWorkingFolderForStubEngine3);

        // Verify log lines
        const relevantLogMsgs: string[] = logEvents.filter(e => e.logLevel === LogLevel.Debug &&
            e.message.includes('the following temporary working folder will not be removed')).map(e => e.message);
        expect(relevantLogMsgs.filter(m => m.endsWith(expectedRulesWorkingFolderForStubEngine1))).toHaveLength(0);
        expect(relevantLogMsgs.filter(m => m.endsWith(expectedRulesWorkingFolderForStubEngine2))).toHaveLength(1);
        expect(relevantLogMsgs.filter(m => m.endsWith(expectedRulesWorkingFolderForStubEngine2))).toHaveLength(1);
    });

    it("When selecting rules, if no engine errors, then we fully remove the rules working folder", async () => {
        codeAnalyzer = createCodeAnalyzer();
        await codeAnalyzer.addEnginePlugin(new stubs.EmptyTagEnginePlugin());

        await codeAnalyzer.selectRules(['all']);

        const expectedRulesWorkingFolderRoot: string = path.join(os.tmpdir(),'code-analyzer-0','rules-' + clock.formatToDateTimeString());
        const expectedRulesWorkingFolderForEngine: string = path.join(expectedRulesWorkingFolderRoot, 'emptyTags');

        // First confirm that the root folder and the engine folder were created
        const createdFolders: string[] = fileSystem.mkdirCallHistory.map(args => args.absPath.toString());
        expect(createdFolders).toContain(expectedRulesWorkingFolderRoot);
        expect(createdFolders).toContain(expectedRulesWorkingFolderForEngine);

        // Confirm folders were removed
        const removedFolders: string[] = fileSystem.rmCallHistory.map(args => args.absPath.toString());
        expect(removedFolders).toContain(expectedRulesWorkingFolderRoot);
        expect(removedFolders).toContain(expectedRulesWorkingFolderForEngine);

        // Verify end result
        expect(fileSystem.files).not.toContain(expectedRulesWorkingFolderRoot);
        expect(fileSystem.files).not.toContain(expectedRulesWorkingFolderForEngine);
    });

    it("When selecting rules, and an engine emit throws an exception, then we keep its rules working folder and log it", async () => {
        codeAnalyzer = createCodeAnalyzer();
        const logEvents: LogEvent[] = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        await codeAnalyzer.addEnginePlugin(new stubs.ThrowingEnginePlugin2());

        await codeAnalyzer.selectRules(['all']);

        const expectedRulesWorkingFolderRoot: string = path.join(os.tmpdir(),'code-analyzer-0','rules-' + clock.formatToDateTimeString());
        const expectedRulesWorkingFolderForEngine: string = path.join(expectedRulesWorkingFolderRoot, 'someEngine');

        // First confirm that the root folder and the engine folder were created
        const createdFolders: string[] = fileSystem.mkdirCallHistory.map(args => args.absPath.toString());
        expect(createdFolders).toContain(expectedRulesWorkingFolderRoot);
        expect(createdFolders).toContain(expectedRulesWorkingFolderForEngine);

        // Confirm nothing was removed
        const removedFolders: string[] = fileSystem.rmCallHistory.map(args => args.absPath.toString());
        expect(removedFolders).toHaveLength(0);

        // Verify end result
        expect(fileSystem.files).toContain(expectedRulesWorkingFolderRoot);
        expect(fileSystem.files).toContain(expectedRulesWorkingFolderForEngine);

        // Verify log lines
        const relevantLogMsgs: string[] = logEvents.filter(e => e.logLevel === LogLevel.Debug &&
        e.message.includes('the following temporary working folder will not be removed')).map(e => e.message);
        expect(relevantLogMsgs.filter(m => m.endsWith(expectedRulesWorkingFolderForEngine))).toHaveLength(1);
    });
});


function ruleNamesFor(selection: RuleSelection, engineName: string): string[] {
    return selection.getRulesFor(engineName).map(r => r.getName());
}
