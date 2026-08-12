import {CodeAnalyzer, CodeAnalyzerConfig, EventType, LogEvent, RuleSelection} from "../src";
import {changeWorkingDirectoryToPackageRoot, FakeFileSystem, FixedUniqueIdGenerator} from "./test-helpers";
import * as engApi from "@salesforce/code-analyzer-engine-api";

/**
 * Regression test for the H1 bug bounty finding:
 *   An auto-discovered code-analyzer.yml that sets engines.pmd.java_command to a repository-relative executable path
 *   (e.g. './scripts/afv-pmd-java') used to be spawned during the eager per-engine config extraction that happens on
 *   addEnginePlugin, even when the user only requested the eslint engine via 'sf code-analyzer rules --rule-selector
 *   eslint'. This resulted in arbitrary repo-controlled code execution.
 *
 * These tests lock in the two layers of the fix:
 *   1. A relative java_command must be rejected during config validation WITHOUT ever spawning the binary (asserted by
 *      a JavaVersionIdentifier spy that fails the test if it is ever asked to identify the java version).
 *   2. Core's per-engine try/catch isolation must let an eslint-only run continue to select the eslint rules even when
 *      the pmd engine failed to instantiate because of the malicious config (defense-in-depth ordering).
 */
describe("Security regression: relative java_command in an auto-discovered config is never spawned", () => {
    changeWorkingDirectoryToPackageRoot();

    let codeAnalyzer: CodeAnalyzer;
    let logEvents: LogEvent[];

    // The malicious auto-discovered config, expressed as engine overrides just like an auto-discovered
    // code-analyzer.yml would be parsed into.
    const MALICIOUS_CONFIG: object = {
        engines: {
            stubPmd: {
                java_command: './scripts/afv-pmd-java'
            }
        }
    };

    beforeEach(() => {
        codeAnalyzer = new CodeAnalyzer(CodeAnalyzerConfig.fromObject(MALICIOUS_CONFIG), new FakeFileSystem());
        codeAnalyzer._setUniqueIdGenerator(new FixedUniqueIdGenerator());
        logEvents = [];
        codeAnalyzer.onEvent(EventType.LogEvent, (event: LogEvent) => logEvents.push(event));
    });

    it("An eslint-only run with a malicious relative java_command never spawns the binary and still selects eslint rules", async () => {
        const javaVersionSpy: ThrowIfCalledJavaVersionIdentifier = new ThrowIfCalledJavaVersionIdentifier();
        const pmdPlugin: StubPmdEnginePlugin = new StubPmdEnginePlugin(javaVersionSpy);
        const eslintPlugin: StubEslintEnginePlugin = new StubEslintEnginePlugin();

        // Adding the malicious PMD-like plugin must not throw even though its config extraction fails.
        await expect(codeAnalyzer.addEnginePlugin(pmdPlugin)).resolves.not.toThrow();
        await expect(codeAnalyzer.addEnginePlugin(eslintPlugin)).resolves.not.toThrow();

        // Acceptance criterion #2 & repro: the relative-path binary was never spawned.
        expect(javaVersionSpy.wasCalled).toEqual(false);

        // Acceptance criterion #1: the pmd engine failed to instantiate (bad config) and was NOT added.
        expect(codeAnalyzer.getEngineNames()).not.toContain('stubPmd');
        expect(() => codeAnalyzer.getEngineConfig('stubPmd')).toThrow();

        // Per-engine failure isolation: the eslint engine was still added successfully.
        expect(codeAnalyzer.getEngineNames()).toContain('stubEslint');

        // Acceptance criterion #4: an eslint-only rule selection still succeeds and returns the eslint rules.
        const selection: RuleSelection = await codeAnalyzer.selectRules(['stubEslint']);
        expect(selection.getEngineNames()).toEqual(['stubEslint']);
        expect(selection.getRulesFor('stubEslint').map(r => r.getName())).toEqual(['eslintRule']);

        // The pmd engine failure should have been surfaced as a log event rather than silently swallowed.
        const errorLogMessages: string[] = logEvents.map(e => e.message);
        expect(errorLogMessages.some(m => m.includes('stubPmd'))).toEqual(true);
    });

    it("A malicious relative java_command is rejected with a clear validation error mentioning the field and reason", async () => {
        const javaVersionSpy: ThrowIfCalledJavaVersionIdentifier = new ThrowIfCalledJavaVersionIdentifier();
        await codeAnalyzer.addEnginePlugin(new StubPmdEnginePlugin(javaVersionSpy));

        expect(javaVersionSpy.wasCalled).toEqual(false);
        const combinedLogText: string = logEvents.map(e => e.message).join('\n');
        expect(combinedLogText).toContain(`The 'engines.stubPmd.java_command' configuration value is invalid.`);
        expect(combinedLogText).toContain('relative file paths are not allowed');
    });
});

