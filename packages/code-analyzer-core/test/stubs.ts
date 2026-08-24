import * as engApi from "@salesforce/code-analyzer-engine-api"
import {LogLevel} from "@salesforce/code-analyzer-engine-api"
import {Workspace} from "../src";
import path from "node:path";

const SAMPLE_WORKSPACE_FOLDER: string = path.join(__dirname, 'test-data', 'sampleWorkspace');

/**
 * StubWorkspace - A workspace stub with preconfigured outputs to help with testing
 */
export class StubWorkspace implements Workspace {
    getWorkspaceId(): string {
        return "dummyId";
    }

    getWorkspaceRoot(): string | null {
        return SAMPLE_WORKSPACE_FOLDER;
    }

    getRawFilesAndFolders(): string[] {
        return [path.join(SAMPLE_WORKSPACE_FOLDER)];
    }

    getRawTargets(): string[] | undefined {
        return [path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt')];
    }

    getWorkspaceFiles(): Promise<string[]> {
        return Promise.resolve([
            path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.txt'),
            path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt')
        ]);
    }

    getTargetedFiles(): Promise<string[]> {
        return Promise.resolve([path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.txt')]);
    }

    getTargetedMethods(): Promise<string[]> {
        return Promise.resolve([]);
    }
}

/**
 * StubEnginePlugin - A plugin stub with preconfigured outputs to help with testing
 */
export class StubEnginePlugin extends engApi.EnginePluginV1 {
    private readonly createdEngines: Map<string, engApi.Engine> = new Map();

    getAvailableEngineNames(): string[] {
        return ["stubEngine1", "stubEngine2", "stubEngine3"];
    }


    describeEngineConfig(engineName: string): engApi.ConfigDescription {
        if (engineName === "stubEngine1") {
            return {
                overview: 'OverviewForStub1',
                fieldDescriptions: {
                    misc_value: {
                        descriptionText: "someDescriptionFor_misc_value",
                        valueType: "number",
                        defaultValue: 1987
                    }
                }
            }
        }
        return {}
    }

    async createEngineConfig(engineName: string, configValueExtractor: engApi.ConfigValueExtractor): Promise<engApi.ConfigObject> {
        return {
            ...configValueExtractor.getObject(),
            engine_name: engineName,
            config_root: configValueExtractor.getConfigRoot()
        }
    }

    async createEngine(engineName: string, config: engApi.ConfigObject): Promise<engApi.Engine> {
        if (engineName === "stubEngine1") {
            this.createdEngines.set(engineName, new StubEngine1(config));
        } else if (engineName == "stubEngine2") {
            this.createdEngines.set(engineName, new StubEngine2(config));
        } else if (engineName == "stubEngine3") {
            this.createdEngines.set(engineName, new StubEngine3(config));
        } else {
            throw new Error(`Unsupported engine name: ${engineName}`)
        }
        return this.getCreatedEngine(engineName);
    }

    getCreatedEngine(engineName: string): engApi.Engine {
        if (this.createdEngines.has(engineName)) {
            return this.createdEngines.get(engineName) as engApi.Engine;
        }
        throw new Error(`Engine with name ${engineName} has not yet been created`);
    }
}

/**
 * StubEngine1 - A sample engine stub with preconfigured outputs to help with testing
 */
export class StubEngine1 extends engApi.Engine {
    readonly config: engApi.ConfigObject;
    readonly runRulesCallHistory: {ruleNames: string[], runOptions: engApi.RunOptions}[] = [];
    readonly describeRulesCallHistory: {describeOptions: engApi.DescribeOptions}[] = [];
    resultsToReturn: engApi.EngineRunResults = { violations: [] }

    constructor(config: engApi.ConfigObject) {
        super();
        this.config = config;
    }

    getName(): string {
        return "stubEngine1";
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('0.0.1');
    }

    async describeRules(describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        this.describeRulesCallHistory.push({describeOptions});
        this.emitDescribeRulesProgressEvent(20);
        this.emitLogEvent(engApi.LogLevel.Warn, "someMiscWarnMessageFromStubEngine1");
        this.emitTelemetryEvent('Engine1DescribeKey', {
            someProperty: 4,
            someOtherProperty: 'klmno',
            someThirdProperty: true
        });
        this.emitDescribeRulesProgressEvent(80);
        return [
            {
                name: "stub1RuleA",
                severityLevel: engApi.SeverityLevel.Low,
                tags: ["Recommended", "CodeStyle"],
                description: "Some description for stub1RuleA",
                resourceUrls: ["https://example.com/stub1RuleA"]
            },
            {
                name: "stub1RuleB",
                severityLevel: engApi.SeverityLevel.High,
                tags: ["Recommended", "Security"],
                description: "Some description for stub1RuleB",
                resourceUrls: ["https://example.com/stub1RuleB"]
            },
            {
                name: "stub1RuleC",
                severityLevel: engApi.SeverityLevel.Moderate,
                tags: ["Recommended", "Performance", "Custom"],
                description: "Some description for stub1RuleC",
                resourceUrls: ["https://example.com/stub1RuleC"]
            },
            {
                name: "stub1RuleD",
                severityLevel: engApi.SeverityLevel.Low,
                tags: ["CodeStyle"],
                description: "Some description for stub1RuleD",
                resourceUrls: ["https://example.com/stub1RuleD"]
            },
            {
                name: "stub1RuleE",
                severityLevel: engApi.SeverityLevel.Moderate,
                tags: ["Performance"],
                description: "Some description for stub1RuleE",
                resourceUrls: ["https://example.com/stub1RuleE", "https://example.com/stub1RuleE_2"]
            }
        ];
    }

    async runRules(ruleNames: string[], runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        this.runRulesCallHistory.push({ruleNames, runOptions});
        this.emitRunRulesProgressEvent(0);
        this.emitLogEvent(engApi.LogLevel.Fine, "someMiscFineMessageFromStubEngine1");
        this.emitTelemetryEvent('Engine1RunKey', {
            someProperty: 1,
            someOtherProperty: 'abcde',
            someThirdProperty: true
        });
        this.emitRunRulesProgressEvent(50, "someProgressMessage");
        this.emitRunRulesProgressEvent(100);
        return this.resultsToReturn;
    }
}

// Used to test dynamic import loading of an engine plugin
export function createEnginePlugin(): engApi.EnginePlugin {
    return new StubEnginePlugin();
}

/**
 * StubEngine2 - A sample engine stub with preconfigured outputs to help with testing
 */
export class StubEngine2 extends engApi.Engine {
    readonly config: engApi.ConfigObject;
    readonly runRulesCallHistory: {ruleNames: string[], runOptions: engApi.RunOptions}[] = [];
    readonly describeRulesCallHistory: {describeOptions: engApi.DescribeOptions}[] = [];
    resultsToReturn: engApi.EngineRunResults = { violations: [] }

    constructor(config: engApi.ConfigObject) {
        super();
        this.config = config;
    }

    getName(): string {
        return "stubEngine2";
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('0.1.0');
    }

    async describeRules(describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        this.describeRulesCallHistory.push({describeOptions});
        this.emitDescribeRulesProgressEvent(30);
        this.emitLogEvent(engApi.LogLevel.Error, "someMiscErrorMessageFromStubEngine2");
        this.emitTelemetryEvent('Engine2DescribeKey', {
            someProperty: 5,
            someOtherProperty: 'pqrst',
            someThirdProperty: false
        });
        this.emitDescribeRulesProgressEvent(90);
        return [
            {
                name: "stub2RuleA",
                severityLevel: engApi.SeverityLevel.Moderate,
                tags: ["Recommended", "Security"],
                description: "Some description for stub2RuleA",
                resourceUrls: ["https://example.com/stub2RuleA"]
            },
            {
                name: "stub2RuleB",
                severityLevel: engApi.SeverityLevel.Low,
                tags: ["Performance", "Custom"],
                description: "Some description for stub2RuleB",
                resourceUrls: ["https://example.com/stub2RuleB"]
            },
            {
                name: "stub2RuleC",
                severityLevel: engApi.SeverityLevel.High,
                tags: ["Recommended", "BestPractice"],
                description: "Some description for stub2RuleC",
                resourceUrls: [] // Purposely putting in nothing here
            }
        ];
    }

    async runRules(ruleNames: string[], runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        this.runRulesCallHistory.push({ruleNames, runOptions});
        this.emitLogEvent(engApi.LogLevel.Info, "someMiscInfoMessageFromStubEngine2");
        this.emitTelemetryEvent('Engine2RunKey', {
            someProperty: 2,
            someOtherProperty: 'fghij',
            someThirdProperty: false
        });
        this.emitRunRulesProgressEvent(5);
        this.emitRunRulesProgressEvent(63);
        return this.resultsToReturn;
    }
}

export class StubEngine3 extends engApi.Engine {
    readonly config: engApi.ConfigObject;
    readonly runRulesCallHistory: {ruleNames: string[], runOptions: engApi.RunOptions}[] = [];
    readonly describeRulesCallHistory: {describeOptions: engApi.DescribeOptions}[] = [];
    resultsToReturn: engApi.EngineRunResults = { violations: [] };

    constructor(config: engApi.ConfigObject) {
        super();
        this.config = config;
    }

    getName(): string {
        return 'stubEngine3';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('1.0.0');
    }

    async describeRules(describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        this.describeRulesCallHistory.push({describeOptions});
        this.emitDescribeRulesProgressEvent(50);
        this.emitLogEvent(engApi.LogLevel.Error, 'someMiscErrorMessageFromStubEngine3');
        this.emitDescribeRulesProgressEvent(85);
        return [
            {
                name: "stub3RuleA",
                severityLevel: engApi.SeverityLevel.Moderate,
                tags: ['Recommended', 'ErrorProne'],
                description: 'Some description for stub3RuleA',
                resourceUrls: [] // Purposely left empty
            }
        ]
    }

    async runRules(ruleNames: string[], runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        this.runRulesCallHistory.push({ruleNames, runOptions});
        this.emitLogEvent(engApi.LogLevel.Info, 'someMiscInfoMessageFromStubEngine3');
        this.emitRunRulesProgressEvent(5);
        this.emitRunRulesProgressEvent(80);
        return this.resultsToReturn;
    }
}

export function getSampleViolationForStub1RuleA(): engApi.Violation {
    return {
        ruleName: 'stub1RuleA',
        message: 'SomeViolationMessage1',
        codeLocations: [
            {
                file: 'test/config.test.ts',
                startLine: 3,
                startColumn: 6,
                endLine: 11,
                endColumn: 8
            }
        ],
        primaryLocationIndex: 0,
        resourceUrls: [
            "https://example.com/stub1RuleA" // Same url as rule's url... to test that we don't duplicate it
        ]
    };
}

export function getSampleViolationForStub1RuleAFromDirectoryWithSpaces(): engApi.Violation {
    return {
        ruleName: 'stub1RuleA',
        message: 'SomeViolationMessage1',
        codeLocations: [
            {
                file: 'test/test-data/sample-input-files/subfolder with spaces/some-target-file.ts',
                startLine: 10,
                startColumn: 4,
                endLine: 11,
                endColumn: 2
            }
        ],
        primaryLocationIndex: 0,
        resourceUrls: [
            "https://example.com/stub1RuleA" // Same url as rule's url... to test that we don't duplicate it
        ]
    }
}

export function getSampleViolationForStub1RuleC(): engApi.Violation {
    return {
        ruleName: 'stub1RuleC',
        message: 'SomeViolationMessage2',
        codeLocations: [
            {
                file: 'test/code-analyzer.test.ts',
                startLine: 21,
                startColumn: 7,
                endLine: 25,
                endColumn: 4
            }
        ],
        primaryLocationIndex: 0,
        resourceUrls: [
            "https://example.com/aViolationSpecificUrl1", // starting with "aViolation" so that we can test that this url comes after the rule url even though alphabetically it comes first
            "https://example.com/violationSpecificUrl2",
        ]
    };
}

export function getSampleViolationForStub1RuleE(): engApi.Violation {
    return {
        ruleName: 'stub1RuleE',
        message: 'Some Violation that contains\na new line in `it` and "various" \'quotes\'. Also it has <brackets> that may need to be {escaped}.',
        codeLocations: [
            {
                file: 'test/code-analyzer.test.ts',
                startLine: 56,
                startColumn: 4
            }
        ],
        primaryLocationIndex: 0
    };
}

export function getSampleViolationForStub2RuleC(): engApi.Violation {
    return {
        ruleName: 'stub2RuleC',
        message: 'SomeViolationMessage3',
        codeLocations: [
            {
                file: 'test/stubs.ts',
                startLine: 4,
                startColumn: 13
            },
            {
                file: 'test/test-helpers.ts',
                startLine: 9,
                startColumn: 1
            },
            {
                file: 'test/stubs.ts',
                startLine: 76,
                startColumn: 8
            }
        ],
        primaryLocationIndex: 2
    };
}

export function getSampleViolationForStub3RuleA(): engApi.Violation {
    return {
        ruleName: 'stub3RuleA',
        message: 'SomeViolationMessage4',
        codeLocations: [
            {
                file: 'test/stubs.ts',
                startLine: 20,
                startColumn: 10,
                endLine: 22,
                endColumn: 25,
                comment: 'Comment at location 1'
            },
            {
                file: 'test/test-helpers.ts',
                startLine: 5,
                startColumn: 10,
                comment: 'Comment at location 2'
            },
            {
                file: 'test/stubs.ts',
                startLine: 90,
                startColumn: 1,
                endLine: 95,
                endColumn: 10,
                // Intentionally left blank
                comment: undefined
            },
        ],
        primaryLocationIndex: 2
    }
}

export function getSampleViolationWithFixes(): engApi.Violation {
    return {
        ruleName: 'stub1RuleA',
        message: 'SomeViolationWithFixes',
        codeLocations: [
            {
                file: 'test/config.test.ts',
                startLine: 3,
                startColumn: 6,
                endLine: 3,
                endColumn: 20
            }
        ],
        primaryLocationIndex: 0,
        fixes: [
            {
                location: {
                    file: 'test/config.test.ts',
                    startLine: 3,
                    startColumn: 6,
                    endLine: 3,
                    endColumn: 20
                },
                fixedCode: 'const correctedValue = true;'
            }
        ]
    };
}

export function getSampleViolationWithSuggestions(): engApi.Violation {
    return {
        ruleName: 'stub1RuleA',
        message: 'SomeViolationWithSuggestions',
        codeLocations: [
            {
                file: 'test/config.test.ts',
                startLine: 5,
                startColumn: 1,
                endLine: 5,
                endColumn: 10
            }
        ],
        primaryLocationIndex: 0,
        suggestions: [
            {
                location: {
                    file: 'test/config.test.ts',
                    startLine: 5,
                    startColumn: 1,
                    endLine: 5,
                    endColumn: 10
                },
                message: 'Consider using a boolean literal instead'
            },
            {
                location: {
                    file: 'test/config.test.ts',
                    startLine: 5,
                    startColumn: 1,
                    endLine: 5,
                    endColumn: 10
                },
                message: 'Consider removing this unused variable'
            }
        ]
    };
}

export function getSampleViolationWithFixesAndSuggestions(): engApi.Violation {
    return {
        ruleName: 'stub1RuleC',
        message: 'SomeViolationWithBoth',
        codeLocations: [
            {
                file: 'test/code-analyzer.test.ts',
                startLine: 21,
                startColumn: 7,
                endLine: 25,
                endColumn: 4
            }
        ],
        primaryLocationIndex: 0,
        fixes: [
            {
                location: {
                    file: 'test/code-analyzer.test.ts',
                    startLine: 21,
                    startColumn: 7,
                    endLine: 21,
                    endColumn: 15
                },
                fixedCode: 'const x = 1;'
            },
            {
                location: {
                    file: 'test/code-analyzer.test.ts',
                    startLine: 23,
                    startColumn: 1,
                    endLine: 23,
                    endColumn: 10
                },
                fixedCode: 'let y = 2;'
            }
        ],
        suggestions: [
            {
                location: {
                    file: 'test/code-analyzer.test.ts',
                    startLine: 21,
                    startColumn: 7,
                    endLine: 25,
                    endColumn: 4
                },
                message: 'Refactor this block to use modern syntax'
            }
        ],
        resourceUrls: [
            "https://example.com/aViolationSpecificUrl1",
        ]
    };
}

/**
 * EmptyTagEnginePlugin - A plugin to help with testing rules with empty tags
 */
export class EmptyTagEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["emptyTags"];
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new EmptyTagEngine();
    }
}

/**
 * EmptyTagEngine - An engine to help with testing rules with empty tags
 */
class EmptyTagEngine extends engApi.Engine {
    getName(): string {
        return 'emptyTags';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('1.0.0');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [
            {
                name: "emptyTagRule",
                severityLevel: engApi.SeverityLevel.Moderate,
                tags: [], // Purposely left empty
                description: 'Some description for emptyTagRule',
                resourceUrls: [] // Purposely left empty
            }
        ]
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}

/**
 * ApexGuruEnginePlugin - A plugin to help with testing apex-guru (opt-in) rule selection behavior
 */
export class ApexGuruEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["apexGuruEngine"];
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new ApexGuruEngine();
    }
}

