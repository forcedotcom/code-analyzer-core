import process from "node:process";
import path from "node:path";
import {UniqueIdGenerator, FileSystem} from "../src/utils";
import * as fs from "fs";

export function changeWorkingDirectoryToPackageRoot() {
    let original_working_directory: string;
    beforeAll(() => {
        // We change the directory to ensure that the config files (which use relative folders from the package root)
        // are processed correctly. The project root directly is typically the one used by default, but it may be
        // different if the tests are run from the mono-repo's root directory. Lastly, it is better to use the
        // package root directory is instead of the test directory since some IDEs (like IntelliJ) fail to collect
        // code coverage correctly unless this package root directory is used.
        original_working_directory = process.cwd();
        process.chdir(path.resolve(__dirname, '..'));
    });
    afterAll(() => {
        process.chdir(original_working_directory);
    });
}

export class FixedUniqueIdGenerator implements UniqueIdGenerator {
    getLocallyUniqueId(_prefix: string): string {
        return "FixedId";
    }

    getUniversallyUniqueId(): string {
        return "FixedUUID";
    }
}

export class FakeFileSystem implements FileSystem {
    private counter: number = 0;
    files: Set<string> = new Set();

    mkdirCallHistory: {absPath: fs.PathLike, options?: fs.MakeDirectoryOptions}[] = [];
    mkdir(absPath: fs.PathLike, options?: fs.MakeDirectoryOptions): Promise<string | undefined> {
        this.mkdirCallHistory.push({absPath, options});
        this.files.add(absPath.toString());
        return Promise.resolve(absPath.toString());
    }

    mkdtempCallHistory: {prefix: string}[] = [];
    mkdtemp(prefix: string): Promise<string> {
        this.mkdtempCallHistory.push({prefix});
        const tempDirPath: string = `${prefix}${this.counter++}`;
        this.files.add(tempDirPath);
        return Promise.resolve(tempDirPath);
    }

    rmCallHistory: {absPath: fs.PathLike, options?: fs.RmOptions}[] = [];
    rm(absPath: fs.PathLike, options?: fs.RmOptions): Promise<void> {
        this.rmCallHistory.push({absPath, options});
        this.rmImpl(absPath, options);
        return Promise.resolve();
    }

    rmSyncCallHistory: {absPath: fs.PathLike, options?: fs.RmOptions}[] = [];
    rmSync(absPath: fs.PathLike, options?: fs.RmOptions): void {
        this.rmSyncCallHistory.push({absPath, options});
        this.rmImpl(absPath, options);
    }

    // Implementation shared with both rm and rmSync
    private rmImpl(absPath: fs.PathLike, options?: fs.RmOptions): void {
        this.files.delete(absPath.toString());
        for (const entry of this.files) {
            if (options?.recursive && entry.startsWith(absPath + path.sep)) {
                this.files.delete(entry);
            }
        }
    }
}
