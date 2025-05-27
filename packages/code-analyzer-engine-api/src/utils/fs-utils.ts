import * as tmp from 'tmp';
import {promisify} from "node:util";
import path from "node:path";
import fs from "node:fs";

tmp.setGracefulCleanup();
const tmpDirAsync = promisify((options: tmp.DirOptions, cb: tmp.DirCallback) => tmp.dir(options, cb));

/**
 * Creates a temporary directory that eventually cleans up after itself
 * @param parentTempDir - if supplied, then a temporary folder is placed directly underneath this parent folder.
 */
export async function createTempDir(parentTempDir?: string) : Promise<string> {
    return tmpDirAsync({dir: parentTempDir, keep: false, unsafeCleanup: true});
}


/**
 * Returns the longest common parent folder of the provided paths.
 *   If empty or if no common parent folder exists, like in the case on Windows machines of using two different drives
 *   C: and D:, then null is returned (to allow the client of this function to handle this case without try/catch).
 * @param paths It is assumed that paths is a non-empty array of absolute value paths.
 */
export function calculateLongestCommonParentFolderOf(paths: string[]): string | null {
    if (paths.length === 0) {
        return null;
    }
    const longestCommonStr: string = getLongestCommonPrefix(paths);
    if (longestCommonStr.length === 0) {
        return null;
    }
    if (longestCommonStr.length > 1 && longestCommonStr.endsWith(path.sep)) {
        return longestCommonStr.slice(0, longestCommonStr.length - 1);
    }
    return fs.existsSync(longestCommonStr) && fs.statSync(longestCommonStr).isDirectory() && !includesAFileThatIsNotAFolderThatStartsWith(longestCommonStr, paths) ?
        longestCommonStr : path.dirname(longestCommonStr);
}
function getLongestCommonPrefix(strs: string[]): string {
    // To find the longest common prefix, we first get the shortest string from our list of strings
    const shortestStr = strs.reduce((s1, s2) => s1.length <= s2.length ? s1 : s2);

    // Then we check that each string's ith character is the same as the shortest strings ith character
    for (let i = 0; i < shortestStr.length; i++) {
        if(!strs.every(str => str[i] === shortestStr[i])) {
            // If we find a string that doesn't match the ith character, we return the common prefix from [0,i)
            return shortestStr.substring(0, i)
        }
    }
    return shortestStr;
}
function includesAFileThatIsNotAFolderThatStartsWith(partialPathStr:string, allPaths: string[]) {
    // This handles the edge case when the workspace contains a folder that is part of the name of another file.
    // For example if "/root/abc/def.txt" and "/root/abcDef.txt" both exist, then we need to know when we can select
    // "/root/abc" as a folder or when we should be selecting "/root" because "/root/abc" just came from "/root/abcDef.txt"
    return allPaths.some(p => p.startsWith(partialPathStr) && p.length > partialPathStr.length && p[partialPathStr.length] !== path.sep);
}
