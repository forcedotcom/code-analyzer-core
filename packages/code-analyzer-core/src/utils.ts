import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// THIS FILE CONTAINS UTILITIES WHICH ARE USED INTERNALLY ONLY.
// None of the following exported interfaces and functions should be exported from the index file.


export function toAbsolutePath(fileOrFolder: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    return path.resolve(fileOrFolder.replace(/[\\/]/g, path.sep));
}

export interface UniqueIdGenerator {
    getLocallyUniqueId(prefix: string): string;

    getUniversallyUniqueId(): string;
}

export class RuntimeUniqueIdGenerator implements UniqueIdGenerator {
    private counter: number = 0;

    getLocallyUniqueId(prefix: string): string {
        return `${prefix}${++this.counter}`;
    }

    getUniversallyUniqueId(): string {
        return crypto.randomUUID();
    }
}

export interface FileSystem {
    mkdir(absPath: fs.PathLike, options?: fs.MakeDirectoryOptions): Promise<string|undefined>

    mkdtemp(prefix: string): Promise<string>

    rm(absPath: fs.PathLike, options?: fs.RmOptions): Promise<void>

    rmSync(absPath: fs.PathLike, options?: fs.RmOptions): void
}

export class RealFileSystem implements FileSystem {
    mkdir(absPath: fs.PathLike, options?: fs.MakeDirectoryOptions): Promise<string|undefined> {
        return fs.promises.mkdir(absPath, options);
    }

    mkdtemp(prefix: string): Promise<string> {
        return fs.promises.mkdtemp(prefix);
    }

    rm(absPath: fs.PathLike, options?: fs.RmOptions): Promise<void> {
        return fs.promises.rm(absPath, options);
    }

    rmSync(absPath: fs.PathLike, options?: fs.RmOptions): void {
        return fs.rmSync(absPath, options);
    }
}

export class TempFolder {
    private readonly fileSystem: FileSystem;
    private readonly rootFolderPrefix: string;
    private rootFolder?: string;
    private relPathsToKeep: Set<string> = new Set();

    constructor(fileSystem: FileSystem = new RealFileSystem(), rootFolderPath: string = os.tmpdir()) {
        this.fileSystem = fileSystem;
        this.rootFolderPrefix = path.join(rootFolderPath, 'code-analyzer-');
    }

    async getPath(...subfolderPathSegments: string[]): Promise<string> {
        if (!this.rootFolder) {
            this.rootFolder = await this.fileSystem.mkdtemp(this.rootFolderPrefix);
        }
        return path.join(this.rootFolder,...subfolderPathSegments);
    }

    async makeSubfolder(firstSubfolderPathSegment: string, ...otherSubfolderPathSegments: string[]): Promise<string> {
        const absSubfolderPath: string = await this.getPath(firstSubfolderPathSegment, ...otherSubfolderPathSegments);
        await this.fileSystem.mkdir(absSubfolderPath, {recursive: true});
        return absSubfolderPath;
    }

    markToBeKept(...subfolderPathSegments: string[]): void {
        this.relPathsToKeep.add(path.join(...subfolderPathSegments));
        if (subfolderPathSegments.length !== 0) {
            this.markToBeKept(...subfolderPathSegments.slice(0, -1));
        }
    }

    isKept(...subfolderPathSegments: string[]): boolean {
        return this.relPathsToKeep.has(path.join(...subfolderPathSegments));
    }

    async removeIfNotKept(...subfolderPathSegments: string[]): Promise<void> {
        if (!this.isKept(...subfolderPathSegments)) {
            const absPath: string = await this.getPath(...subfolderPathSegments);
            await this.fileSystem.rm(absPath, {recursive: true, force: true});
        }
    }

    // Note this sync version exists since, we must have a sync version for final removal of the temp folder if done
    // with process.on('exit',...) because on exit there is no event loop.
    removeSyncIfNotKept(): void {
        if (!this.isKept() && this.rootFolder) {
            this.fileSystem.rmSync(this.rootFolder, {recursive: true, force: true});
        }
    }
}

export class EngineProgressAggregator {
    private readonly percentagesMap: Map<string, number> = new Map();

    reset(engineNames: string[]): void {
        this.percentagesMap.clear();
        for (const engineName of engineNames) {
            this.setProgressFor(engineName, 0);
        }
    }

    setProgressFor(engineName: string, value: number): void {
        this.percentagesMap.set(engineName, value);
    }

    getAggregatedProgressPercentage(): number {
        let sumOfPercentages = 0;
        for (const value of this.percentagesMap.values()) {
            sumOfPercentages += value;
        }
        return sumOfPercentages / Math.max(this.percentagesMap.size, 1);
    }
}

// Typescript says that {} === {} is false because it does a shallow comparison. To be more robust in our object
// comparison we often need to do a deep equality check, thus the need for this function.
export function deepEquals(value1: unknown, value2: unknown): boolean {
    // Check for strict equality first
    if (value1 === value2) {
        return true;
    }

    // If one is null or undefined, return false
    if (value1 == null || value2 == null) {
        return false;
    }

    // If both are objects (arrays or plain objects), compare them deeply
    if (typeof value1 === 'object' && typeof value2 === 'object') {
        // If both are arrays
        if (Array.isArray(value1) && Array.isArray(value2)) {
            if (value1.length !== value2.length) {
                return false;
            }
            // Compare each element in arrays
            for (let i = 0; i < value1.length; i++) {
                if (!deepEquals(value1[i], value2[i])) {
                    return false;
                }
            }
            return true;
        }

        // If both are objects (not arrays)
        if (!Array.isArray(value1) && !Array.isArray(value2)) {
            const keys1: string[] = Object.keys(value1);
            const keys2: string[] = Object.keys(value2);

            // If they have different numbers of keys, they are not equal
            if (keys1.length !== keys2.length) {
                return false;
            }

            // Compare each key and its corresponding value
            for (const key of keys1) {
                if (!keys2.includes(key) || !deepEquals(value1[key as keyof object], value2[key as keyof object])) {
                    return false;
                }
            }
            return true;
        }
    }

    // For all other types (number, string, boolean, etc.), use strict equality
    return false;
}