/**
 * A JavaVersionIdentifier spy that stands in for the real one that spawns 'java -version'. It fails the test if it is
 * ever invoked, which is exactly what would happen if a relative java_command were passed through to be spawned.
 */
class ThrowIfCalledJavaVersionIdentifier {
    wasCalled: boolean = false;

    identifyJavaVersion(_javaCommand: string): Promise<string | null> {
        this.wasCalled = true;
        return Promise.reject(new Error('spawn must not be called for a relative java_command'));
    }
}

/**
 * A minimal PMD-like engine plugin that mirrors the real pmd-engine's extractJavaCommand ordering: it validates the
 * java_command value using the shared ValueValidator.validateJavaCommand helper (rejecting relative paths) BEFORE it
 * ever asks the JavaVersionIdentifier to spawn the command.
 */
class StubPmdEnginePlugin extends engApi.EnginePluginV1 {
    private readonly javaVersionIdentifier: ThrowIfCalledJavaVersionIdentifier;

    constructor(javaVersionIdentifier: ThrowIfCalledJavaVersionIdentifier) {
        super();
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    getAvailableEngineNames(): string[] {
        return ['stubPmd'];
    }

    describeEngineConfig(_engineName: string): engApi.ConfigDescription {
        return {};
    }

    async createEngineConfig(engineName: string, configValueExtractor: engApi.ConfigValueExtractor): Promise<engApi.ConfigObject> {
        const javaCommand: string | undefined = configValueExtractor.extractString('java_command');
        if (javaCommand) {
            try {
                // Reject relative paths BEFORE spawning, exactly like the real SharedConfigValueExtractor now does.
                engApi.ValueValidator.validateJavaCommand(javaCommand, configValueExtractor.getFieldPath('java_command'));
                await this.javaVersionIdentifier.identifyJavaVersion(javaCommand);
            } catch (err) {
                throw new Error(`The '${configValueExtractor.getFieldPath('java_command')}' configuration value is invalid. ${(err as Error).message}`, {cause: err});
            }
        }
        return {...configValueExtractor.getObject(), engine_name: engineName};
    }

    async createEngine(_engineName: string, config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new StubPmdEngine(config);
    }
}

class StubPmdEngine extends engApi.Engine {
    constructor(_config: engApi.ConfigObject) {
        super();
    }

    getName(): string {
        return 'stubPmd';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('0.0.1');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [{
            name: 'pmdRule',
            severityLevel: engApi.SeverityLevel.Moderate,
            tags: ['Recommended'],
            description: 'Some pmd rule',
            resourceUrls: []
        }];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return {violations: []};
    }
}

/**
 * A minimal ESLint-like engine plugin whose config extraction has no java_command and thus always succeeds.
 */
class StubEslintEnginePlugin extends engApi.EnginePluginV1 {
    getAvailableEngineNames(): string[] {
        return ['stubEslint'];
    }

    describeEngineConfig(_engineName: string): engApi.ConfigDescription {
        return {};
    }

    async createEngineConfig(engineName: string, configValueExtractor: engApi.ConfigValueExtractor): Promise<engApi.ConfigObject> {
        return {...configValueExtractor.getObject(), engine_name: engineName};
    }

    async createEngine(_engineName: string, config: engApi.ConfigObject): Promise<engApi.Engine> {
        return new StubEslintEngine(config);
    }
}

class StubEslintEngine extends engApi.Engine {
    constructor(_config: engApi.ConfigObject) {
        super();
    }

    getName(): string {
        return 'stubEslint';
    }

    getEngineVersion(): Promise<string> {
        return Promise.resolve('0.0.1');
    }

    async describeRules(_describeOptions: engApi.DescribeOptions): Promise<engApi.RuleDescription[]> {
        return [{
            name: 'eslintRule',
            severityLevel: engApi.SeverityLevel.Moderate,
            tags: ['Recommended'],
            description: 'Some eslint rule',
            resourceUrls: []
        }];
    }

    async runRules(_ruleNames: string[], _runOptions: engApi.RunOptions): Promise<engApi.EngineRunResults> {
        return {violations: []};
    }
}
