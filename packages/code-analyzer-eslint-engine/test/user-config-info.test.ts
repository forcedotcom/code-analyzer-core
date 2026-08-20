import * as path from "node:path";
import * as process from "node:process";
import {LogLevel, Workspace} from "@salesforce/code-analyzer-engine-api";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {getMessage} from "../src/messages";
import {UserConfigInfo, UserConfigState} from "../src/user-config-info";

type CollectedLogEvent = { logLevel: LogLevel, message: string };

function createLogEventCollector(): { events: CollectedLogEvent[], emit: (logLevel: LogLevel, message: string) => void } {
    const events: CollectedLogEvent[] = [];
    return {
        events,
        emit: (logLevel: LogLevel, message: string) => events.push({logLevel, message})
    };
}

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');
const WORKSPACE_WITH_LEGACY_CONFIG_JSON: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyConfigJson');
const WORKSPACE_WITH_LEGACY_CONFIG_YML: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyConfigYml');
const WORKSPACE_WITH_LEGACY_CONFIG_CJS: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyConfigCjs');
const WORKSPACE_WITH_LEGACY_IGNORE: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyIgnoreFile');
const WORKSPACE_WITH_FLAT_CONFIG_JS: string = path.join(TEST_DATA_FOLDER, 'workspaceWithFlatConfigJs');
const WORKSPACE_WITH_FLAT_CONFIG_CJS: string = path.join(TEST_DATA_FOLDER, 'workspaceWithFlatConfigCjs');
const WORKSPACE_WITH_FLAT_CONFIG_MJS: string = path.join(TEST_DATA_FOLDER, 'workspaceWithFlatConfigMjs');

