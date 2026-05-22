import {CodeAnalyzer, CodeAnalyzerConfig, ConfigDescription, ConfigFieldDescription, EventType, LogEvent, LogLevel} from "../src";
import * as stubs from "./stubs";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot, FakeFileSystem, FixedUniqueIdGenerator} from "./test-helpers";
import path from "node:path";
import {StubEngine1, StubEngine2, StubEngine3, ThrowingPlugin2} from "./stubs";
import * as engApi from "@salesforce/code-analyzer-engine-api";
import {FixedClock} from "@salesforce/code-analyzer-engine-api/utils";

changeWorkingDirectoryToPackageRoot();

const DEFAULT_CONFIG_ROOT: string = process.cwd();
const TEST_DATA_DIR: string= path.resolve(__dirname, 'test-data');

describe("Tests for adding engines to Code Analyzer", () => {
    let fileSystem: FakeFileSystem;
    let codeAnalyzer: CodeAnalyzer;
    let logEvents: LogEvent[];

    function createCodeAnalyzer(config: CodeAnalyzerConfig = CodeAnalyzerConfig.withDefaults()): CodeAnalyzer {
        fileSystem = new FakeFileSystem();
        codeAnalyzer = new CodeAnalyzer(config, fileSystem);
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
        return codeAnalyzer;
    }

    beforeEach(() => {
        fileSystem = new FakeFileSystem();
        codeAnalyzer = createCodeAnalyzer();
        logEvents = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
    });

    it('When adding engine plugin then all its engines are correctly added', async () => {
        const stubEnginePlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubEnginePlugin);

        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2","stubEngine3"]);
        const stubEngine1: StubEngine1 = stubEnginePlugin.getCreatedEngine('stubEngine1') as StubEngine1;
        expect(stubEngine1.getName()).toEqual('stubEngine1');
        expect(codeAnalyzer.getEngineConfig('stubEngine1')).toEqual({
            disable_engine: false,
            engine_name: "stubEngine1",
            config_root: DEFAULT_CONFIG_ROOT
        });
        const stubEngine2: StubEngine2 = stubEnginePlugin.getCreatedEngine('stubEngine2') as StubEngine2;
        expect(stubEngine2.getName()).toEqual('stubEngine2');
        expect(codeAnalyzer.getEngineConfig('stubEngine2')).toEqual({
            disable_engine: false,
            engine_name: "stubEngine2",
            config_root: DEFAULT_CONFIG_ROOT
        });
        const stubEngine3: StubEngine3 = stubEnginePlugin.getCreatedEngine('stubEngine3') as StubEngine3;
        expect(stubEngine3.getName()).toEqual('stubEngine3');
        expect(codeAnalyzer.getEngineConfig('stubEngine3')).toEqual({
            disable_engine: false,
            engine_name: "stubEngine3",
            config_root: DEFAULT_CONFIG_ROOT
        });
    });

    it('When adding engine plugin using non-default config then engines are correctly added with engine specific configurations', async () => {
        codeAnalyzer = createCodeAnalyzer(CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-02.Yml')));

        const stubEnginePlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubEnginePlugin);

        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2","stubEngine3"])
        const stubEngine1: StubEngine1 = stubEnginePlugin.getCreatedEngine('stubEngine1') as StubEngine1;
        expect(stubEngine1.getName()).toEqual('stubEngine1');
        expect(codeAnalyzer.getEngineConfig('stubEngine1')).toEqual({
            disable_engine: false,
            miscSetting1: true,
            miscSetting2: {
                miscSetting2A: 3,
                miscSetting2B: ["hello", "world"]
            },
            config_root: TEST_DATA_DIR,
            engine_name: "stubEngine1"
        });
        const stubEngine2: StubEngine2 = stubEnginePlugin.getCreatedEngine('stubEngine2') as StubEngine2;
        expect(stubEngine2.getName()).toEqual('stubEngine2');
        expect(codeAnalyzer.getEngineConfig('stubEngine2')).toEqual({
            disable_engine: false,
            engine_name: "stubEngine2",
            config_root: TEST_DATA_DIR
        });
        const stubEngine3: StubEngine3 = stubEnginePlugin.getCreatedEngine('stubEngine3') as StubEngine3;
        expect(stubEngine3.getName()).toEqual('stubEngine3');
        expect(codeAnalyzer.getEngineConfig('stubEngine3')).toEqual({
            disable_engine: false,
            engine_name: "stubEngine3",
            config_root: TEST_DATA_DIR
        });
    });

    it('(Forward Compatibility) When addEnginePlugin receives a plugin with a future api version then cast down to current api version', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.FutureEnginePlugin());

        const warnEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Warn, logEvents);
        expect(warnEvents.length).toEqual(1);
        expect(warnEvents[0].message).toEqual(getMessage('EngineFromFutureApiDetected', 99, '"future"', 1));
        expect(codeAnalyzer.getEngineNames()).toEqual(["future"]);
    })

    it('Attempt to add duplicate engines emits error log line but continues without adding the engines', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(3);
        expect(errorEvents[0].message).toEqual(getMessage('DuplicateEngine', 'stubEngine1'));
        expect(errorEvents[1].message).toEqual(getMessage('DuplicateEngine', 'stubEngine2'));
        expect(errorEvents[2].message).toEqual(getMessage('DuplicateEngine', 'stubEngine3'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2","stubEngine3"])
    })

    it('When plugin returns engine that contradicts the plugin availableEngineNames method, then we emit error log line and skip that engine', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.ContradictingEnginePlugin());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(1);
        expect(errorEvents[0].message).toEqual(getMessage('EngineNameContradiction', 'stubEngine1', 'stubEngine2'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual([])
    })

    it('When plugin throws error during getAvailableEngineNames, then we throw an exception', async () => {
        await expect(codeAnalyzer.addEnginePlugin(new stubs.ThrowingPlugin1())).rejects.toThrow(
            getMessage('PluginErrorFromGetAvailableEngineNames', 'SomeErrorFromGetAvailableEngineNames')
        );
    })

    it.each([
        {plugin: new stubs.ThrowingPlugin2() as engApi.EnginePluginV1, msg: 'SomeErrorFromDescribeEngineConfig', case: 'describeEngineConfig'},
        {plugin: new stubs.ThrowingPlugin3() as engApi.EnginePluginV1, msg: 'SomeErrorFromCreateEngineConfig', case: 'createEngineConfig'},
        {plugin: new stubs.ThrowingPlugin4() as engApi.EnginePluginV1, msg: 'SomeErrorFromCreateEngine', case: 'createEngine'}
    ])('When plugin throws error during $case, then we emit error log line and skip that engine', async ({plugin, msg}) => {
        await codeAnalyzer.addEnginePlugin(plugin);

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(1);
        expect(errorEvents[0].message).toEqual(getMessage('PluginErrorWhenCreatingEngine', 'someEngine', msg) + '\n\n' +
            getMessage('InstructionsToIgnoreErrorAndDisableEngine', 'someEngine')
        );
        expect(codeAnalyzer.getEngineNames().sort()).toEqual([]);
    })

    it('When calling dynamicallyAddEnginePlugin on a module that has a createEnginePlugin function, then it is used to create the plugin and then add it', async () => {
        const pluginModulePath: string = require.resolve('./stubs');
        await codeAnalyzer.dynamicallyAddEnginePlugin(pluginModulePath);
        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1", "stubEngine2", "stubEngine3"]);
    });

    it('When calling dynamicallyAddEnginePlugin on a module that is missing a createEnginePlugin function, then an error is thrown', async () => {
        const badPluginModulePath: string = require.resolve('./test-helpers');
        await expect(codeAnalyzer.dynamicallyAddEnginePlugin(badPluginModulePath)).rejects.toThrow(
            getMessage('FailedToDynamicallyAddEnginePlugin', badPluginModulePath));
    });

    it('When calling dynamicallyAddEnginePlugin on a module that does not exist, then an error is thrown', async () => {
        const expectedErrorMessageSubstring: string = getMessage('FailedToDynamicallyLoadModule', 'doesNotExist', '');
        await expect(codeAnalyzer.dynamicallyAddEnginePlugin('doesNotExist')).rejects.toThrow(expectedErrorMessageSubstring);
    });

    it('When calling dynamicallyAddEnginePlugin on a file that is not a module, then an error is thrown', async () => {
        const nonModuleFile: string = path.resolve('package.json');
        const expectedErrorMessageSubstring: string = getMessage('FailedToDynamicallyAddEnginePlugin', nonModuleFile);
        await expect(codeAnalyzer.dynamicallyAddEnginePlugin(nonModuleFile)).rejects.toThrow(expectedErrorMessageSubstring);
    });

    it('When an engine is disabled, then addEnginePlugin does not add that particular engine and gives debug log', async () => {
        codeAnalyzer = createCodeAnalyzer(CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-04.yml')));
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
        const sampleTimestamp: Date = new Date(2024, 7, 30, 11, 14, 34, 567);
        codeAnalyzer._setClock(new FixedClock(sampleTimestamp));
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());

        expect(codeAnalyzer.getEngineNames()).toEqual(['stubEngine2', 'stubEngine3']);
        expect(logEvents).toContainEqual({
            type: EventType.LogEvent,
            logLevel: LogLevel.Debug,
            timestamp: sampleTimestamp,
            message: getMessage('EngineDisabled', 'stubEngine1', 'engines.stubEngine1.disable_engine')
        });
    });

    it('After engine is added, then getEngineConfigDescription returns the correct description', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());
        const engineConfigDescription1: ConfigDescription = codeAnalyzer.getEngineConfigDescription('stubEngine1');
        expect(engineConfigDescription1).toEqual({
            overview: "OverviewForStub1",
            fieldDescriptions: {
                disable_engine: {
                    descriptionText: getMessage('EngineConfigFieldDescription_disable_engine', 'stubEngine1'),
                    valueType: "boolean",
                    defaultValue: false,
                    wasSuppliedByUser: false
                },
                misc_value: {
                    descriptionText: "someDescriptionFor_misc_value",
                    valueType: "number",
                    defaultValue: 1987,
                    wasSuppliedByUser: false
                }
            }
        });
        const engineConfigDescription2: ConfigDescription = codeAnalyzer.getEngineConfigDescription('stubEngine2');
        expect(engineConfigDescription2).toEqual({
            overview: getMessage('GenericEngineConfigOverview', 'STUBENGINE2'),
            fieldDescriptions: {
                disable_engine: {
                    descriptionText: getMessage('EngineConfigFieldDescription_disable_engine', 'stubEngine2'),
                    valueType: "boolean",
                    defaultValue: false,
                    wasSuppliedByUser: false
                }
            },
        });
    });

    it('If an engine configuration value is overridden with a null value, then getEngineConfigDescription should be treated as if it has not been overridden', async () => {
        codeAnalyzer = createCodeAnalyzer(CodeAnalyzerConfig.fromObject({
            engines: {
                stubEngine1: {
                    misc_value: null
                }
            }
        }));
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());

        const engineConfigDescription: ConfigDescription = codeAnalyzer.getEngineConfigDescription('stubEngine1');
        const miscValueFieldDesc: ConfigFieldDescription = engineConfigDescription.fieldDescriptions['misc_value'];
        expect(miscValueFieldDesc.wasSuppliedByUser).toEqual(false);
    });

    it('If engine has not been added, then getEngineConfig and getEngineConfigDescription should error', async () => {
        expect(() => codeAnalyzer.getEngineConfig('stubEngine1')).toThrow(
            getMessage('FailedToGetEngineConfig', 'stubEngine1'));
        expect(() => codeAnalyzer.getEngineConfigDescription('stubEngine1')).toThrow(
            getMessage('FailedToGetEngineConfigDescription', 'stubEngine1'));
    });

    it('If engine cannot be successfully added, then getEngineConfig and getEngineConfigDescription should error', async () => {
        await codeAnalyzer.addEnginePlugin(new ThrowingPlugin2());
        expect(() => codeAnalyzer.getEngineConfig('someEngine')).toThrow(
            getMessage('FailedToGetEngineConfig', 'someEngine'));
        expect(() => codeAnalyzer.getEngineConfigDescription('someEngine')).toThrow(
            getMessage('FailedToGetEngineConfigDescription', 'someEngine'));
    });

    it('When engine is disabled, we can still access its unresolved user provided properties', async () => {
        codeAnalyzer = createCodeAnalyzer(CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-04.yml')));
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());
        expect(codeAnalyzer.getEngineConfig('stubEngine1')).toEqual({
            disable_enginE: true,
            misc_valuE: 3
        });
    });

    it('When engine is disabled, we can still access its config description', async () => {
        codeAnalyzer = createCodeAnalyzer(CodeAnalyzerConfig.fromFile(path.join(TEST_DATA_DIR, 'sample-config-04.yml')));
        await codeAnalyzer.addEnginePlugin(new stubs.StubEnginePlugin());
        expect(codeAnalyzer.getEngineConfigDescription('stubEngine1')).toEqual({
            overview: "OverviewForStub1",
            fieldDescriptions: {
                disable_engine: {
                    descriptionText: getMessage('EngineConfigFieldDescription_disable_engine', 'stubEngine1'),
                    valueType: "boolean",
                    defaultValue: false,
                    wasSuppliedByUser: true
                },
                misc_value: {
                    descriptionText: "someDescriptionFor_misc_value",
                    valueType: "number",
                    defaultValue: 1987,
                    wasSuppliedByUser: true
                }
            }
        });
    });
});

function getLogEventsOfLevel(logLevel: LogLevel, logEvents: LogEvent[]): LogEvent[] {
    return logEvents.filter(e => e.logLevel == logLevel);
}
