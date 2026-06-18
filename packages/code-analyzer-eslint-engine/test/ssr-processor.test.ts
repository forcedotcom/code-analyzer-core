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
const workspaceWithSSRLwc: string = path.join(testDataFolder, 'workspaceWithSSRLwc');

const SSR_RULE_NAMES: string[] = [
    '@lwc/lwc/ssr-no-restricted-browser-globals',
    '@lwc/lwc/ssr-no-node-env',
];

function createSSRConfigObject(): ConfigObject {
    return {
        // auto_discover_eslint_config picks up the eslint.config.js in each test workspace,
        // which enables the SSR rules we want to assert against
        auto_discover_eslint_config: true,
        file_extensions: {
            javascript: ['.js'],
            typescript: ['.ts'],
            html: ['.html'],
            css: ['.css'],
            other: []
        },
        config_root: __dirname
    };
}

async function createEngineFromPlugin(configObject: ConfigObject): Promise<Engine> {
    const plugin: ESLintEnginePlugin = new ESLintEnginePlugin();
    const engine: ESLintEngine = await plugin.createEngine('eslint', configObject);
    engine._runESLintWorkerTask._runInCurrentThreadInsteadofNewThread = true;
    return engine;
}

describe('SSR Processor Configuration', () => {
    describe('Issue 2049: SSR rules should only apply to SSR-enabled components', () => {
        it('should not report SSR rule violations on non-SSR LWC components', async () => {
            const engine: Engine = await createEngineFromPlugin(createSSRConfigObject());
            const workspace: Workspace = new Workspace('test', [workspaceWithNonSSRLwc],
                [path.join(workspaceWithNonSSRLwc, 'helloWorld.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(SSR_RULE_NAMES, runOptions);

            // The SSR processor should filter out SSR rules for non-SSR components
            // (no lightning__ServerRenderable capability in -meta.xml)
            expect(results.violations).toBeDefined();
            const ssrViolations = results.violations.filter(v =>
                v.ruleName && v.ruleName.includes('ssr-')
            );
            expect(ssrViolations.length).toBe(0);
        });

        it('should report SSR rule violations on SSR-enabled LWC components', async () => {
            const engine: Engine = await createEngineFromPlugin(createSSRConfigObject());
            const workspace: Workspace = new Workspace('test', [workspaceWithSSRLwc],
                [path.join(workspaceWithSSRLwc, 'helloWorld.js')]);

            // The SSR processor should create a virtual .ssrjs file for this component
            // since its -meta.xml declares lightning__ServerRenderable capability
            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(SSR_RULE_NAMES, runOptions);

            expect(results.violations).toBeDefined();
            const ssrViolations = results.violations.filter(v =>
                v.ruleName && v.ruleName.includes('ssr-')
            );
            expect(ssrViolations.length).toBeGreaterThan(0);
        });

        it('should parse files without errors when SSR processor is configured', async () => {
            const engine: Engine = await createEngineFromPlugin(createSSRConfigObject());
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
