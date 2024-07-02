import path from "node:path";

export function toAbsolutePath(fileOrFolder: string, parentFolder?: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    fileOrFolder = fileOrFolder.replace(/[\\/]/g, path.sep);
    if (!parentFolder) {
        return path.resolve(fileOrFolder);
    }
    return fileOrFolder.startsWith(parentFolder) ? fileOrFolder : path.join(parentFolder, fileOrFolder);
}

export interface Clock {
    now(): Date;
}

export class RealClock implements Clock {
    now(): Date {
        return new Date();
    }
}

export interface UniqueIdGenerator {
    getUniqueId(prefix: string): string;
}

export class SimpleUniqueIdGenerator implements UniqueIdGenerator {
    private counter: number = 0;

    getUniqueId(prefix: string): string {
        return `${prefix}${++this.counter}`;
    }
}