describe('Tests for the UserConfigInfo class', () => {
    let engineConfig: ESLintEngineConfig;

    const original_working_directory: string = process.cwd();

    beforeEach(() => {
        engineConfig = {
            ...DEFAULT_CONFIG,
            config_root: __dirname
        };

        // Since eslint auto discovers based on workspace dir, then config root, and then process.cwd()...
        // we need to make sure that we don't accidentally sit inside our package root folder which contains our
        // eslint.config.mjs file. Otherwise, we'll never hit the NO_USER_CONFIG cases. So we CD to test directory.
        process.chdir(__dirname);
    });
    afterEach(() => {
        process.chdir(original_working_directory);
    });

    describe('When auto_discover_eslint_config is false...', () => {

        beforeEach(() => {
            engineConfig.auto_discover_eslint_config = false;
        });

        describe('...and eslint_config_file is not supplied...', () => {
            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return NO_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it.each([
                    WORKSPACE_WITH_LEGACY_CONFIG_JSON,
                    WORKSPACE_WITH_LEGACY_IGNORE
                ])('...and workspace root contains a config or ignore file, then return NO_USER_CONFIG state', (workspaceFolder: string) => {
                    const workspace: Workspace = new Workspace('id', [workspaceFolder]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                      expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                      expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                      expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it.each([
                    WORKSPACE_WITH_LEGACY_CONFIG_YML,
                    WORKSPACE_WITH_LEGACY_IGNORE
                ])('...and config root contains a config or ignore file, then return NO_USER_CONFIG state', (configRoot: string) => {
                    engineConfig.config_root = configRoot;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it.each([
                    WORKSPACE_WITH_LEGACY_CONFIG_CJS,
                    WORKSPACE_WITH_LEGACY_IGNORE
                ])('...and pwd contains a config or ignore file, then return NO_USER_CONFIG state', (folder: string) => {
                    process.chdir(folder);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a flat config file, then LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_FLAT_CONFIG_JS]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config file, then LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_JS;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a flat config file, then LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_JS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_JSON, '.eslintrc.json'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_YML, '.eslintrc.yml'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintrc.cjs')
        ])('...and eslint_config_file is supplied as a legacy config file...', (legacyConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = legacyConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_JS;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains an different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_CJS]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_JS;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            WORKSPACE_WITH_FLAT_CONFIG_JS,
            WORKSPACE_WITH_FLAT_CONFIG_CJS,
            WORKSPACE_WITH_FLAT_CONFIG_MJS
        ])('...and eslint_config_file is supplied as a flat config file...', (flatConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = flatConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_YML;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_YML;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });
    });

    describe('When auto_discover_eslint_config is true...', () => {

        beforeEach(() => {
            engineConfig.auto_discover_eslint_config = true;
        });

        describe('...and eslint_config_file is not supplied...', () => {
            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return NO_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a legacy config file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_JSON]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG_JSON, '.eslintrc.json'));
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a legacy ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and workspace root contains an executable flat config file, then skip it with a warning and return NO_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_FLAT_CONFIG_JS]);
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_YML; // Confirming that workspace wins so this is ignored
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_FLAT_CONFIG_JS, 'eslint.config.js'))
                    });
                });

                it('...and config root contains an executable legacy config and ignore file, then skip the config with a warning but keep the ignore file', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_CJS
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_YML); // Also confirm that config root wins so this should be ignored
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintignore'));
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintrc.cjs'))
                    });
                });

                it('...and config root contains an executable flat config file and legacy ignore file, then skip the config with a warning but keep the ignore file', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_MJS;
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG_MJS, '.eslintignore'));
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_FLAT_CONFIG_MJS, 'eslint.config.mjs'))
                    });
                });


                it('...and pwd contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_IGNORE);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and pwd contains an executable flat config file, then skip it with a warning and return NO_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_CJS);
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_FLAT_CONFIG_CJS, 'eslint.config.cjs'))
                    });
                });

                it('...and workspace root contains a declarative legacy config file, then still apply it with no warning', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_YML]);
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG_YML, '.eslintrc.yml'));
                    expect(logCollector.events).toHaveLength(0);
                });

                it('... and workspace contains legacy config and pwd contains flat config, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_JSON]);
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG_JSON, '.eslintrc.json'));
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a config, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains an executable legacy config file and another legacy ignore file, then skip the config with a warning and return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_CJS]);
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintrc.cjs'))
                    });
                });

                it('...and workspace root contains an executable flat config file, then skip the config with a warning and return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_FLAT_CONFIG_JS]);
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_YML; // Confirming that workspace wins so this is ignored
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_FLAT_CONFIG_JS, 'eslint.config.js'))
                    });
                });

                it('...and config root contains an executable flat config file and another legacy ignore file, then skip the config with a warning and return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_MJS;
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_FLAT_CONFIG_MJS, 'eslint.config.mjs'))
                    });
                });

                it('...and pwd contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_IGNORE);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains an executable flat config file, then skip the config with a warning and return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_CJS);
                    const logCollector = createLogEventCollector();
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined, logCollector.emit);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                    expect(logCollector.events).toContainEqual({
                        logLevel: LogLevel.Warn,
                        message: getMessage('SkippedAutoDiscoveredExecutableConfigFile', path.join(WORKSPACE_WITH_FLAT_CONFIG_CJS, 'eslint.config.cjs'))
                    });
                });

                it('... and workspace contains legacy config and pwd contains flat config, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_JSON]);
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG_JSON, '.eslintrc.json'));
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_JSON, '.eslintrc.json'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_YML, '.eslintrc.yml'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintrc.cjs')
        ])('...and eslint_config_file is supplied as a legacy config file...', (legacyConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = legacyConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_JS;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains an different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG_CJS]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG_JS;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            WORKSPACE_WITH_FLAT_CONFIG_JS,
            WORKSPACE_WITH_FLAT_CONFIG_CJS,
            WORKSPACE_WITH_FLAT_CONFIG_MJS
        ])('...and eslint_config_file is supplied as a flat config file...', (flatConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = flatConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_YML;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintignore'));
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG_YML;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG_CJS);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getChosenUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getChosenUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });
    });

    describe('When eslint_config_file is explicitly set to an executable config file...', () => {
        it.each([
            path.join(WORKSPACE_WITH_FLAT_CONFIG_JS, 'eslint.config.js'),
            path.join(WORKSPACE_WITH_FLAT_CONFIG_CJS, 'eslint.config.cjs'),
            path.join(WORKSPACE_WITH_FLAT_CONFIG_MJS, 'eslint.config.mjs'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_CJS, '.eslintrc.cjs')
        ])('...then it is still applied but a warning that it will execute is emitted (%s)', (executableConfigFile: string) => {
            engineConfig.eslint_config_file = executableConfigFile;
            const logCollector = createLogEventCollector();
            const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, undefined, logCollector.emit);
            expect(userConfigInfo.getChosenUserConfigFile()).toEqual(executableConfigFile);
            expect(logCollector.events).toContainEqual({
                logLevel: LogLevel.Warn,
                message: getMessage('ExplicitExecutableConfigFileWillExecute', executableConfigFile)
            });
        });

        it.each([
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_JSON, '.eslintrc.json'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG_YML, '.eslintrc.yml')
        ])('...but a declarative config file is applied with no execution warning (%s)', (declarativeConfigFile: string) => {
            engineConfig.eslint_config_file = declarativeConfigFile;
            const logCollector = createLogEventCollector();
            const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, undefined, logCollector.emit);
            expect(userConfigInfo.getChosenUserConfigFile()).toEqual(declarativeConfigFile);
            expect(logCollector.events.some(e => e.message === getMessage('ExplicitExecutableConfigFileWillExecute', declarativeConfigFile))).toEqual(false);
        });
    });
});
