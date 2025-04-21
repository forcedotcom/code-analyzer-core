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
import {FixedClock} from "@salesforce/code-analyzer-engine-api/utils";
import {RepeatedRuleNameEnginePlugin, StubEnginePlugin} from "./stubs";
import path from "node:path";
import {changeWorkingDirectoryToPackageRoot, FixedUniqueIdGenerator} from "./test-helpers";
import {getMessage} from "../src/messages";
import * as stubs from "./stubs";

changeWorkingDirectoryToPackageRoot();

describe('Tests for selecting rules', () => {
    let codeAnalyzer: CodeAnalyzer;
    let plugin: StubEnginePlugin;
    let sampleTimestamp: Date;

    async function setupCodeAnalyzer(codeAnalyzer: CodeAnalyzer) : Promise<void> {
        plugin = new StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(plugin);
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
    }

    beforeEach(async () => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        await setupCodeAnalyzer(codeAnalyzer);
        sampleTimestamp = new Date();
        codeAnalyzer._setClock(new FixedClock(sampleTimestamp));
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

    it('When multiple selectors are provided, then they act as a union', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules([
            'Security', // a tag
            'stubEngine2', // an engine name
            'stub1RuleD' // a rule name
        ]);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleB', 'stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleA', 'stub2RuleB', 'stub2RuleC']);

        // Sanity check against duplicates
        expect(await codeAnalyzer.selectRules(['all', 'Performance', 'DoesNotExist'])).toEqual(await codeAnalyzer.selectRules(['all']));
    });

    it('When colons are used and multiple selectors are provided then we get correct union and intersection behavior', async () => {
        const selection: RuleSelection = await codeAnalyzer.selectRules(['Recommended:Performance', 'stubEngine2:2', 'stubEngine2:DoesNotExist']);

        expect(selection.getEngineNames()).toEqual(['stubEngine1', 'stubEngine2']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleC']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual(['stub2RuleC']);
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
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));
        await setupCodeAnalyzer(codeAnalyzer);

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
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));
        await setupCodeAnalyzer(codeAnalyzer);

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
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.resolve(__dirname, "test-data", "sample-config-01.yaml")));
        await setupCodeAnalyzer(codeAnalyzer);

        const selection: RuleSelection = await codeAnalyzer.selectRules(['5']);
        expect(ruleNamesFor(selection, 'stubEngine1')).toEqual(['stub1RuleD']);
        expect(ruleNamesFor(selection, 'stubEngine2')).toEqual([]);
    });

    it('When an engine fails to return its rules, an error is logged and empty results are returned', async () => {
        // ====== TEST SETUP ======
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
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
        await codeAnalyzer.addEnginePlugin(new RepeatedRuleNameEnginePlugin());
        await expect(codeAnalyzer.selectRules([])).rejects.toThrow(
            getMessage('EngineReturnedMultipleRulesWithSameName', 'repeatedRuleNameEngine', 'repeatedRule'));
    });

    it('When selectRules is not provided with SelectOptions, then workspace should be undefined for all engines', async () => {
        await codeAnalyzer.selectRules(['all']);

        const expectedDescribeOptions: engApi.DescribeOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: undefined
        };
        const stubEngine1: stubs.StubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        expect(stubEngine1.describeRulesCallHistory).toEqual([{describeOptions: expectedDescribeOptions}]);
        const stubEngine2: stubs.StubEngine2 = plugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        expect(stubEngine2.describeRulesCallHistory).toEqual([{describeOptions: expectedDescribeOptions}]);
    });

    it('When selectRules is provided with SelectOptions, then they are forwarded to the engines', async () => {
        const selectOptions: SelectOptions = {
            workspace: await codeAnalyzer.createWorkspace([path.resolve('src'), path.resolve('test')])
        }
        await codeAnalyzer.selectRules(['all'], selectOptions);

        const expectedDescribeOptions: engApi.DescribeOptions = {
            logFolder: codeAnalyzer.getConfig().getLogFolder(),
            workspace: new engApi.Workspace('FixedId', [path.resolve('src'), path.resolve('test')])
        };
        const stubEngine1: stubs.StubEngine1 = plugin.getCreatedEngine('stubEngine1') as stubs.StubEngine1;
        expect(stubEngine1.describeRulesCallHistory).toEqual([{describeOptions: expectedDescribeOptions}]);
        const stubEngine2: stubs.StubEngine2 = plugin.getCreatedEngine('stubEngine2') as stubs.StubEngine2;
        expect(stubEngine2.describeRulesCallHistory).toEqual([{describeOptions: expectedDescribeOptions}]);
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
            key: 'Engine1DescribeKey',
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
            key: 'Engine2DescribeKey',
            data: {
                someProperty: 5,
                someOtherProperty: 'pqrst',
                someThirdProperty: false
            }
        });
    });
});


function ruleNamesFor(selection: RuleSelection, engineName: string): string[] {
    return selection.getRulesFor(engineName).map(r => r.getName());
}
