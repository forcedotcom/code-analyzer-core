import fs from "node:fs";
import path from "node:path";

const NON_DOT_FOLDERS_TO_EXCLUDE: string[] = ['node_modules'];
const NON_DOT_FILES_TO_EXCLUDE: string[] = ['code_analyzer_config.yml', 'code_analyzer_config.yaml'];

/**
 * Class that describes a users workspace of files and folders that should be scanned
 *
 * Note that outside of testing, engines should not construct their own Workspace instances but instead use the
 * Workspace instances provided by the {@link DescribeOptions} and {@link RunOptions}.
 */
export class Workspace {
    private readonly workspaceId: string;
    private readonly rawAbsFilesAndFolders: string[];
    private readonly rawAbsTargets?: string[];

    private cachedRawFilesAndFolders?: string[];
    private cachedRawTargets?: string[];

    private cachedWorkspaceFiles?: string[];
    private cachedTargetedFiles?: string[];
    private cachedTargetedMethods?: string[];

    private workspaceRoot?: string | null;

    /**
     * Creates a {@link Workspace} instance associated with a specified list of files and folders.
     *
     * Additionally, an array of targets can be provided which helps engines limit which files they should perform a
     * scan on while still being fully aware of all the files in the workspace. For example, some engines may depend on
     * other files in your project to properly analyze the few files that you are targeting. If a targets array is not
     * specified, then the entire list of workspaces files and folders will be targeted.
     *
     * Note that some engines may allow for method level targeting. To specify a method level target in your target
     * array, use the following syntax: '/path/to/ApexClass.cls#methodName'. Currently, only Apex class (.cls) files are
     * supported for method level targeting. Engines that do not support method level targets may simply ignore them.
     *
     *  Note: This constructor assumes that you have already validated the following:
     *  - that the list of files and folder paths exists and that they are absolute paths
     *  - that each of the targets (if defined) exist and that they are absolute paths
     *  - that the targets live on disk within of the list of files and folder paths
     *
     * @param workspaceId Optional workspace identifier
     * @param absFilesAndFolders Absolute file and folder paths that make up the workspace
     * @param absTargets optional string array of files, folders, and/or apex methods
     */
    constructor(workspaceId: string, absFilesAndFolders: string[], absTargets?: string[]) {
        this.workspaceId = workspaceId;
        this.rawAbsFilesAndFolders = absFilesAndFolders;
        this.rawAbsTargets = absTargets;
    }

    /**
     * Returns the identifier associated with the workspace
     */
    getWorkspaceId(): string {
        return this.workspaceId;
    }

    /**
     * Returns the longest root folder that contains all the workspace paths or null if one does not exist
     *   For example, if the workspace was constructed with "/some/folder/subFolder/file1.txt" and
     *   "/some/folder/file2.txt", then the workspace root folder would be equal to "/some/folder".
     *   For the scenarios where a root folder does not exist, for example if the workspace is composed of paths from
     *   two different drives, like "C:\users\someUser\someProject" and "D:\anotherFolder", then null is returned.
     */
    getWorkspaceRoot(): string | null {
        if (this.workspaceRoot === undefined) {
            this.workspaceRoot = calculateLongestCommonParentFolderOf(this.rawAbsFilesAndFolders);
        }
        return this.workspaceRoot;
    }

    /**
     * Returns the unique list of files and folders that were used to construct the workspace.
     *
     * Redundant paths are removed. For example, if a user provided a file and its parent folder, then the file is
     * removed since the file is already included with the parent folder. Otherwise, no other filtering is done.
     * For example, if a user explicitly provided to the Workspace constructor a .dotFile then we will not exclude this
     * file.
     */
    getRawFilesAndFolders(): string[] {
        if (!this.cachedRawFilesAndFolders) {
            this.cachedRawFilesAndFolders = this.removeRedundantPaths(this.rawAbsFilesAndFolders).map(removeTrailingPathSep);
        }
        return this.cachedRawFilesAndFolders;
    }

    /**
     * Returns the unique list of targets that were provided when constructing the workspace or undefined if none were provided.
     *
     * Redundant targets are removed. For example, if a user provided a method and its parent file separately, then the
     * method is removed since the method already is included with the file. Otherwise, no other filtering is done.
     * For example, if a user explicitly provided to the Workspace constructor a .dotFile then we will not exclude this
     * file.
     */
    getRawTargets(): string[] | undefined {
        if (!this.cachedRawTargets && this.rawAbsTargets) {
            const fileAndFolderTargets: string[] = extractFileAndFolderTargetsFrom(this.rawAbsTargets);
            const methodTargets: string[] = extractMethodTargetsFrom(this.rawAbsTargets);

            // To allow the reuse of the removeRedundantPaths (which only works on files and folders) to effectively
            // remove method level targets that also have a parent file or folder listed, we do a trick of converting
            // method level targets to look like fake folders temporarily so the existing algorithm can work its magic.
            const fakeFolder: string = path.sep + '__FAKE_FOLDER__' + path.sep;
            const convertedMethodTargets: string[] = methodTargets.map(t => t.replace('#', fakeFolder));
            const unfilteredTargets: string[] = [...fileAndFolderTargets, ...new Set(convertedMethodTargets)];
            const filteredTargets: string[] = this.removeRedundantPaths(unfilteredTargets).map(removeTrailingPathSep);

            // Then we convert the fake folders back to restore the method level targets.
            this.cachedRawTargets = filteredTargets.map(t => t.replace(fakeFolder, '#'));
        }
        return this.cachedRawTargets;
    }

