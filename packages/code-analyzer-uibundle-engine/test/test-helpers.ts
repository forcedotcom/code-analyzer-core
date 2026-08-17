import { DescribeOptions, RunOptions, Workspace } from "@salesforce/code-analyzer-engine-api";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";

export function changeWorkingDirectoryToPackageRoot() {
    let original_working_directory: string;
    beforeAll(() => {
        // We change the directory so that any relative-path lookups (e.g. getEngineVersion
        // reading ../package.json) resolve consistently regardless of where jest is invoked.
        // Using the package root — not the test directory — is also needed for IDE coverage.
        original_working_directory = process.cwd();
        process.chdir(path.resolve(__dirname, '..'));
    });
    afterAll(() => {
        process.chdir(original_working_directory);
    });
}

export function createDescribeOptions(workspace?: Workspace): DescribeOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace,
        workingFolder: fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-'))
    };
}

export function createRunOptions(workspace: Workspace): RunOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace,
        workingFolder: fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-'))
    };
}

/**
 * Create a fresh empty temp directory for a test and return its path.
 * The directory is created under the OS tempdir and is safe to write inside;
 * callers should clean it up in afterEach/afterAll or accept OS temp cleanup.
 */
export function makeTmpDir(prefix = 'uibundle-engine-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Write a file, creating parent directories as needed. Returns the absolute path.
 */
export function writeFile(root: string, relPath: string, contents: string): string {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents, 'utf8');
    return abs;
}