class ApexGuruEngine extends engApi.Engine {
    getName(): string {
        return 'apexGuruEngine';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('1.0.0');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [
            {
                name: "apexGuruRule1",
                severityLevel: engApi.SeverityLevel.Low,
                tags: ['apex-guru', 'Performance'],
                description: 'An apex-guru rule with Low severity',
                resourceUrls: []
            },
            {
                name: "apexGuruRule2",
                severityLevel: engApi.SeverityLevel.High,
                tags: ['apex-guru'],
                description: 'An apex-guru rule with High severity',
                resourceUrls: []
            }
        ];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}

/**
 * UIBundleEnginePlugin - A plugin to help with testing UIBundle opt-in rule selection behavior
 */
export class UIBundleEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["uibundleEngine"];
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new UIBundleEngine();
    }
}

class UIBundleEngine extends engApi.Engine {
    getName(): string {
        return 'uibundleEngine';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('1.0.0');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [
            {
                name: "uibundleRule1",
                severityLevel: engApi.SeverityLevel.Low,
                tags: ['UIBundle', 'UIBundleIntegrity'],
                description: 'A UIBundle rule with Low severity',
                resourceUrls: []
            },
            {
                name: "uibundleRule2",
                severityLevel: engApi.SeverityLevel.High,
                tags: ['UIBundle', 'UIBundleIntegrity'],
                description: 'A UIBundle rule with High severity',
                resourceUrls: []
            }
        ];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}

/**
 * FutureEnginePlugin - A plugin to help with testing forward compatibility
 */
export class FutureEnginePlugin extends engApi.EnginePluginV1 {
    public getApiVersion(): number {
        return 99.0; // Simulate a version from the future
    }

