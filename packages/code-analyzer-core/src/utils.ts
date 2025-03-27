import path from "node:path";

// THIS FILE CONTAINS UTILITIES WHICH ARE USED INTERNALLY ONLY.
// None of the following exported interfaces and functions should be exported from the index file.

export function toAbsolutePath(fileOrFolder: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    return path.resolve(fileOrFolder.replace(/[\\/]/g, path.sep));
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
