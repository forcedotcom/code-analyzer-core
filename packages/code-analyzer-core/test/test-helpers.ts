import process from "node:process";
import path from "node:path";
import {FileSystemHandler, UniqueIdGenerator} from "../src/utils";

export function changeWorkingDirectoryToPackageRoot() {
    let original_working_directory: string;
    beforeAll(() => {
        // We change the directory to ensure that the config files (which use relative folders from the package root)
        // are processed correctly. The project root directly is typically the one used by default, but it may be
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

export class FixedUniqueIdGenerator implements UniqueIdGenerator {
    getLocallyUniqueId(_prefix: string): string {
        return "FixedId";
    }

    getUniversallyUniqueId(): string {
        return "FixedUUID";
    }
}

export class FakeFileSystemHandler implements FileSystemHandler {
    private fsMap: Map<string, {
        created: boolean
        deleted: boolean
    }> = new Map();

    createDirectory(absolutePath: string): Promise<void> {
        if (this.fsMap.has(absolutePath)) {
            throw new Error(`TEST ERROR: Path ${absolutePath} was created twice`);
        }
        this.fsMap.set(absolutePath, {
            created: true,
            deleted: false
        });
        return Promise.resolve();
    }

    deleteDirectory(absolutePath: string): Promise<void> {
        if (!this.fsMap.has(absolutePath)) {
            throw new Error(`TEST ERROR: Path ${absolutePath} was deleted without being created`);
        }
        if (this.fsMap.get(absolutePath)!.deleted) {
            throw new Error(`TEST ERROR: Path ${absolutePath} was deleted twice`);
        }
        this.fsMap.get(absolutePath)!.deleted = true;
        return Promise.resolve();
    }

    dirWasCreated(absolutePath: string): boolean {
        return this.fsMap.has(absolutePath) && this.fsMap.get(absolutePath)!.created;
    }

    dirWasDeleted(absolutePath: string): boolean {
        return this.fsMap.has(absolutePath) && this.fsMap.get(absolutePath)!.deleted;
    }
}
