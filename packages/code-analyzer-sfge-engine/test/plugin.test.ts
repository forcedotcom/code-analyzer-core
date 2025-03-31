import {
    ConfigObject,
    ConfigValueExtractor,
    EnginePluginV1,
    getMessageFromCatalog,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {SemVer} from 'semver';
import {SfgeEnginePlugin} from "../src";
import {
    DEFAULT_SFGE_ENGINE_CONFIG,
    SFGE_ENGINE_CONFIG_DESCRIPTION,
    SfgeEngineConfig
} from "../src/config";
import {SfgeEngine} from "../src/engine";
import {getMessage} from '../src/messages';
import {JavaVersionIdentifier, RuntimeJavaVersionIdentifier} from "../src/java-version-identifier";

describe('SfgeEnginePlugin', () => {
    let plugin: EnginePluginV1;

    beforeAll(() => {
        plugin = new SfgeEnginePlugin();
    });

    it(`#getAvailableEngineNames() returns 'sfge'`, () => {
        expect(plugin.getAvailableEngineNames()).toEqual(['sfge']);
    });

    describe('#describeEngineConfig', () => {
        it(`When passed 'sfge', the correct config description is returned.`, () => {
            expect(plugin.describeEngineConfig('sfge')).toEqual(SFGE_ENGINE_CONFIG_DESCRIPTION);
        });

        it('When passed an unsupported engine name, an appropriate error is thrown', () => {
            expect(() => plugin.describeEngineConfig('oops')).toThrow(getMessage('UnsupportedEngineName', 'oops'));
        });
    });

    describe('#createEngineConfig', () => {
        it('When passed an unsupported engine name, an appropriate error is thrown', async () => {
           await expect(plugin.createEngineConfig('oops', new ConfigValueExtractor({}, 'engines.oops')))
               .rejects.toThrow(getMessage('UnsupportedEngineName', 'oops'));
        });

        it('When given an object with an unknown field, an appropriate error is thrown', async () => {
            const cve: ConfigValueExtractor = new ConfigValueExtractor({invalidField: 2}, 'engines.sfge');
            await expect(plugin.createEngineConfig('sfge', cve)).rejects.toThrow(
                getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.sfge', 'invalidField',
                    '["disable_limit_reached_violations","java_command","java_max_heap_size","java_thread_count","java_thread_timeout"]'));
        });

        it('When given an empty raw config, the correct defaults are returned', async () => {
            const resolvedConfig: SfgeEngineConfig = await plugin.createEngineConfig('sfge', new ConfigValueExtractor({}, 'engines.sfge')) as SfgeEngineConfig;
            // This test assumes that all environments that run this test will have JAVA v11+ installed and either has
            // * the JAVA_HOME environment variable points to the home folder of this java command
            // * or has the java command is already on the top of the PATH
            expect(resolvedConfig.java_command.endsWith('java')).toEqual(true);
            expect(resolvedConfig).toEqual({
                java_command: resolvedConfig.java_command, // We just checked the Java Command above.
                disable_limit_reached_violations: false,
                java_max_heap_size: undefined,
                java_thread_count: 4,
                java_thread_timeout: 900000
            });
        });

        describe(`Validating the pathlike 'java_command' property`, () => {
            it.each([
                {
                    case: 'absent and Java lookup fails',
                    configObject: {} as ConfigObject,
                    javaVersionIdentifierBuilder: () => new StubJavaVersionIdentifier(null),
                    mainMessage: 'Could not locate Java v11.0.0+',
                    reasonMessage: getMessage('UnrecognizableJavaVersion', 'java')
                },
                {
                    case: 'absent and Java lookup produces outdated Java version',
                    configObject: {} as ConfigObject,
                    javaVersionIdentifierBuilder: () => new StubJavaVersionIdentifier(new SemVer('1.9.0')),
                    mainMessage: 'Could not locate Java v11.0.0+',
                    reasonMessage: `The command 'java' specifies Java v1.9.0, which is below minimum supported version v11.0.0.`
                },
                {
                    case: 'specified as an invalid command',
                    configObject: {java_command: '/some/invalid/java'} as ConfigObject,
                    javaVersionIdentifierBuilder: () => new RuntimeJavaVersionIdentifier(),
                    mainMessage: `The 'engines.sfge.java_command' configuration value is invalid.`,
                    reasonMessage: `When attempting to find the version of command '/some/invalid/java', an error was thrown:`
                },
                {
                    case: 'specified as an unrecognizable version',
                    configObject: {java_command: '/some/version/of/java'} as ConfigObject,
                    javaVersionIdentifierBuilder: () => new StubJavaVersionIdentifier(null),
                    mainMessage: `The 'engines.sfge.java_command' configuration value is invalid.`,
                    reasonMessage: getMessage('UnrecognizableJavaVersion', '/some/version/of/java')
                },
                {
                    case: 'specified as an outdated version',
                    configObject: {java_command: '/some/version/of/java'} as ConfigObject,
                    javaVersionIdentifierBuilder: () => new StubJavaVersionIdentifier(new SemVer('1.9.0')),
                    mainMessage: `The 'engines.sfge.java_command' configuration value is invalid.`,
                    reasonMessage: `The command '/some/version/of/java' specifies Java v1.9.0, which is below minimum supported version v11.0.0.`,
                }
            ])('When java_command is $case, an error is thrown', async ({configObject, javaVersionIdentifierBuilder, mainMessage, reasonMessage}) => {
                const pluginWithStub: SfgeEnginePlugin = new SfgeEnginePlugin(javaVersionIdentifierBuilder());
                try {
                    await pluginWithStub.createEngineConfig('sfge', new ConfigValueExtractor(configObject, 'engines.sfge'));
                    fail('Expected error to be thrown');
                } catch (err) {
                    const errMsg: string = (err as Error).message;
                    expect(errMsg).toContain(mainMessage);
                    expect(errMsg).toContain(reasonMessage);
                }
            });

            it('When provided java_command value is valid and up-to-date, it is used', async () => {
                const pluginWithStub: SfgeEnginePlugin = new SfgeEnginePlugin(new StubJavaVersionIdentifier(new SemVer('21.4.0')));
                const rawConfig: ConfigObject = {java_command: '/some/java'};
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.sfge');
                const normalizedConfig: ConfigObject = await pluginWithStub.createEngineConfig('sfge', configValueExtractor);
                expect(normalizedConfig).toHaveProperty('java_command', '/some/java');
            });
        });

        describe(`Validating the boolean 'disable_limit_reached_violations' property`, () => {
            it.each([
                {val: true},
                {val: false}
            ])(`Accepts boolean value $val`, async ({val}) => {
                const rawConfig: ConfigObject = {
                    disable_limit_reached_violations: val
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.sfge`);
                const resolvedConfig: ConfigObject = await plugin.createEngineConfig('sfge', configValueExtractor);
                expect(resolvedConfig).toHaveProperty('disable_limit_reached_violations', val);
            });

            it.each([
                {val: 'someString', type: 'string'},
                {val: 1, type: 'number'},
                {val: ['a', 'b', 'c'], type: 'array'},
                {val: {a: 1}, type: 'object'}
            ])(`Rejects non-boolean value: $val`, async ({val, type}) => {
                const rawConfig: ConfigObject = {
                    disable_limit_reached_violations: val
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.sfge`);
                await expect(plugin.createEngineConfig('sfge', configValueExtractor)).rejects.toThrow(
                    getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                        'engines.sfge.disable_limit_reached_violations', 'boolean', type)
                );
            });
        });

        describe.each([
            {prop: 'java_thread_count'},
            {prop: 'java_thread_timeout'}
        ])(`Validating the numeric property $prop`, ({prop}) => {
            it('Accepts numeric value', async () => {
                const rawConfig: ConfigObject = {
                    [prop]: 5
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.sfge`);
                const resolvedConfig: ConfigObject = await plugin.createEngineConfig('sfge', configValueExtractor);
                expect(resolvedConfig).toHaveProperty(prop, 5);
            });

            it.each([
                {val: 'a', type: 'string'},
                {val: true, type: 'boolean'},
                {val: [1, 2, 3], type: 'array'},
                {val: {a: 1}, type: 'object'}
            ])('Rejects non-numeric value: $val', async ({val, type}) => {
                const rawConfig: ConfigObject = {
                    [prop]: val
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.sfge`);
                await expect(plugin.createEngineConfig('sfge', configValueExtractor)).rejects.toThrow(
                    getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                        `engines.sfge.${prop}`, 'number', type)
                );
            });
        });

        describe(`Validating the formatted string property java_max_heap_size`, () => {
            it.each([
                {val: '2097152'},  // Java needs >=2MB to run at all.
                {val: '2097152b'}, // Java needs >=2MB to run at all.
                {val: '2048K'},    // Java needs >=2MB to run at all.
                {val: '2048KB'},   // Java needs >=2MB to run at all.
                {val: '2048k'},    // Java needs >=2MB to run at all.
                {val: '2048kb'},   // Java needs >=2MB to run at all.
                {val: '2M'},       // Java needs >=2MB to run at all.
                {val: '2MB'},      // Java needs >=2MB to run at all.
                {val: '2m'},       // Java needs >=2MB to run at all.
                {val: '2mb'},      // Java needs >=2MB to run at all.
                {val: '2098176'},  // Un-suffixed numbers must be increments of 1024.
                {val: '8193K'},    // Suffixed numbers can be any value, and suffix can be any case.
                {val: '8193k'},    // Suffixed numbers can be any value, and suffix can be any case.
                {val: '9M'},       // Suffixed numbers can be any value, and suffix can be any case.
                {val: '9m'},       // Suffixed numbers can be any value, and suffix can be any case.
                {val: '2G'},       // Suffixed numbers can be any value, and suffix can be any case.
                {val: '2GB'},      // Suffixed numbers can be any value, and suffix can be any case.
                {val: '2g'},       // Suffixed numbers can be any value, and suffix can be any case.
                {val: '2gb'},      // Suffixed numbers can be any value, and suffix can be any case.
                {val: '02g'},      // Leading zeroes are weird, but they're not invalid.
                {val: '02gb'}      // Leading zeroes are weird, but they're not invalid.
            ])('Accepts valid string input: $val', async ({val}) => {
                const rawConfig: ConfigObject = {
                    java_max_heap_size: val
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.sfge');
                const resolvedConfig: ConfigObject = await plugin.createEngineConfig('sfge', configValueExtractor);
                expect(resolvedConfig).toHaveProperty('java_max_heap_size', val);
            });

            it.each([
                {
                    val: '1024',     // This value is too small.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The amount of memory specified must be >=2MB`
                }, {
                    val: '1024k',    // This value is too small.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The amount of memory specified must be >=2MB`
                }, {
                    val: '1m',       // This value is too small.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The amount of memory specified must be >=2MB`
                }, {
                    val: '8388700',  // This value is large enough, but it's not a multiple of 1024.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The amount of memory specified in bytes must be divisible by 1024`
                }, {
                    val: '2c',       // This value uses an invalid suffix.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The string did not match the regular expression pattern: /^\\d+[kmg]?b?$/i`
                }, {
                    val: '2cb',      // This value uses an invalid suffix.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The string did not match the regular expression pattern: /^\\d+[kmg]?b?$/i`
                }, {
                    val: 'g33',      // This value has the right suffix in the wrong place.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The string did not match the regular expression pattern: /^\\d+[kmg]?b?$/i`
                }, {
                    val: '3g3',      // This value has extra stuff trailing after the suffix.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The string did not match the regular expression pattern: /^\\d+[kmg]?b?$/i`
                }, {
                    val: 'g',        // Standalone suffix is invalid.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The string did not match the regular expression pattern: /^\\d+[kmg]?b?$/i`
                }, {
                    val: 'asdf',     // This value is pure nonsense.
                    errMsg: `The 'engines.sfge.java_max_heap_size' configuration value is invalid. The string did not match the regular expression pattern: /^\\d+[kmg]?b?$/i`
                }
            ])('Rejects invalid string value: $val', async ({val, errMsg}) => {
                const rawConfig: ConfigObject = {
                    java_max_heap_size: val
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.sfge`);
                await expect(plugin.createEngineConfig('sfge', configValueExtractor)).rejects.toThrow(errMsg);
            });

            it.each([
                {val: 2048, type: 'number'},
                {val: true, type: 'boolean'},
                {val: [1, 2, 3], type: 'array'},
                {val: {a: '1024'}, type: 'object'}
            ])('Rejects non-string value: $val', async ({val, type}) => {
                const rawConfig: ConfigObject = {
                    java_max_heap_size: val
                };
                const configValueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, `engines.sfge`);
                await expect(plugin.createEngineConfig('sfge', configValueExtractor)).rejects.toThrow(
                    getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                        `engines.sfge.java_max_heap_size`, 'string', type)
                );
            });
        });
    });

    describe('#createEngine', () => {
        it(`When passed 'sfge', returns an SfgeEngine instance`, async () => {
            expect(await plugin.createEngine('sfge', DEFAULT_SFGE_ENGINE_CONFIG)).toBeInstanceOf(SfgeEngine);
        });

        it('When passed an unsupported engine name, throws an appropriate error', async () => {
            await expect(plugin.createEngine('oops', {})).rejects.toThrow(
                getMessage('UnsupportedEngineName', 'oops'));
        });
    });
});

class StubJavaVersionIdentifier implements JavaVersionIdentifier {
    private readonly version: SemVer|null;

    constructor(version: SemVer|null) {
        this.version = version;
    }

    public identifyJavaVersion(_javaCommand: string): Promise<SemVer|null> {
        return Promise.resolve(this.version);
    }
}
