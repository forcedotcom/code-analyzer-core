import {
    ConfigObject,
    Engine,
    EngineRunResults,
    RunOptions,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import * as path from "node:path";
import {ESLintEnginePlugin} from "../src";
import {ESLintEngine} from "../src/engine";
import {createRunOptions} from "./test-helpers";

jest.setTimeout(60_000);

const testDataFolder: string = path.join(__dirname, 'test-data');
const workspaceWithNonSSRLwc: string = path.join(testDataFolder, 'workspaceWithNonSSRLwc');

async function createEngineFromPlugin(configObject: ConfigObject): Promise<Engine> {
    const plugin: ESLintEnginePlugin = new ESLintEnginePlugin();
    const engine: ESLintEngine = await plugin.createEngine('eslint', configObject);
    engine._runESLintWorkerTask._runInCurrentThreadInsteadofNewThread = true;
    return engine;
}

describe('SSR Processor Configuration', () => {
    describe('Issue 2049: SSR rules should only apply to SSR-enabled components', () => {
        it('should not report SSR rule violations on non-SSR LWC components', async () => {
            // Setup: Default config with LWC enabled
            const defaultConfig: ConfigObject = {
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(defaultConfig);
            const workspace: Workspace = new Workspace('test', [workspaceWithNonSSRLwc],
                [path.join(workspaceWithNonSSRLwc, 'helloWorld.js')]);

            // Act: Run the engine - the SSR rules are automatically enabled by LWC recommended config
            const runOptions: RunOptions = createRunOptions(workspace);
            // Run all rules to trigger SSR rules from the LWC recommended config
            // Use empty array to run all configured rules
            const results: EngineRunResults = await engine.runRules([], runOptions);

            // Assert: Non-SSR component should NOT have SSR rule violations
            // The SSR processor should filter out SSR rules for non-SSR components
            expect(results.violations).toBeDefined();
            const ssrViolations = results.violations.filter(v =>
                v.ruleName && v.ruleName.includes('ssr-')
            );
            // Without the processor configured, this will fail because SSR rules will fire
            // With the processor configured, SSR rules only fire on SSR-enabled components
            expect(ssrViolations.length).toBe(0);
        });

        it('should parse files without errors when SSR processor is configured', async () => {
            const defaultConfig: ConfigObject = {
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(defaultConfig);
            const workspace: Workspace = new Workspace('test', [workspaceWithNonSSRLwc],
                [path.join(workspaceWithNonSSRLwc, 'helloWorld.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should not have parsing errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });
});
