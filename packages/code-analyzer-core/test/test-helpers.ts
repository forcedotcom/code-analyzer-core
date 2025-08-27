import process from "node:process";
import path from "node:path";
import {UniqueIdGenerator, TempFolder} from "../src/utils";

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

export class SimulatedTempFolder implements TempFolder {
    private readonly simulatedRoot: string = 'simulatedRoot';
    private subfolderSet: Set<string> = new Set();

    getPath(): Promise<string> {
        return Promise.resolve(this.simulatedRoot);
    }

    createSubfolder(...subFolderPathSegs: string[]): Promise<string> {
        const joinedPath: string = path.join(this.simulatedRoot, ...subFolderPathSegs);
        if (this.subfolderSet.has(joinedPath)) {
            throw new Error(`Attempted to create path ${joinedPath} twice`);
        }
        this.subfolderSet.add(joinedPath);
        return Promise.resolve(joinedPath);
    }

    getCreatedSubfolders(): Set<string> {
        return this.subfolderSet;
    }
}
