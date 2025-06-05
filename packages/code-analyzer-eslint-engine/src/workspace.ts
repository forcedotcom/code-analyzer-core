import * as path from "node:path";
import * as process from "node:process";
import {Workspace} from "@salesforce/code-analyzer-engine-api";
import {FileExtensionsObject} from "./config";
import {ESLint} from "eslint";
import {getMessage} from "./messages";
import { calculateLongestCommonParentFolderOf, indent } from "@salesforce/code-analyzer-engine-api/utils";

export abstract class ESLintWorkspace {
    abstract getBaseDirectory(): Promise<string>

    protected abstract getPreIgnoredFilesToScan(): Promise<string[]>

    async getFilesToScan(eslint: ESLint): Promise<string[]> {
        const preIgnoredFilesToScan: string[] = await this.getPreIgnoredFilesToScan();
        const isPathIgnoredPromises: Promise<boolean>[] = preIgnoredFilesToScan.map(f => eslint.isPathIgnored(f));
        const isPathIgnoredMask: boolean[] = await Promise.all(isPathIgnoredPromises);
        return preIgnoredFilesToScan.filter((_, index) => !isPathIgnoredMask[index]);
    }

    static from(workspace: Workspace | undefined, sfcaConfigRoot: string, fileExts: FileExtensionsObject, eslintConfigFile?: string): ESLintWorkspace {
        return workspace ? new SpecifiedESLintWorkspace(workspace, sfcaConfigRoot, fileExts, eslintConfigFile) :
            new UnspecifiedESLintWorkspace(sfcaConfigRoot, fileExts, eslintConfigFile);
    }
}

class SpecifiedESLintWorkspace extends ESLintWorkspace {
    private readonly workspace: Workspace;
    private readonly sfcaConfigRoot: string;
    private readonly fileExts: FileExtensionsObject;
    private readonly eslintConfigFile?: string;
    private cachedBaseDirectory?: string;
    private cachedPreIgnoredFilesToScan?: string[];

    constructor(workspace: Workspace, sfcaConfigRoot: string, fileExts: FileExtensionsObject, eslintConfigFile?: string) {
        super();
        this.workspace = workspace;
        this.sfcaConfigRoot = sfcaConfigRoot;
        this.fileExts = fileExts;
        this.eslintConfigFile = eslintConfigFile;
    }

    /**
     * Calculates the best folder to use as the ESLint Base Directory
     * This directory is super important as it is what ESLint uses when parsing the "files" and "ignores" properties.
     * See https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-and-ignores where it says:
     *     "Patterns specified in files and ignores use minimatch syntax and are evaluated relative to the location of
     *     the eslint.config.js file. If using an alternate config file via the --config command line option, then all
     *     patterns are evaluated relative to the current working directory."
     * For example if the value of ignores is 'someFolder/*.js' then this will be relative to the base directory.
     * Even double wild cards ** are relative to the base directory so absolute files not living underneath the base
     * directory are ignored.
     * The default value that ESLint uses is the cwd() but Salesforce Code Analyzer is unique in that you can specify
     * a workspace and targeted files that do not live under cwd(). So we make our best guess using the following
     * strategy:
     *   - First, we calculate the root folder (greatest common parent folder) of all the relevant files in the users
     *     workspace. If this root folder does not exist (because the user specified 2 different drives like C:/ and
     *     D:/) then we error since the user can only use this engine when the relevant files all have a common root.
     *     If there are no relevant files, then we simply use cwd() as the base directory since it doesn't matter.
     *   - Next, if the user supplied an ESLint configuration file (or we automatically discovered one) then we check
     *     if the folder that it is contained in also contains the root. If so, this folder is the base dir
     *     since this is the default behavior of ESLint.
     *   - Otherwise, if we check the Salesforce Code Analyzer configuration root (which typically is the folder that
     *     contains the code-analyzer.yml file, but may be user provided or just cwd if the user has no
     *     code-analyzer.yml file) contains the root. If so, then we use this folder as base dir.
     *   - Otherwise, we check if the current working folder contains the root. If so, then cwd() is used
     *     which is ESLint's fallback strategy anyway.
     *   - Otherwise, we just use the root folder as the base directory as a last ditch effort to guarantee
     *     that at least we chose a base directory that contained all the files to be scanned.
     */
    async getBaseDirectory(): Promise<string> {
        if (this.cachedBaseDirectory === undefined) {
            const relevantFiles: string[] = await this.getPreIgnoredFilesToScan();
            if (relevantFiles.length === 0) {
                // In this edge case, it doesn't even matter what base folder we return, so we simply choose cwd.
                return process.cwd();
            }
            const relevantFilesRoot: string | null = calculateLongestCommonParentFolderOf(relevantFiles);
            /* istanbul ignore if */
            if (relevantFilesRoot === null) {
                throw new Error(getMessage('UnableToCalculateBaseDirectory', indent(JSON.stringify(relevantFiles, null, 2))));
            } else if (this.eslintConfigFile && folderContainsFolder(path.dirname(this.eslintConfigFile), relevantFilesRoot)) {
                this.cachedBaseDirectory = path.dirname(this.eslintConfigFile);
            } else if (folderContainsFolder(this.sfcaConfigRoot, relevantFilesRoot)) {
                this.cachedBaseDirectory = this.sfcaConfigRoot;
            } else if (folderContainsFolder(process.cwd(), relevantFilesRoot)) {
                this.cachedBaseDirectory = process.cwd();
            } else {
                this.cachedBaseDirectory = relevantFilesRoot;
            }
        }
        return this.cachedBaseDirectory;
    }

    protected async getPreIgnoredFilesToScan(): Promise<string[]> {
        if (this.cachedPreIgnoredFilesToScan === undefined) {
            const relevantFileExtensions: string[] = [
                ...this.fileExts.javascript,
                ...this.fileExts.typescript,
                ...this.fileExts.other];
            this.cachedPreIgnoredFilesToScan = (await this.workspace.getTargetedFiles())
                .filter(file => relevantFileExtensions.includes(path.extname(file).toLowerCase()));
        }
        return this.cachedPreIgnoredFilesToScan;
    }
}

class UnspecifiedESLintWorkspace extends ESLintWorkspace {
    private readonly sfcaConfigRoot: string;
    private readonly fileExts: FileExtensionsObject;
    private readonly eslintConfigFile?: string;

    constructor(sfcaConfigRoot: string, fileExts: FileExtensionsObject, eslintConfigFile?: string) {
        super();
        this.sfcaConfigRoot = sfcaConfigRoot;
        this.fileExts = fileExts;
        this.eslintConfigFile = eslintConfigFile;
    }

    async getBaseDirectory(): Promise<string> {
        return this.eslintConfigFile ? path.dirname(this.eslintConfigFile) : this.sfcaConfigRoot;
    }

    protected async getPreIgnoredFilesToScan(): Promise<string[]> {
        const baseDir: string = await this.getBaseDirectory();
        const relevantFileExtensions: string[] = [
            ...this.fileExts.javascript,
            ...this.fileExts.typescript,
            ...this.fileExts.other];
        return relevantFileExtensions.map(ext => `${baseDir}${path.sep}placeholderCandidateFile${ext}`);
    }
}

function folderContainsFolder(outerFolder: string, innerFolder: string) {
    return outerFolder === innerFolder || innerFolder.startsWith(outerFolder + path.sep);
}
