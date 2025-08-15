import * as path from "node:path";
import process from "node:process";
import {ESLint} from "eslint";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {DEFAULT_CONFIG, ESLintEngineConfig, FileExtensionsObject} from "../src/config";
import {ESLintOptionsFactory, stringifyESLintOptions} from "../src/eslint-wrapper";
import {ESLintWorkspace} from "../src/workspace";

const DEFAULT_CONFIG_FOR_TESTING: ESLintEngineConfig = {
    ...DEFAULT_CONFIG,
    config_root: __dirname
}
const testDataFolder: string = path.join(__dirname, 'test-data');

describe("Miscellaneous tests that test sensitive implementation details more directly", () => {
    it("Make sure that the ESLint.Options can be stringified to an output that is no larger than 1000 lines", async () => {
        const eslintOptionsFactory: ESLintOptionsFactory = new ESLintOptionsFactory();
        const eslintOptions: ESLint.Options = await eslintOptionsFactory.createESLintOptions(
            DEFAULT_CONFIG_FOR_TESTING, __dirname, undefined);
        eslintOptions.ruleFilter = () => true; // Doesn't matter
        const optionsString: string = stringifyESLintOptions(eslintOptions);
        const numLines: number = optionsString.split('\n').length;
        expect(numLines).toBeLessThanOrEqual(1000);

        // Checking a few substrings as sanity checks:
        expect(optionsString).toContain('"baseConfig":');
        expect(optionsString).toContain('"name": "@lwc/eslint-plugin-lwc"');
        expect(optionsString).toContain('"@typescript-eslint/no-unsafe-return": "error"');
        expect(optionsString).toContain('"ruleFilter": "[Function]"');
    });

    describe('Tests for SpecifiedESLintWorkspace > getBaseDirectory', () => {
        const sampleCurrentFolder: string = path.join(testDataFolder, 'workspaceWithUnparsableCode');
        const fileExts: FileExtensionsObject = {
            javascript: ['.js'],
            typescript: ['.ts'],
            html: ['.html'],
            other: []
        }

        let original_working_directory: string;
        beforeAll(() => {
            original_working_directory = process.cwd();
            process.chdir(sampleCurrentFolder);

        });
        afterAll(() => {
            process.chdir(original_working_directory);
        });

        it('When there are no relevant files in the workspace, then cwd is used', async () => {
            const workspace: Workspace = new Workspace('id', [testDataFolder], [path.join(testDataFolder, 'tsconfig.json')]);
            const sfcaConfigRoot: string = __dirname;
            const eslintWorkspace: ESLintWorkspace = ESLintWorkspace.from(
                workspace, sfcaConfigRoot, fileExts);

            const baseDir: string = await eslintWorkspace.getBaseDirectory();
            expect(baseDir).toEqual(sampleCurrentFolder);
        });

        it('When the relevant files are under the folder containing the supplied eslint config file, then use that folder', async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(testDataFolder, 'workspaceWithFlatConfigJs','dummy1.js'),
                path.join(testDataFolder, 'workspaceWithFlatConfigJs','dummy2.ts')
            ]);
            const sfcaConfigRoot: string = __dirname;
            const eslintConfigFile: string = path.join(testDataFolder, 'workspaceWithFlatConfigJs', 'eslint.config.js');

            const eslintWorkspace: ESLintWorkspace = ESLintWorkspace.from(
                workspace, sfcaConfigRoot, fileExts, eslintConfigFile);
            const baseDir: string = await eslintWorkspace.getBaseDirectory();
            expect(baseDir).toEqual(path.join(testDataFolder, 'workspaceWithFlatConfigJs'));
        });

        it('When the relevant files are not under the folder with the eslint config file but are under the config root, then use the config root', async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(testDataFolder, 'workspaceWithFlatConfigJs','dummy1.js'),
                path.join(testDataFolder, 'workspaceWithFlatConfigMjs','dummy1.js')
            ]);
            const sfcaConfigRoot: string = testDataFolder;
            const eslintConfigFile: string = path.join(testDataFolder, 'workspaceWithFlatConfigJs', 'eslint.config.js');

            const eslintWorkspace: ESLintWorkspace = ESLintWorkspace.from(
                workspace, sfcaConfigRoot, fileExts, eslintConfigFile);
            const baseDir: string = await eslintWorkspace.getBaseDirectory();
            expect(baseDir).toEqual(sfcaConfigRoot);
        });

        it('When the relevant files are not under the folder with the eslint config file, nor the config root, but is under the cwd, then use the cwd', async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(sampleCurrentFolder,'unparsableFile.js')
            ]);
            const sfcaConfigRoot: string =  path.join(testDataFolder, 'workspaceWithInvalidFlatConfig');
            const eslintConfigFile: string = path.join(testDataFolder, 'workspaceWithFlatConfigJs', 'eslint.config.js');

            const eslintWorkspace: ESLintWorkspace = ESLintWorkspace.from(
                workspace, sfcaConfigRoot, fileExts, eslintConfigFile);
            const baseDir: string = await eslintWorkspace.getBaseDirectory();
            expect(baseDir).toEqual(sampleCurrentFolder);
        });

        it('When the relevant files are not under any folder of interest, then just use the root of the targeted files', async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(testDataFolder, 'workspace_NoCustomConfig'),
                path.join(testDataFolder, 'workspaceWithFlatConfigMjs'),
                __dirname
            ]);
            const sfcaConfigRoot: string =  path.join(testDataFolder, 'workspaceWithInvalidFlatConfig');
            const eslintConfigFile: string = path.join(testDataFolder, 'workspaceWithFlatConfigJs', 'eslint.config.js');

            const eslintWorkspace: ESLintWorkspace = ESLintWorkspace.from(
                workspace, sfcaConfigRoot, fileExts, eslintConfigFile);
            const baseDir: string = await eslintWorkspace.getBaseDirectory();
            expect(baseDir).toEqual(__dirname);
        });
    });
});
