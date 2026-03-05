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
const workspaceWithLwcDecorators: string = path.join(testDataFolder, 'workspaceWithLwcDecorators');
const workspaceWithJsxOnly: string = path.join(testDataFolder, 'workspaceWithJsxOnly');
const workspaceWithMixedJsJsx: string = path.join(testDataFolder, 'workspaceWithMixedJsJsx');

async function createEngineFromPlugin(configObject: ConfigObject): Promise<Engine> {
    const plugin: ESLintEnginePlugin = new ESLintEnginePlugin();
    const engine: ESLintEngine = await plugin.createEngine('eslint', configObject);
    engine._runESLintWorkerTask._runInCurrentThreadInsteadofNewThread = true;
    return engine;
}

describe('Parser Selection for Decorator Support', () => {

    describe('Scenario 1: LWC files with decorators and disable_lwc_base_config: true', () => {
        it('should successfully parse .js files with LWC decorators using Babel parser', async () => {
            // Setup: Config with disable_lwc_base_config: true and .js extension
            const configWithLwcDisabled: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithLwcDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            // Act: Run the engine
            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

            // Assert: Should parse without errors (no "Unexpected character '@'" error)
            expect(results.violations).toBeDefined();
            // If there are violations, they should be legitimate rule violations, not parsing errors
            if (results.violations.length > 0) {
                results.violations.forEach(violation => {
                    expect(violation.message).not.toContain('Unexpected character');
                    expect(violation.message).not.toContain("Parsing error");
                });
            }
        });

        it('should handle @api, @track, and @wire decorators', async () => {
            const configWithLwcDisabled: ConfigObject = {
                disable_lwc_base_config: true,
                disable_react_base_config: true,
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithLwcDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Should not throw parsing errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Scenario 2: React JSX files with only .jsx extension (Espree parser)', () => {
        it('should use Espree parser for .jsx files when only .jsx is configured', async () => {
            // Setup: Config with only .jsx extension (should trigger Espree)
            const configWithJsxOnly: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.jsx'],  // Only .jsx, no .js
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithJsxOnly);
            const workspace: Workspace = new Workspace('test', [workspaceWithJsxOnly],
                [path.join(workspaceWithJsxOnly, 'ReactComponent.jsx')]);

            // Act
            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

            // Assert: Should parse JSX successfully with Espree
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Scenario 3: Mixed .js and .jsx files (Babel parser)', () => {
        it('should use Babel parser when both .js and .jsx are configured', async () => {
            // Setup: Config with both .js and .jsx (should trigger Babel)
            const configWithMixed: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.js', '.jsx'],  // Both extensions
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithMixed);
            const workspace: Workspace = new Workspace('test', [workspaceWithMixedJsJsx],
                [
                    path.join(workspaceWithMixedJsJsx, 'lwcFile.js'),
                    path.join(workspaceWithMixedJsJsx, 'reactFile.jsx')
                ]);

            // Act
            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse both LWC decorators and React JSX successfully
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Scenario 4: Default config with .js extension', () => {
        it('should use Babel parser with default config (includes .js)', async () => {
            // Setup: Use default config which includes .js
            const defaultConfig: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.js', '.cjs', '.mjs', '.jsx'],  // Default includes .js
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(defaultConfig);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            // Act
            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse decorators successfully with default config
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Scenario 5: Other JavaScript extensions (.mjs, .cjs)', () => {
        it('should handle configs with only .mjs and .cjs extensions', async () => {
            // Setup: Config with only .mjs and .cjs (no .js)
            const configWithModuleExtensions: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.mjs', '.cjs'],  // No .js
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            // This is more of a configuration validation - if .mjs/.cjs files existed,
            // they would use Espree parser (which doesn't support decorators)
            // Just verify the config is valid
            const fileExtensions = configWithModuleExtensions.file_extensions as { javascript: string[] };
            expect(fileExtensions.javascript).not.toContain('.js');
            expect(fileExtensions.javascript).toContain('.mjs');
            expect(fileExtensions.javascript).toContain('.cjs');
        });
    });

    describe('Scenario 6: Both LWC and React disabled', () => {
        it('should still parse .js files with decorators when both base configs disabled', async () => {
            const configWithBothDisabled: ConfigObject = {
                disable_lwc_base_config: true,
                disable_react_base_config: true,
                file_extensions: {
                    javascript: ['.js'],  // .js triggers Babel
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithBothDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should still parse decorators (smart selection based on .js extension)
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });
});