    /**
     * The list of files that make up a user's workspace that engines may use to support its analysis of the targeted files.
     *
     * This method returns the full list of the absolute file paths recursively found within the workspace.
     *
     * This list is composed of the files that getRawFilesAndFolders() returns plus any files found recursively inside
     * any of the folders that getRawFilesAndFolders() returns. That is, the folders are expanded so that the
     * resulting list only contains file paths.
     *
     * Any files underneath the workspace root that Code Analyzer chooses to ignore (like .gitignore files, files in
     * node_modules folders, etc.) are automatically excluded unless they were explicitly provided when constructing
     * the workspace.
     */
    async getWorkspaceFiles(): Promise<string[]> {
        if (!this.cachedWorkspaceFiles) {
            this.cachedWorkspaceFiles = (await expandToListAllFiles(this.getRawFilesAndFolders())).filter(f => !this.shouldExclude(f));
        }
        return this.cachedWorkspaceFiles;
    }

    /**
     * The list of files that an engine should target in its analysis.
     *
     * This method returns the full list of the absolute file paths recursively found within the provided targets (not
     * including targeted methods).
     *
     * If no targets where provided when constructing the workspace, then all the workspace files from the
     * getWorkspaceFiles method are returned. If only method targets were provided, then an empty array is returned.
     *
     * This list is composed of the files that getRawTargets() returns (not including targeted methods) plus any
     * files found recursively inside any of the folders that getRawTargets() returns. That is, the folders are expanded
     * so that the resulting list only contains file paths.
     *
     * Any files underneath the workspace root that Code Analyzer chooses to ignore (like .gitignore files, files in
     * node_modules folders, etc.) are automatically excluded unless they were explicitly provided when constructing
     * the workspace.
     */
    async getTargetedFiles(): Promise<string[]> {
        if (!this.getRawTargets()) {
            return await this.getWorkspaceFiles();
        }
        if (!this.cachedTargetedFiles) {
            const targetedFilesAndFolders: string[] = extractFileAndFolderTargetsFrom(this.getRawTargets()!);
            this.cachedTargetedFiles = (await expandToListAllFiles(targetedFilesAndFolders)).filter(f => !this.shouldExclude(f));
        }
        return this.cachedTargetedFiles;
    }

    /**
     * Returns a list of targeted methods, separate from the targeted files and folders, that an engine may analyse.
     *
     * Not all engines will be able to target individual methods. If an engine does support the file associated with the
     * targeted method but does not support method level targeting, then the engine should emit an info or warning log
     * event by its runRules method saying that the method level target is being ignored.
     *
     * The format of each targeted method is `<filePath>#<methodName>` (ex: '/path/to/SomeApexFile.cls#SomeMethod').
     */
    async getTargetedMethods(): Promise<string[]> {
        if (!this.cachedTargetedMethods) {
            this.cachedTargetedMethods = this.getRawTargets() ? extractMethodTargetsFrom(this.getRawTargets()!) : [];
        }
        return Promise.resolve(this.cachedTargetedMethods);
    }

