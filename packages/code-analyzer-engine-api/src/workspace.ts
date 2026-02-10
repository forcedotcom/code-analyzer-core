import fs from "node:fs";
import path from "node:path";
import {Minimatch} from "minimatch";
import {calculateLongestCommonParentFolderOf} from "./utils";

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
    private readonly ignorePatterns: string[];

    private cachedRawFilesAndFolders?: string[];
    private cachedRawTargets?: string[];

    private cachedWorkspaceFiles?: string[];
    private cachedTargetedFiles?: string[];

    private workspaceRoot?: string | null;
    private cachedIgnoreMatchers?: Minimatch[];

    /**
     * Creates a {@link Workspace} instance associated with a specified list of files and folders.
     *
     * Additionally, an array of targets can be provided which helps engines limit which files they should perform a
     * scan on while still being fully aware of all the files in the workspace. For example, some engines may depend on
     * other files in your project to properly analyze the few files that you are targeting. If a targets array is not
     * specified, then the entire list of workspaces files and folders will be targeted.
     *
     *  Note: This constructor assumes that you have already validated the following:
     *  - that the list of files and folder paths exists and that they are absolute paths
     *  - that each of the targets (if defined) exist and that they are absolute paths
     *  - that the targets live on disk within of the list of files and folder paths
     *
     * @param workspaceId Optional workspace identifier
     * @param absFilesAndFolders Absolute file and folder paths that make up the workspace
     * @param absTargets optional string array of files and/or folders
     * @param ignorePatterns optional array of glob patterns for files to ignore during scanning
     */
    constructor(workspaceId: string, absFilesAndFolders: string[], absTargets?: string[], ignorePatterns: string[] = []) {
        this.workspaceId = workspaceId;
        this.rawAbsFilesAndFolders = absFilesAndFolders;
        this.rawAbsTargets = absTargets;
        this.ignorePatterns = ignorePatterns;
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
     * Redundant paths are removed. For example, if a user provided a file and its parent folder, then the file is
     * removed since the file is already included with the parent folder. Otherwise, no other filtering is done.
     * For example, if a user explicitly provided to the Workspace constructor a .dotFile then we will not exclude this
     * file.
     */
    getRawTargets(): string[] | undefined {
        if (!this.cachedRawTargets && this.rawAbsTargets) {
            this.cachedRawTargets = this.removeRedundantPaths(this.rawAbsTargets).map(removeTrailingPathSep);
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
     *
     * Note: User-specified ignore patterns are NOT applied to workspace files. This allows engines like SFGE to build
     * a complete graph of the codebase while still respecting ignore patterns for targeted files (violations).
     */
    async getWorkspaceFiles(): Promise<string[]> {
        if (!this.cachedWorkspaceFiles) {
            this.cachedWorkspaceFiles = (await expandToListAllFiles(this.getRawFilesAndFolders())).filter(f => !this.shouldExcludeFromWorkspace(f));
        }
        return this.cachedWorkspaceFiles;
    }

    /**
     * Returns whether a path should be excluded from workspace files.
     * This only checks built-in exclusions (node_modules, dot files, etc.) and NOT user-specified ignore patterns.
     */
    private shouldExcludeFromWorkspace(fileOrFolder: string): boolean {
        return this.isExcludeCandidate(fileOrFolder) && !this.excludeCandidateWasExplicitlyProvided(fileOrFolder);
    }

    /**
     * The list of files that an engine should target in its analysis.
     *
     * This method returns the full list of the absolute file paths recursively found within the provided targets.
     *
     * If no targets where provided when constructing the workspace, then all the workspace files from the
     * getWorkspaceFiles method are returned.
     *
     * This list is composed of the files that getRawTargets() returns plus any files found recursively inside any of
     * the folders that getRawTargets() returns. That is, the folders are expanded so that the resulting list only
     * contains file paths.
     *
     * Any files underneath the workspace root that Code Analyzer chooses to ignore (like .gitignore files, files in
     * node_modules folders, etc.) are automatically excluded unless they were explicitly provided when constructing
     * the workspace.
     */
    async getTargetedFiles(): Promise<string[]> {
        if (!this.cachedTargetedFiles) {
            if (!this.getRawTargets()) {
                // When no explicit targets, use workspace files but apply ignore patterns
                const workspaceFiles = await this.getWorkspaceFiles();
                this.cachedTargetedFiles = workspaceFiles.filter(f => !this.matchesIgnorePattern(f));
            } else {
                this.cachedTargetedFiles = (await expandToListAllFiles(this.getRawTargets()!)).filter(f => !this.shouldExclude(f));
            }
        }
        return this.cachedTargetedFiles;
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
        // Check user-specified ignore patterns first
        if (this.matchesIgnorePattern(fileOrFolder)) {
            return true;
        }
        // Then check built-in exclusions (node_modules, dot files, etc.)
        return this.isExcludeCandidate(fileOrFolder) && !this.excludeCandidateWasExplicitlyProvided(fileOrFolder);
    }

    /**
     * Returns whether a file matches any of the user-specified ignore patterns.
     * Patterns are matched against the file path relative to the workspace root.
     */
    private matchesIgnorePattern(fileOrFolder: string): boolean {
        if (this.ignorePatterns.length === 0) {
            return false;
        }
        // Lazily compile matchers for performance
        if (!this.cachedIgnoreMatchers) {
            this.cachedIgnoreMatchers = this.ignorePatterns.map(
                pattern => new Minimatch(pattern, { dot: true, matchBase: true })
            );
        }
        // Get relative path for matching (without leading separator)
        const relativePath = this.makeRelativeToWorkspaceRoot(fileOrFolder);
        let pathToMatch = relativePath.startsWith(path.sep) ? relativePath.slice(1) : relativePath;
        // Normalize to POSIX separators for cross-platform compatibility
        if (path.sep !== '/') {
            pathToMatch = pathToMatch.split(path.sep).join('/');
        }
        
        return this.cachedIgnoreMatchers.some(matcher => matcher.match(pathToMatch));
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