    getAvailableEngineNames(): string[] {
        return ["future"];
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new FutureEngine();
    }
}

/**
 * FutureEngine - An engine to help with testing forward compatibility
 */
class FutureEngine extends engApi.Engine {
    getName(): string {
        return "future";
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('2.0.0');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}

/**
 * ContradictingEnginePlugin - A plugin that returns an engine with a name that contradicts the one requested
 */
export class ContradictingEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ["stubEngine1"];
    }

    async createEngine(_engineName: string, config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new StubEngine2(config); // returns "stubEngine1" from its getName method - thus the contradiction
    }
}

/**
 * ThrowingPlugin1 - A plugin that throws an exception during a call to getAvailableEngineNames
 */
export class ThrowingPlugin1 extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        throw new Error('SomeErrorFromGetAvailableEngineNames');
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        throw new Error('Should not be called');
    }
}

/**
 * ThrowingPlugin2 - A plugin that throws an exception during a call to describeEngineConfig
 */
export class ThrowingPlugin2 extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['someEngine'];
    }

    describeEngineConfig(_engineName: string): engApi.ConfigDescription {
        throw new Error('SomeErrorFromDescribeEngineConfig')
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        throw new Error('Should not be called');
    }
}

/**
 * ThrowingPlugin3 - A plugin that throws an exception during a call to createEngineConfig
 */