    /**
     * Returns whether a path should be excluded or not (like paths under a "node_modules" folder should be excluded)
     *   Idea: In the future, we might consider having a .code_analyzer_ignore file or something that users can create
     *         which could help the user have better control over what files are excluded.
     *
     *   Note: When determining whether to exclude a file or not, we base it entirely off looking at the
     *   portion of the path underneath the workspace root. This allows us to not accidentally remove all files if the
     *   workspace happens to live under a dot folder for example. Additionally, we do not remove any files that have
     *   been explicitly provided to the Workspace constructor, which allows users to target .dot folders and files if
     *   they choose to do so.
     */
    private shouldExclude(fileOrFolder: string): boolean {
        return this.isExcludeCandidate(fileOrFolder) && !this.excludeCandidateWasExplicitlyProvided(fileOrFolder);
    }
    private isExcludeCandidate(fileOrFolder: string): boolean {
        const relativeFileOrFolder: string = this.makeRelativeToWorkspaceRoot(fileOrFolder);
        if (relativeFileOrFolder.length === 0) { // folder is equal to the workspace root
            return false;
        }
        return NON_DOT_FOLDERS_TO_EXCLUDE.some(f => relativeFileOrFolder.includes(`${path.sep}${f}${path.sep}`)) ||
            NON_DOT_FILES_TO_EXCLUDE.includes(path.basename(relativeFileOrFolder)) ||
            relativeFileOrFolder.includes(`${path.sep}.`);
    }
    private excludeCandidateWasExplicitlyProvided(fileOrFolder: string): boolean {
        if (this.rawAbsFilesAndFolders.includes(fileOrFolder) || this.rawAbsTargets?.includes(fileOrFolder)) {
            return true;
        }
        const parentFolder: string = path.dirname(fileOrFolder);
        if (this.isExcludeCandidate(parentFolder)) {
            return this.excludeCandidateWasExplicitlyProvided(parentFolder);
        }
        return false;
    }

    /**
     * Returns the file or folder as a relative path, relative to the workspace root
     */
    private makeRelativeToWorkspaceRoot(fileOrFolder: string): string {
        if(this.getWorkspaceRoot()) {
            return fileOrFolder.slice(this.getWorkspaceRoot()!.length);
        }
        /* istanbul ignore next */
        return fileOrFolder;
    }

    /**
     *  Removes redundant paths.
     *    If a user supplies a parent folder and subfolder of file underneath the parent folder, then we can safely
     *    remove that subfolder or file (unless it is an excludeCandidate that has been explicitly requested to keep).
     *    Also, if we find duplicate entries, we remove those as well.
     */
    private removeRedundantPaths(absolutePaths: string[]): string[] {
        const seenPathsSet: Set<string> = new Set();
        const pathsSortedByLength: string[] = [...absolutePaths].sort((a, b) => a.length - b.length);
        // This won't necessarily store the exact paths, but it'll store something that's unique to each path.
        // And storing them as a Set means that comparison checks are O(1) instead of O(n).
        const nonRedundantPathKeys: Set<string> = new Set();
        const nonRedundantPaths: string[] = [];
        for (const currentPath of pathsSortedByLength) {
            // All of our comparisons should be done against lowercase-only strings, to prevent casing shenanigans.
            const lowerCaseCurrentPath: string = currentPath.toLowerCase();
            // If we've already seen this path, then we've already decided whether to keep or discard it, so we can
            // just skip it.
            if (seenPathsSet.has(lowerCaseCurrentPath)) {
                continue;
            }
            // Mark the path as one we've seen.
            seenPathsSet.add(lowerCaseCurrentPath);
            // Split the path into its segments.
            const pathSegments: string[] = lowerCaseCurrentPath.split(path.sep);
            let foundMatchingPathKey: boolean = false;
            for (let i = 1; i < pathSegments.length; i++) {
                const partialPathKey: string = pathSegments.slice(0, i).join(path.sep);
                if (nonRedundantPathKeys.has(partialPathKey)) {
                    foundMatchingPathKey = true;
                    break;
                }
            }
            if (!foundMatchingPathKey || this.isExcludeCandidate(currentPath)) {
                nonRedundantPaths.push(currentPath);
                nonRedundantPathKeys.add(lowerCaseCurrentPath);
            }
        }
        return nonRedundantPaths.sort();
    }
}

/**
 * Removes trailing path.sep values if needed
 */
function removeTrailingPathSep(absolutePath: string): string {
    return absolutePath.length > path.sep.length && absolutePath.endsWith(path.sep) ?
        absolutePath.slice(0, absolutePath.length - path.sep.length) : absolutePath;
}

/**
 * Expands a list of files and/or folders to be a list of all contained files, including the files found in subfolders
 */
export async function expandToListAllFiles(absoluteFileOrFolderPaths: string[]): Promise<string[]> {
    const allFiles: Set<string> = new Set(); // Using a set to guarantee uniqueness
    async function processPath(currentPath: string): Promise<void> {
        if ((await fs.promises.stat(currentPath)).isDirectory()) {
            const subPaths: string[] = await fs.promises.readdir(currentPath);
            const absSubPaths: string[] = subPaths.map(f => path.join(currentPath, f));
            await Promise.all(absSubPaths.map(processPath)); // Process subdirectories recursively
        } else {
            allFiles.add(currentPath);
        }
    }
    await Promise.all(absoluteFileOrFolderPaths.map(processPath));
    return [... allFiles].sort();
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

function extractFileAndFolderTargetsFrom(rawTargets: string[]): string[] {
    return rawTargets.filter(t => !t.includes('#'));
}

function extractMethodTargetsFrom(rawTargets: string[]): string[] {
    return rawTargets.filter(t => t.includes('#'));
}
