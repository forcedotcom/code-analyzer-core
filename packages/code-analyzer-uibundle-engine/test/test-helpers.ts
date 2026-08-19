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

const _createdTmpDirs: string[] = [];

export function makeTmpDir(prefix = 'uibundle-engine-'): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    _createdTmpDirs.push(dir);
    return dir;
}

export function installTmpDirCleanup(): void {
    afterEach(() => {
        while (_createdTmpDirs.length > 0) {
            const dir = _createdTmpDirs.pop()!;
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // Best-effort cleanup — a stray tmp dir is not worth failing a test.
            }
        }
    });
}

export function writeFile(root: string, relPath: string, contents: string): string {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents, 'utf8');
    return abs;
}
