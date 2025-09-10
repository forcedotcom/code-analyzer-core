import { DescribeOptions, RunOptions, Workspace } from "@salesforce/code-analyzer-engine-api";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";
import {Clock} from '../src/utils';

export function changeWorkingDirectoryToPackageRoot() {
    let original_working_directory: string;
    beforeAll(() => {
        // We change the directory to ensure that the config files (which use relative folders from the package root)
        // are processed correctly. The project root directory is typically the one used by default, but it may be
        // different if the tests are run from the mono-repo's root directory. Lastly, it is better to use the
        // package root directory is instead of the test directory since some IDEs (like IntelliJ) fail to collect
        // code coverage correctly unless this package root directory is used.
        original_working_directory = process.cwd();
        process.chdir(path.resolve(__dirname,'..'));
    });
    afterAll(() => {
        process.chdir(original_working_directory);
    });
}

export class FixedClock implements Clock {
    private readonly fixedTimestamp: Date;

    public constructor(fixedTimestamp: Date) {
        this.fixedTimestamp = fixedTimestamp;
    }

    public now(): Date {
        return this.fixedTimestamp;
    }
}

export function createDescribeOptions(workspace?: Workspace): DescribeOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace,
        workingFolder: fs.mkdtempSync(path.join(os.tmpdir(),'tmp-'))
    }
}

export function createRunOptions(workspace: Workspace): RunOptions {
    return {
        logFolder: os.tmpdir(),
        workspace: workspace,
        workingFolder: fs.mkdtempSync(path.join(os.tmpdir(),'tmp-'))
    }
}