export class ThrowingPlugin3 extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['someEngine'];
    }

    async createEngineConfig(_engineName: string, _configValueExtractor: engApi.ConfigValueExtractor): Promise<engApi.ConfigObject> {
        throw new Error('SomeErrorFromCreateEngineConfig')
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        throw new Error('Should not be called');
    }
}

/**
 * ThrowingPlugin4 - A plugin that throws an exception during a call to createEngine
 */
export class ThrowingPlugin4 extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['someEngine'];
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        throw new Error('SomeErrorFromCreateEngine');
    }
}

/**
 * ThrowingEnginePlugin - A plugin that returns an engine that throws an error when ran
 */
export class ThrowingEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['throwingEngine'];
    }

    async createEngine(_engineName: string, config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new ThrowingEngine(config);
    }
}

export class ThrowingEnginePlugin2 extends engApi.EnginePluginV1 {
    private readonly createdEngines: Map<string, engApi.Engine> = new Map();

    getAvailableEngineNames(): string[] {
        return ['someEngine'];
    }

    async createEngine(engineName: string, config: engApi.ConfigObject): Promise<engApi.Engine> {
        if (engineName === 'someEngine') {
            this.createdEngines.set(engineName, new ThrowingEngine2(config));
        } else {
            throw new Error(`Unsupported engine name: ${engineName}`);
        }
        return this.getCreatedEngine(engineName);
    }

