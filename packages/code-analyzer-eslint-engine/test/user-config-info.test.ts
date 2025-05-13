import * as path from "node:path";
import * as process from "node:process";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {UserConfigInfo, UserConfigState} from "../src/user-config-info";

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');
const WORKSPACE_WITH_LEGACY_CONFIG1: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyConfig1');
const WORKSPACE_WITH_LEGACY_CONFIG2: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyConfig2');
const WORKSPACE_WITH_LEGACY_CONFIG3: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyConfig3');
const WORKSPACE_WITH_LEGACY_IGNORE: string = path.join(TEST_DATA_FOLDER, 'workspaceWithLegacyIgnoreFile');
const WORKSPACE_WITH_FLAT_CONFIG1: string = path.join(TEST_DATA_FOLDER, 'workspaceWithFlatConfig1');
const WORKSPACE_WITH_FLAT_CONFIG2: string = path.join(TEST_DATA_FOLDER, 'workspaceWithFlatConfig2');
const WORKSPACE_WITH_FLAT_CONFIG3: string = path.join(TEST_DATA_FOLDER, 'workspaceWithFlatConfig3');

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
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it.each([
                    WORKSPACE_WITH_LEGACY_CONFIG1,
                    WORKSPACE_WITH_LEGACY_IGNORE
                ])('...and workspace root contains a config or ignore file, then return NO_USER_CONFIG state', (workspaceFolder: string) => {
                    const workspace: Workspace = new Workspace('id', [workspaceFolder]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                      expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                      expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                      expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it.each([
                    WORKSPACE_WITH_LEGACY_CONFIG2,
                    WORKSPACE_WITH_LEGACY_IGNORE
                ])('...and config root contains a config or ignore file, then return NO_USER_CONFIG state', (configRoot: string) => {
                    engineConfig.config_root = configRoot;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it.each([
                    WORKSPACE_WITH_LEGACY_CONFIG3,
                    WORKSPACE_WITH_LEGACY_IGNORE
                ])('...and pwd contains a config or ignore file, then return NO_USER_CONFIG state', (folder: string) => {
                    process.chdir(folder);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.NO_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a flat config file, then LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_FLAT_CONFIG1]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config file, then LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG1;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a flat config file, then LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG1);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig, undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            path.join(WORKSPACE_WITH_LEGACY_CONFIG1, '.eslintrc.json'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG2, '.eslintrc.yml'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG3, '.eslintrc.cjs')
        ])('...and eslint_config_file is supplied as a legacy config file...', (legacyConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = legacyConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG1;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG2);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains an different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG3]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG1;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG3);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            WORKSPACE_WITH_FLAT_CONFIG1,
            WORKSPACE_WITH_FLAT_CONFIG2,
            WORKSPACE_WITH_FLAT_CONFIG3
        ])('...and eslint_config_file is supplied as a flat config file...', (flatConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = flatConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG2;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG3);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG2;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG3);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
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
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a legacy config file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG1]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG1, '.eslintrc.json'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a legacy ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and workspace root contains a flat config file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_FLAT_CONFIG1]);
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG2; // Confirming that workspace wins so this is ignored
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG1, 'eslint.config.js'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and config root contains a legacy config and ignore file, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG3
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG2); // Also confirm that config root wins so this should be ignored
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG3, '.eslintrc.cjs'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG3, '.eslintignore'));
                });

                it('...and config root contains a flat config file and legacy ignore file, then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG3;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG3, 'eslint.config.mjs'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG3, '.eslintignore'));
                });


                it('...and pwd contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_IGNORE);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and pwd contains a flat config file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG2);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG2, 'eslint.config.cjs'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('... and workspace contains legacy config and pwd contains flat config, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG1]);
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG2);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG1, '.eslintrc.json'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a config, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a legacy config file and another legacy ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG3]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG3, '.eslintrc.cjs'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a flat config file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_FLAT_CONFIG1]);
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG2; // Confirming that workspace wins so this is ignored
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG1, 'eslint.config.js'));
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config file and another legacy ignore file, then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG3;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG3, 'eslint.config.mjs'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_IGNORE);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(undefined);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a flat config file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG2);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_FLAT_CONFIG2, 'eslint.config.cjs'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('... and workspace contains legacy config and pwd contains flat config, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG1]);
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG2);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG1, '.eslintrc.json'));
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            path.join(WORKSPACE_WITH_LEGACY_CONFIG1, '.eslintrc.json'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG2, '.eslintrc.yml'),
            path.join(WORKSPACE_WITH_LEGACY_CONFIG3, '.eslintrc.cjs')
        ])('...and eslint_config_file is supplied as a legacy config file...', (legacyConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = legacyConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains an ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG1;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_FLAT_CONFIG2);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a flat config file, then return LEGACY_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains an different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_CONFIG3]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a flat config, then return LEGACY_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_FLAT_CONFIG1;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a different ignore file, then return LEGACY_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG3);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.LEGACY_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(legacyConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });

        describe.each([
            WORKSPACE_WITH_FLAT_CONFIG1,
            WORKSPACE_WITH_FLAT_CONFIG2,
            WORKSPACE_WITH_FLAT_CONFIG3
        ])('...and eslint_config_file is supplied as a flat config file...', (flatConfigFile: string) => {
            beforeEach(() => {
                engineConfig.eslint_config_file = flatConfigFile;
            });

            describe('...and eslint_ignore_file is not supplied...', () => {
                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore'));
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG2;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(undefined);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG3);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(path.join(WORKSPACE_WITH_LEGACY_CONFIG3, '.eslintignore'));
                });
            });

            describe('...and eslint_ignore_file is supplied...', () => {

                beforeEach(() => {
                    engineConfig.eslint_ignore_file = path.join(WORKSPACE_WITH_LEGACY_IGNORE, '.eslintignore');
                });

                it('...and workspace root, config root, and pwd do not contain a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and workspace root contains a config or ignore file, then return FLAT_USER_CONFIG state', () => {
                    const workspace: Workspace = new Workspace('id', [WORKSPACE_WITH_LEGACY_IGNORE]);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , workspace);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and config root contains a legacy config then return FLAT_USER_CONFIG state', () => {
                    engineConfig.config_root = WORKSPACE_WITH_LEGACY_CONFIG2;
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });

                it('...and pwd contains a legacy config and ignore file, then return FLAT_USER_CONFIG state', () => {
                    process.chdir(WORKSPACE_WITH_LEGACY_CONFIG3);
                    const userConfigInfo: UserConfigInfo = new UserConfigInfo(engineConfig , undefined);
                    expect(userConfigInfo.getState()).toEqual(UserConfigState.FLAT_USER_CONFIG);
                    expect(userConfigInfo.getUserConfigFile()).toEqual(flatConfigFile);
                    // Yes we still set the ignore file so that the engine can detect it and issue a warning if it wants to
                    expect(userConfigInfo.getUserIgnoreFile()).toEqual(engineConfig.eslint_ignore_file);
                });
            });
        });
    });
});
