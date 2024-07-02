import {CodeAnalyzer, CodeAnalyzerConfig, EventType, LogEvent, LogLevel} from "../src";
import * as stubs from "./stubs";
import {getMessage} from "../src/messages";
import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import path from "node:path";
import {StubEngine1, StubEngine2} from "./stubs";

changeWorkingDirectoryToPackageRoot();

const DEFAULT_CONFIG_FOLDER: string = process.cwd();

describe("Tests for adding engines to Code Analyzer", () => {
    let codeAnalyzer: CodeAnalyzer;
    let logEvents: LogEvent[];

    beforeEach(() => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.withDefaults());
        logEvents = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
    });

    it('When adding engine plugin then all its engines are correctly added', async () => {
        const stubEnginePlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubEnginePlugin);

        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2"]);
        const stubEngine1: StubEngine1 = stubEnginePlugin.getCreatedEngine('stubEngine1') as StubEngine1;
        expect(stubEngine1.getName()).toEqual('stubEngine1');
        expect(stubEngine1.config).toEqual({config_folder: DEFAULT_CONFIG_FOLDER});
        const stubEngine2: StubEngine2 = stubEnginePlugin.getCreatedEngine('stubEngine2') as StubEngine2;
        expect(stubEngine2.getName()).toEqual('stubEngine2');
        expect(stubEngine2.config).toEqual({config_folder: DEFAULT_CONFIG_FOLDER});
    });

    it('When adding engine plugin using non-default config then engines are correctly added with engine specific configurations', async () => {
        const testDataFolder: string= path.resolve(__dirname, 'test-data');
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromFile(path.join(testDataFolder, 'sample-config-02.Yml')));

        const stubEnginePlugin: stubs.StubEnginePlugin = new stubs.StubEnginePlugin();
        await codeAnalyzer.addEnginePlugin(stubEnginePlugin);

        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2"])
        const stubEngine1: StubEngine1 = stubEnginePlugin.getCreatedEngine('stubEngine1') as StubEngine1;
        expect(stubEngine1.getName()).toEqual('stubEngine1');
        expect(stubEngine1.config).toEqual({
            config_folder: testDataFolder,
            miscSetting1: true,
            miscSetting2: {
                miscSetting2A: 3,
                miscSetting2B: ["hello", "world"]
            }
        });
        const stubEngine2: StubEngine2 = stubEnginePlugin.getCreatedEngine('stubEngine2') as StubEngine2;
        expect(stubEngine2.getName()).toEqual('stubEngine2');
        expect(stubEngine2.config).toEqual({config_folder: testDataFolder});
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
        expect(errorEvents.length).toEqual(2);
        expect(errorEvents[0].message).toEqual(getMessage('DuplicateEngine', 'stubEngine1'));
        expect(errorEvents[1].message).toEqual(getMessage('DuplicateEngine', 'stubEngine2'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1","stubEngine2"])
    })

    it('When plugin returns engine that contradicts the plugin availableEngineNames method, then we emit error log line and skip that engine', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.ContradictingEnginePlugin());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(1);
        expect(errorEvents[0].message).toEqual(getMessage('EngineNameContradiction', 'stubEngine1', 'stubEngine2'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual([])
    })

    it('When plugin throws error during getAvailableEngineNames, then we throw an exception', () => {
        expect(codeAnalyzer.addEnginePlugin(new stubs.ThrowingPlugin1())).rejects.toThrow(
            getMessage('PluginErrorFromGetAvailableEngineNames', 'SomeErrorFromGetAvailableEngineNames')
        );
    })

    it('When plugin throws error during createEngine, then we emit error log line and skip that engine', async () => {
        await codeAnalyzer.addEnginePlugin(new stubs.ThrowingPlugin2());

        const errorEvents: LogEvent[] = getLogEventsOfLevel(LogLevel.Error, logEvents);
        expect(errorEvents.length).toEqual(1);
        expect(errorEvents[0].message).toEqual(getMessage('PluginErrorFromCreateEngine', 'someEngine', 'SomeErrorFromCreateEngine'));
        expect(codeAnalyzer.getEngineNames().sort()).toEqual([])
    });

    it('When calling dynamicallyAddEnginePlugin on a module that has a createEnginePlugin function, then it is used to add create the plugin and then added', async () => {
        const pluginModulePath: string = require.resolve('./stubs');
        await codeAnalyzer.dynamicallyAddEnginePlugin(pluginModulePath);
        expect(codeAnalyzer.getEngineNames().sort()).toEqual(["stubEngine1", "stubEngine2"]);
    });

    it('When calling dynamicallyAddEnginePlugin on a module that is missing a createEnginePlugin function, then an error is thrown', async () => {
        const badPluginModulePath: string = require.resolve('./test-helpers');
        expect(codeAnalyzer.dynamicallyAddEnginePlugin(badPluginModulePath)).rejects.toThrow(
            getMessage('FailedToDynamicallyAddEnginePlugin', badPluginModulePath));
    });

    it('When calling dynamicallyAddEnginePlugin on a module that does not exist, then an error is thrown', async () => {
        const expectedErrorMessageSubstring: string = getMessage('FailedToDynamicallyLoadModule', 'doesNotExist', '');
        expect(codeAnalyzer.dynamicallyAddEnginePlugin('doesNotExist')).rejects.toThrow(expectedErrorMessageSubstring);
    });

    it('When calling dynamicallyAddEnginePlugin on a file that is not a module, then an error is thrown', async () => {
        const nonModuleFile: string = path.resolve('LICENSE');
        const expectedErrorMessageSubstring: string = getMessage('FailedToDynamicallyLoadModule', nonModuleFile, '');
        expect(codeAnalyzer.dynamicallyAddEnginePlugin(nonModuleFile)).rejects.toThrow(expectedErrorMessageSubstring);
    });
});

function getLogEventsOfLevel(logLevel: LogLevel, logEvents: LogEvent[]): LogEvent[] {
    return logEvents.filter(e => e.logLevel == logLevel);
}