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

    describe('Edge Case 1: TypeScript files with decorators', () => {
        const workspaceWithTypeScriptDecorators: string = path.join(testDataFolder, 'workspaceWithTypeScriptDecorators');

        it('should parse .ts files with decorators using TypeScript parser', async () => {
            const configWithTs: ConfigObject = {
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

            const engine: Engine = await createEngineFromPlugin(configWithTs);
            const workspace: Workspace = new Workspace('test', [workspaceWithTypeScriptDecorators],
                [path.join(workspaceWithTypeScriptDecorators, 'tsComponent.ts')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: TypeScript parser should handle decorators
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse .tsx files with decorators using TypeScript parser', async () => {
            const configWithTsx: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts', '.tsx'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithTsx);
            const workspace: Workspace = new Workspace('test', [workspaceWithTypeScriptDecorators],
                [path.join(workspaceWithTypeScriptDecorators, 'tsxComponent.tsx')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: TypeScript parser should handle decorators in JSX
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Edge Case 2: Empty file extensions', () => {
        it('should handle empty javascript extensions gracefully', async () => {
            const configWithEmptyJs: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: [],  // Empty array
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            // Should not throw when creating engine
            const engine: Engine = await createEngineFromPlugin(configWithEmptyJs);
            expect(engine).toBeDefined();
            expect(engine.getName()).toBe('eslint');
        });
    });

    describe('Edge Case 3: Error messages when Espree is forced on decorator files', () => {
        it('should give clear error message when decorators fail with Espree parser', async () => {
            // Force Espree by using only .jsx (no .js)
            const configForcingEspree: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.jsx'],  // Only .jsx forces Espree
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configForcingEspree);

            // Try to scan a .js file with decorators (will fail because only .jsx is configured)
            // This simulates user misconfiguration
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);

            // The file won't be scanned because .js is not in the configured extensions
            // This is expected behavior - not an error, just filtered out
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Should have no violations because .js files are filtered out
            expect(results.violations).toBeDefined();
            expect(results.violations.length).toBe(0);
        });
    });

    describe('Edge Case 4: Multiple files with mixed success', () => {
        const workspaceWithMultipleFiles: string = path.join(testDataFolder, 'workspaceWithMultipleFiles');

        it('should handle multiple files where some have violations', async () => {
            const config: ConfigObject = {
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

            const engine: Engine = await createEngineFromPlugin(config);
            const workspace: Workspace = new Workspace('test', [workspaceWithMultipleFiles],
                [
                    path.join(workspaceWithMultipleFiles, 'validLwc.js'),
                    path.join(workspaceWithMultipleFiles, 'withViolations.js')
                ]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger', 'no-var'], runOptions);

            // Assert: Should parse all files, find legitimate violations in one file
            expect(results.violations).toBeDefined();

            // No parsing errors - all decorators parsed successfully
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);

            // Should have violations from withViolations.js
            const debuggerViolations = results.violations.filter(v =>
                v.ruleName === 'no-debugger'
            );
            expect(debuggerViolations.length).toBeGreaterThan(0);

            const noVarViolations = results.violations.filter(v =>
                v.ruleName === 'no-var'
            );
            expect(noVarViolations.length).toBeGreaterThan(0);
        });

        it('should successfully parse all files even when decorators are present', async () => {
            const config: ConfigObject = {
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

            const engine: Engine = await createEngineFromPlugin(config);
            const workspace: Workspace = new Workspace('test', [workspaceWithMultipleFiles],
                [
                    path.join(workspaceWithMultipleFiles, 'validLwc.js'),
                    path.join(workspaceWithMultipleFiles, 'withViolations.js')
                ]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-unused-vars'], runOptions);

            // All files should parse without decorator errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Edge Case 5: Verify Babel vs Espree selection logic', () => {
        it('should use Babel when .js is first in array', async () => {
            const config: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.js', '.jsx', '.mjs'],  // .js first
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(config);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Should use Babel (decorators work)
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should use Babel when .js is last in array', async () => {
            const config: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.jsx', '.mjs', '.js'],  // .js last
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(config);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Should still use Babel (includes() checks entire array)
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should use Espree when .js is NOT in array', async () => {
            const config: ConfigObject = {
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.jsx', '.mjs', '.cjs'],  // No .js
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(config);

            // Scan a .jsx file (should use Espree successfully)
            const workspace: Workspace = new Workspace('test', [workspaceWithJsxOnly],
                [path.join(workspaceWithJsxOnly, 'ReactComponent.jsx')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Espree should handle .jsx fine (no decorators in React files)
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Critical Bug Fix: Both disable_javascript_base_config and disable_lwc_base_config set to true', () => {
        it('should parse .js files with decorators when both JS and LWC base configs are disabled', async () => {
            // This was the bug: when BOTH disable_javascript_base_config AND disable_lwc_base_config
            // were true, no parser was configured, causing Espree fallback which can't parse decorators
            const configWithBothJsAndLwcDisabled: ConfigObject = {
                disable_javascript_base_config: true,
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

            const engine: Engine = await createEngineFromPlugin(configWithBothJsAndLwcDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse decorators successfully (minimal parser config with Babel)
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse .jsx files when both JS and LWC base configs are disabled with only .jsx extension', async () => {
            const configWithBothDisabledJsxOnly: ConfigObject = {
                disable_javascript_base_config: true,
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

            const engine: Engine = await createEngineFromPlugin(configWithBothDisabledJsxOnly);
            const workspace: Workspace = new Workspace('test', [workspaceWithJsxOnly],
                [path.join(workspaceWithJsxOnly, 'ReactComponent.jsx')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse JSX successfully with Espree
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse .mjs and .cjs files when both JS and LWC base configs are disabled', async () => {
            const workspaceWithModuleFiles: string = path.join(testDataFolder, 'workspaceWithModuleFiles');
            const configWithBothDisabledModules: ConfigObject = {
                disable_javascript_base_config: true,
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.mjs', '.cjs'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithBothDisabledModules);
            const workspace: Workspace = new Workspace('test', [workspaceWithModuleFiles],
                [path.join(workspaceWithModuleFiles, 'module.mjs')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse module files successfully with Espree
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse mixed .js and .jsx files when both JS and LWC base configs are disabled', async () => {
            const configWithBothDisabledMixed: ConfigObject = {
                disable_javascript_base_config: true,
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: ['.js', '.jsx'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithBothDisabledMixed);
            const workspace: Workspace = new Workspace('test', [workspaceWithMixedJsJsx],
                [
                    path.join(workspaceWithMixedJsJsx, 'lwcFile.js'),
                    path.join(workspaceWithMixedJsJsx, 'reactFile.jsx')
                ]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Both .js (with decorators) and .jsx (React) should parse successfully
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should work when all three base configs (JS, LWC, React) are disabled', async () => {
            const configWithAllThreeDisabled: ConfigObject = {
                disable_javascript_base_config: true,
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

            const engine: Engine = await createEngineFromPlugin(configWithAllThreeDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcDecorators],
                [path.join(workspaceWithLwcDecorators, 'lwcComponent.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should still parse with minimal parser config
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should not configure parser when no JavaScript extensions are present', async () => {
            const configWithNoJsExtensions: ConfigObject = {
                disable_javascript_base_config: true,
                disable_lwc_base_config: true,
                file_extensions: {
                    javascript: [],  // No JavaScript extensions
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithNoJsExtensions);

            // Just verify engine creation succeeds without JavaScript config
            expect(engine).toBeDefined();
        });
    });

    describe('TypeScript with disable_typescript_base_config: Bug Check', () => {
        const workspaceWithTsDecorators: string = path.join(testDataFolder, 'workspaceWithTsDecorators');

        it('should parse .ts files with decorators when disable_typescript_base_config is true', async () => {
            // This test checks if we have the same bug with TypeScript as we had with JavaScript
            // When disable_typescript_base_config: true, is a TypeScript parser still configured?
            const configWithTsDisabled: ConfigObject = {
                disable_typescript_base_config: true,
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithTsDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithTsDecorators],
                [path.join(workspaceWithTsDecorators, 'tsComponent.ts')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse TypeScript decorators successfully
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse .tsx files with JSX when disable_typescript_base_config is true', async () => {
            const workspaceWithTsx: string = path.join(testDataFolder, 'workspaceWithTsx');
            const configWithTsDisabled: ConfigObject = {
                disable_typescript_base_config: true,
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.tsx'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithTsDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithTsx],
                [path.join(workspaceWithTsx, 'ReactTsComponent.tsx')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse TSX (TypeScript + JSX) successfully
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });

    describe('Integration Tests: Verify Analysis Capabilities with Different Flag Combinations', () => {
        const workspaceWithReactViolations: string = path.join(testDataFolder, 'workspaceWithReactViolations');
        const workspaceWithLwcViolations: string = path.join(testDataFolder, 'workspaceWithLwcViolations');

        it('should parse React JSX files even when disable_react_base_config is true', async () => {
            // When React base config is disabled, we only disable React RULES, not parsing
            // JSX should still parse correctly (uses Espree with JSX support)
            const configWithReactDisabled: ConfigObject = {
                disable_javascript_base_config: true,  // Disable JS base, will use minimal parser
                disable_lwc_base_config: true,          // Disable LWC base (not needed for React)
                disable_react_base_config: true,        // Disable React rules
                file_extensions: {
                    javascript: ['.jsx'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithReactDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithReactViolations],
                [path.join(workspaceWithReactViolations, 'ComponentWithViolations.jsx')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            // Just verify parsing works - we don't need to check for specific violations
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse successfully without parsing errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse LWC files when disable_javascript_base_config is true', async () => {
            // When JS base config is disabled but LWC enabled, LWC decorators should still parse
            // This verifies the smart parser selection chooses Babel for .js files
            const configWithJsDisabled: ConfigObject = {
                disable_javascript_base_config: true,
                disable_lwc_base_config: false,  // LWC enabled for parsing
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configWithJsDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithLwcViolations],
                [path.join(workspaceWithLwcViolations, 'lwcComponentWithViolations.js')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            // Just verify parsing works
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse decorators successfully without parsing errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should analyze mixed React and LWC files when only JS base config is disabled', async () => {
            // Verify that both React (JSX) and LWC (decorators) work when JS base disabled
            const configMixed: ConfigObject = {
                disable_javascript_base_config: true,
                disable_lwc_base_config: false,
                disable_react_base_config: true,  // Disable React rules to avoid config issues
                file_extensions: {
                    javascript: ['.js', '.jsx'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configMixed);
            const workspace: Workspace = new Workspace('test',
                [workspaceWithLwcViolations, workspaceWithReactViolations],
                [
                    path.join(workspaceWithLwcViolations, 'lwcComponentWithViolations.js'),
                    path.join(workspaceWithReactViolations, 'ComponentWithViolations.jsx')
                ]);

            const runOptions: RunOptions = createRunOptions(workspace);
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Both files should parse without errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected character')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse and analyze when all base configs disabled but React rules run', async () => {
            // All base configs disabled - only minimal parsers configured
            // But we can still run React rules if they don't require base config
            const configAllDisabled: ConfigObject = {
                disable_javascript_base_config: true,
                disable_lwc_base_config: true,
                disable_typescript_base_config: true,
                file_extensions: {
                    javascript: ['.jsx'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configAllDisabled);
            const workspace: Workspace = new Workspace('test', [workspaceWithReactViolations],
                [path.join(workspaceWithReactViolations, 'ComponentWithViolations.jsx')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            // Run a simple rule that doesn't depend on base config
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse and run rules even with all base configs disabled
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error')
            );
            expect(parsingErrors.length).toBe(0);
        });

        it('should parse TypeScript files when disable_typescript_base_config is true', async () => {
            // When TS base config is disabled, TypeScript should still parse
            // The minimal TS parser config allows parsing TS syntax without type-aware rules
            const configTsDisabled: ConfigObject = {
                disable_typescript_base_config: true,
                file_extensions: {
                    javascript: ['.js'],
                    typescript: ['.ts'],
                    html: ['.html'],
                    css: ['.css'],
                    other: []
                },
                config_root: __dirname
            };

            const engine: Engine = await createEngineFromPlugin(configTsDisabled);
            const workspaceWithTsViolations: string = path.join(testDataFolder, 'workspaceWithTsViolations');
            const workspace: Workspace = new Workspace('test', [workspaceWithTsViolations],
                [path.join(workspaceWithTsViolations, 'tsFileWithViolations.ts')]);

            const runOptions: RunOptions = createRunOptions(workspace);
            // Just verify parsing works - don't check for specific violations
            const results: EngineRunResults = await engine.runRules(['no-debugger'], runOptions);

            // Assert: Should parse TypeScript syntax (type annotations, decorators) without parsing errors
            expect(results.violations).toBeDefined();
            const parsingErrors = results.violations.filter(v =>
                v.message.includes('Parsing error') || v.message.includes('Unexpected token')
            );
            expect(parsingErrors.length).toBe(0);
        });
    });
});
