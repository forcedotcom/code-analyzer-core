import {RegexEngine} from "../src/engine";
import {RegexEnginePlugin} from "../src";
import {
    ConfigObject, ConfigValueExtractor,
    Engine,
    getMessageFromCatalog,
    SeverityLevel,
    SHARED_MESSAGE_CATALOG
} from "@salesforce/code-analyzer-engine-api";
import {FixedClock, RealClock} from '@salesforce/code-analyzer-engine-api/utils';
import {getMessage} from "../src/messages";
import {
    FILE_EXT_PATTERN,
    REGEX_ENGINE_CONFIG_DESCRIPTION,
    REGEX_STRING_PATTERN,
    RegexRule,
    RegexRules,
    RULE_NAME_PATTERN
} from "../src/config";
import {createBaseRegexRules} from "../src/plugin";

const SAMPLE_RAW_CUSTOM_RULE_DEFINITION = {
    regex: String.raw`/TODO:\s/gi`,
    description: "Detects TODO comments in code base.",
    file_extensions: [".js", ".ts", ".cls"]
};

const SAMPLE_RAW_CUSTOM_RULE_NO_FILE_EXTS_DEFINITION = {
    regex: String.raw`/hello/gi`,
    description: "Detects hellos in project",
    tags: ["dummy"]
}

const SAMPLE_DATE: Date = new Date(Date.UTC(2024, 8, 1, 0, 0, 0));

describe('RegexEnginePlugin No Custom Config Tests' , () => {
    let enginePlugin: RegexEnginePlugin;
    beforeAll(() => {
        enginePlugin = new RegexEnginePlugin()
        enginePlugin._setClock(new FixedClock(SAMPLE_DATE));
    });

    it('Check that I can get all available engine names', () => {
        expect(enginePlugin.getAvailableEngineNames()).toStrictEqual(['regex']);
    })

    it('When describeEngineConfig is called, then it returns the expected ConfigDescription', () => {
        expect(enginePlugin.describeEngineConfig('regex')).toEqual(REGEX_ENGINE_CONFIG_DESCRIPTION);
    });

    it('Check that engine created from the plugin has expected type and name', async () => {
        const engine: Engine = await enginePlugin.createEngine('regex', {});
        expect(engine).toBeInstanceOf(RegexEngine);
        expect(engine.getName()).toStrictEqual('regex');
    });

    it('If I make an engine with an invalid name, it should throw an error with the proper error message', async () => {
        await expect(enginePlugin.createEngine('OtherEngine', {})).rejects.toThrow(
            getMessage('UnsupportedEngineName', 'OtherEngine'));
    });

    type ApiVersionTestCase = {
        date: Date
        expectedRegexString: string
        expectedVersion: number
    };
    const apiVersionTestCases: ApiVersionTestCase[] = [
        { date: new Date(Date.UTC(2024,8,15)), expectedRegexString: '/<apiVersion>(?<target>([1-9]|[1-4][0-9]|5[0-2])(\\.[0-9])?)<\\/apiVersion>/g', expectedVersion: 52 }, // Summer'24 - 3 years = Summer'21 (52.0)
        { date: new Date(Date.UTC(2022,2,1)), expectedRegexString: '/<apiVersion>(?<target>([1-9]|[1-3][0-9]|4[0-5])(\\.[0-9])?)<\\/apiVersion>/g', expectedVersion: 45 },  // Spring'22 - 3 years = Spring'19 (45.0)
        { date: new Date(Date.UTC(2023,5,2)), expectedRegexString: '/<apiVersion>(?<target>([1-9]|[1-3][0-9]|4[0-9])(\\.[0-9])?)<\\/apiVersion>/g', expectedVersion: 49 },  // Summer'23 - 3 years = Summer'20 (49.0)
        { date: new Date(Date.UTC(2025,9,3)), expectedRegexString: '/<apiVersion>(?<target>([1-9]|[1-4][0-9]|5[0-6])(\\.[0-9])?)<\\/apiVersion>/g', expectedVersion: 56 },  // Winter'26 - 3 years = Winter'23 (56.0)
        { date: new Date(Date.UTC(2028,3,7)), expectedRegexString: '/<apiVersion>(?<target>([1-9]|[1-5][0-9]|6[0-3])(\\.[0-9])?)<\\/apiVersion>/g', expectedVersion: 63 }   // Spring'28 - 3 years = Spring'25 (63.0)
    ];
    it.each(apiVersionTestCases)('RegexEnginePlugin produces engine with AvoidOldSalesforceApiVersions that depends on current date', async (testCase: ApiVersionTestCase) => {
        enginePlugin._setClock(new FixedClock(testCase.date));
        const engine: RegexEngine = await enginePlugin.createEngine('regex', {}) as RegexEngine;
        const regexRules: RegexRules = engine._getRegexRules();
        const apiVersionRule: RegexRule = regexRules['AvoidOldSalesforceApiVersions'];
        expect(apiVersionRule).toBeDefined();
        expect(apiVersionRule.regex).toEqual(testCase.expectedRegexString);
        expect(apiVersionRule.violation_message).toEqual(getMessage('AvoidOldSalesforceApiVersionsRuleMessage', testCase.expectedVersion));
    });


    it('Throw an error, if date is outside valid range to generate a valid API version regular expression for AvoidOldSalesforceApiVersions rule', async () => {
        enginePlugin._setClock(new FixedClock(new Date(Date.UTC(2006,1,1))));
        await expect(enginePlugin.createEngine('regex', {})).rejects.toThrow(
            "This method only works for API versions that are >= 20.0 and < 100.0. Please contact Salesforce to fix this method."
        );
        enginePlugin._setClock(new FixedClock(new Date(Date.UTC(2050,1,1))));
        await expect(enginePlugin.createEngine('regex', {})).rejects.toThrow(
            "This method only works for API versions that are >= 20.0 and < 100.0. Please contact Salesforce to fix this method."
        );
    });

    it('Test will generate a valid API version now, but will throw error if 3 year old API version is >100', async () => {
        enginePlugin._setClock(new RealClock());
        await expect(enginePlugin.createEngine('regex', {})).resolves.toBeDefined(); // if this throws at some point in the future, then at that time we will need to rewrite our rule
    });
});