    getCreatedEngine(engineName: string): engApi.Engine {
        if (this.createdEngines.has(engineName)) {
            return this.createdEngines.get(engineName) as engApi.Engine;
        }
        throw new Error(`Engine with name ${engineName} has not yet been created`);
    }
}

/**
 * ThrowingEngine - An engine that throws an error when ran
 */
export class ThrowingEngine extends StubEngine1 {
    constructor(config: engApi.ConfigObject) {
        super(config);
    }

    getName(): string {
        return "throwingEngine";
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('3.0.0');
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        throw new Error('SomeErrorMessageFromThrowingEngine');
    }
}

class ThrowingEngine2 extends engApi.Engine {
    constructor(_config: engApi.ConfigObject) {
        super();
    }

    getName(): string {
        return "someEngine";
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('0.0.1');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        throw new Error('SomeErrorFromDescribeRules');
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        throw new Error('This method should never be called');
    }
}

/**
 * RepeatedRuleNameEnginePlugin - A plugin that returns an engine that returns multiple rules with the same name
 */
export class RepeatedRuleNameEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['repeatedRuleNameEngine'];
    }

    async createEngine(_engineName: string, _config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new RepeatedRuleNameEngine();
    }
}

/**
 * RepeatedRuleNameEngine - An engine that returns multiple rules with the same name
 */