describe('RegexEnginePlugin Custom Config Tests', () => {
    let plugin: RegexEnginePlugin;
    beforeAll(async () => {
        plugin = new RegexEnginePlugin()
        plugin._setClock(new FixedClock(SAMPLE_DATE));
    });

    it("When valid custom rules are provided, then they are appended to base rules", async () => {
        const rawConfig: ConfigObject = {
            custom_rules: {
                NoTodos: SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                NoHellos: SAMPLE_RAW_CUSTOM_RULE_NO_FILE_EXTS_DEFINITION
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig('regex', valueExtractor);
        const engine: RegexEngine = await plugin.createEngine('regex', resolvedConfig) as RegexEngine;
        const customNoTodoRuleRegex: RegExp = /TODO:\s/gi;
        const customNoHelloRuleRegex: RegExp = /hello/gi;
        const expRegexRules: RegexRules = {
            ...createBaseRegexRules(SAMPLE_DATE),
            NoTodos: {
                regex: customNoTodoRuleRegex.toString(),
                description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions,
                violation_message: getMessage('RuleViolationMessage', customNoTodoRuleRegex.toString(), 'NoTodos', 'Detects TODO comments in code base.'),
                severity: SeverityLevel.Moderate,
                tags: ['Recommended', 'Custom']
            },
            NoHellos: {
                regex: customNoHelloRuleRegex.toString(),
                description: SAMPLE_RAW_CUSTOM_RULE_NO_FILE_EXTS_DEFINITION.description,
                violation_message: getMessage('RuleViolationMessage', customNoHelloRuleRegex.toString(), 'NoHellos', 'Detects hellos in project'),
                severity: SeverityLevel.Moderate,
                tags: ['dummy']
            }
        };
        expect(engine._getRegexRules()).toEqual(expRegexRules);
    });

    it('If createEngineConfig is given an object with an unknown field, then error', async () => {
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor({unknownField: 3}, 'engines.regex');
        await expect(plugin.createEngineConfig('regex', valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigObjectContainsInvalidKey', 'engines.regex',
                'unknownField', '["custom_rules"]'));
    });

    it('If custom_rules is given as an array instead of an object, emit appropriate error', async () => {
        const rawConfig: ConfigObject = {
            custom_rules: [
                {
                    name: "NoTodos",
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION
                }
            ]
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig('regex', valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules', 'object', 'array'));
    })


    it("If regex given in a rule is malformed, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules:
                {
                    "BadRule": {
                        regex: '/something[/gi',
                        description: "Bad rule description",
                        file_extensions: [".js", ".ts", ".cls"]
                    }
                }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.BadRule.regex',
                getMessage('InvalidRegexDueToError', '/something[/gi', "Invalid regular expression: /something[/gi: Unterminated character class")));
    });

    it("If regex is not given in forward-slash delimited strings, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "BadRule": {
                    regex: 'something[',
                    description: "Bad rule description",
                    file_extensions: [".js", ".ts", ".cls"]
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.BadRule.regex',
                getMessage('InvalidRegexDueToBadPattern', 'something[', REGEX_STRING_PATTERN.toString())));
    });

    it("If regex is given without two forward slashes, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "BadRule": {
                    regex: 'something[/gi',
                    modifier: "gi",
                    description: "Bad rule description",
                    file_extensions: [".js", ".ts", ".cls"]
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.BadRule.regex',
                getMessage('InvalidRegexDueToBadPattern', 'something[/gi', REGEX_STRING_PATTERN.toString())));
    });


    it("If regex has invalid modifiers, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/glpr",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.NoTodos.regex',
                getMessage('InvalidRegexDueToError', '/TODO:/glpr', "Invalid flags supplied to RegExp constructor 'glpr'")));

    });

    it("If regex modifiers are repeated, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/gig",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.NoTodos.regex',
                getMessage('InvalidRegexDueToError', '/TODO:/gig', "Invalid flags supplied to RegExp constructor 'gig'")));
    });

    it("If modifiers u, v appear together, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/guv",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.NoTodos.regex',
                getMessage('InvalidRegexDueToError', '/TODO:/guv', "Invalid flags supplied to RegExp constructor 'guv'")));
    });

    it('If global modifier does not appear in regex, emit appropriate error', async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: "/TODO:/i",
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidConfigurationValueWithReason', 'engines.regex.custom_rules.NoTodos.regex',
                getMessage('InvalidRegexDueToGlobalModifierNotProvided', '/TODO:/i','/TODO:/gi')));
    });

    it("If regex is not given by user, emit error", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType',
                'engines.regex.custom_rules.NoTodos.regex', 'string', 'null'));
    });

    it("If rule name is empty, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "": SAMPLE_RAW_CUSTOM_RULE_DEFINITION
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidRuleName', '', 'engines.regex.custom_rules', RULE_NAME_PATTERN.toString()));
    });

    it("If rule name has special character at the beginning, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "1hello": SAMPLE_RAW_CUSTOM_RULE_DEFINITION
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidRuleName', '1hello', 'engines.regex.custom_rules', RULE_NAME_PATTERN.toString()));
    });

    it("If rule name has invalid character after first character, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "rule*": SAMPLE_RAW_CUSTOM_RULE_DEFINITION
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessage('InvalidRuleName', 'rule*', 'engines.regex.custom_rules', RULE_NAME_PATTERN.toString()));
    });

    it("If description is not a string, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: 4,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.description', 'string', 'number'));
    });

    it("If description is not defined, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    file_extensions: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.file_extensions
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.description', 'string', 'null'));
    });

    it("If file_extensions are not a string array, ensure proper error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: ".js"
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.file_extensions', 'array', 'string'));
    });

    it("If file_extensions are not properly formatted, emit appropriate error", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: ["js"]
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueMustMatchRegExp', 'engines.regex.custom_rules.NoTodos.file_extensions[0]', FILE_EXT_PATTERN.toString()));
    });

    it("If file_extensions are not unique or are upper case, then they are normalized to be unique and lower case", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    regex: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.regex,
                    description: SAMPLE_RAW_CUSTOM_RULE_DEFINITION.description,
                    file_extensions: [".JS", ".JS", ".tS", ".Js"]
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig("regex", valueExtractor);
        const engine: RegexEngine = await plugin.createEngine("regex", resolvedConfig) as RegexEngine;
        expect(engine._getRegexRules()["NoTodos"].file_extensions).toEqual(['.js', '.ts']);
    });

    it("If user creates a rule with a custom violation message, ensure that is maintained in config", async () => {
        const custom_message: string = "I have a custom message";
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    violation_message: custom_message
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig("regex", valueExtractor);
        const pluginEngine: RegexEngine = await plugin.createEngine("regex", resolvedConfig) as RegexEngine;
        expect(pluginEngine._getRegexRules()["NoTodos"].violation_message).toStrictEqual(custom_message);
    });

    it("If user creates a rule with a custom severity level, ensure that is maintained in config", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    severity: SeverityLevel.Critical
                },
                "OtherRule": {
                    ... SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    severity: "hiGH" // Also testing for case insensitivity
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig("regex", valueExtractor);
        const pluginEngine: RegexEngine = await plugin.createEngine("regex", resolvedConfig) as RegexEngine;
        expect(pluginEngine._getRegexRules()["NoTodos"].severity).toStrictEqual(SeverityLevel.Critical);
        expect(pluginEngine._getRegexRules()["OtherRule"].severity).toStrictEqual(SeverityLevel.High);
    });


    it("If user creates a rule with an invalid severity level, ensure correct error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    severity: 7
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel',
                'engines.regex.custom_rules.NoTodos.severity', JSON.stringify(Object.values(SeverityLevel)), '7'));
    });

    it("If user creates a rule with a custom tags, ensure they are maintained in config", async () => {
        const customTags: string[] = ["RandomTag"]
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    tags: customTags
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        const resolvedConfig: ConfigObject = await plugin.createEngineConfig("regex", valueExtractor);
        const pluginEngine: RegexEngine = await plugin.createEngine("regex", resolvedConfig) as RegexEngine;
        expect(pluginEngine._getRegexRules()["NoTodos"].tags).toStrictEqual(customTags);
    });

    it("If user creates a rule with tags that are not a string array, ensure correct error is emitted", async () => {
        const rawConfig = {
            custom_rules: {
                "NoTodos": {
                    ...SAMPLE_RAW_CUSTOM_RULE_DEFINITION,
                    tags: "RandomTag"
                }
            }
        };
        const valueExtractor: ConfigValueExtractor = new ConfigValueExtractor(rawConfig, 'engines.regex');
        await expect(plugin.createEngineConfig("regex", valueExtractor)).rejects.toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG,'ConfigValueMustBeOfType', 'engines.regex.custom_rules.NoTodos.tags', 'array', 'string'));
    });
});