class RepeatedRuleNameEngine extends engApi.Engine {
    getName(): string {
        return 'repeatedRuleNameEngine';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('4.0.0');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [
            {
                name: "repeatedRule",
                severityLevel: engApi.SeverityLevel.Moderate,
                tags: ["Recommended", "Security"],
                description: "Some description 1",
                resourceUrls: ["https://example.com/repeatedRule1"]
            },
            {
                name: "repeatedRule", // Same name as above
                severityLevel: engApi.SeverityLevel.Low,
                tags: ["Performance", "Custom"],
                description: "Some description 2",
                resourceUrls: ["https://example.com/repeatedRule2"]
            }
        ];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return { violations: [] };
    }
}


export class FlexibleEnginePlugin extends engApi.EnginePluginV1 {
    private readonly engines: engApi.Engine[];
    constructor(engines: engApi.Engine[]) {
        super();
        this.engines = engines;
    }

    getAvailableEngineNames(): string[] {
        return this.engines.map(e => e.getName());
    }

    createEngine(engineName: string, _resolvedConfig: engApi.ConfigObject): Promise<engApi.Engine> {
        const engine: engApi.Engine | undefined = this.engines.find(e => e.getName() === engineName);
        if (engine) {
            return Promise.resolve(engine);
        }
        throw new Error(`No engine with name '${engineName}' found.`);
    }
}

export class EngineWithRunMethodThatIssuesErrorLog extends engApi.Engine {
    getName(): string {
        return 'engineWithRunMethodThatIssuesErrorLog';
    }

    describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return Promise.resolve([{
            name: 'someRule',
            severityLevel: 3,
            tags: [],
            description: 'someDescription',
            resourceUrls: []
        }]);
    }

    runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        this.emitLogEvent(LogLevel.Error, 'Some Error Log');
        return Promise.resolve({violations: []});
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('1.0.0');
    }

}
