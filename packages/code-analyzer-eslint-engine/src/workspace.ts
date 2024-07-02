import {Workspace} from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import path from "node:path";

export interface ESLintWorkspace {
    getJavascriptFiles(): Promise<string[]>
    getTypescriptFiles(): Promise<string[]>
    getCandidateFilesForBaseConfig(): Promise<string[]>
    getLegacyConfigFile(): string | undefined
}


export class MissingESLintWorkspace implements ESLintWorkspace {
    private readonly javascriptExtensions: string[];
    private readonly typescriptExtensions: string[];
    private readonly workspaceRoot: string;

    constructor(javascriptExtensions: string[], typescriptExtensions: string[]) {
        this.javascriptExtensions = javascriptExtensions;
        this.typescriptExtensions = typescriptExtensions;

        // TODO: Once we pass in user provided config file, then if it exists, consider using its parent folder location instead
        this.workspaceRoot = process.cwd();
    }

    async getJavascriptFiles(): Promise<string[]> {
        return this.javascriptExtensions.map(ext => `${this.workspaceRoot}${path.sep}placeholderJavascriptFile${ext}`);
    }

    async getTypescriptFiles(): Promise<string[]> {
        return this.typescriptExtensions.map(ext => `${this.workspaceRoot}${path.sep}placeholderTypescriptFile${ext}`);
    }

    async getCandidateFilesForBaseConfig(): Promise<string[]> {
        return [... await this.getJavascriptFiles(), ... await this.getTypescriptFiles()];
    }

    getLegacyConfigFile(): string | undefined {
        // TODO: Once we pass in user provided config file, then if it exists return that if it is a legacy one
        return findLegacyConfigFile([process.cwd()]);
    }
}


export class PresentESLintWorkspace implements ESLintWorkspace {
    private readonly delegateWorkspace: Workspace;
    private readonly javascriptExtensions: string[];
    private readonly typescriptExtensions: string[];
    private workspaceRoot?: string;
    private javascriptFiles?: string[];
    private typescriptFiles?: string[];

    constructor(delegateWorkspace: Workspace, javascriptExtensions: string[], typescriptExtensions: string[]) {
        this.delegateWorkspace = delegateWorkspace;
        this.javascriptExtensions = javascriptExtensions;
        this.typescriptExtensions = typescriptExtensions;
    }

    /**
     * Gets the top most common parent folder that contains all the files in the workspace.
     * Note: We may consider moving this inside of the core module if other engines need it.
     */
    private getWorkspaceRoot(): string {
        if (!this.workspaceRoot) {
            this.setWorkspaceRoot();
        }
        return this.workspaceRoot!;
    }

    private setWorkspaceRoot(): void {
        if (this.delegateWorkspace.getFilesAndFolders().length == 0) {
            this.workspaceRoot = process.cwd();
        } else {
            const longestCommonStr: string = getLongestCommonPrefix(this.delegateWorkspace.getFilesAndFolders());
            this.workspaceRoot = fs.existsSync(longestCommonStr) && fs.statSync(longestCommonStr).isDirectory() ?
                longestCommonStr : path.dirname(longestCommonStr);
        }
    }

    /**
     * Returns a list of the targeted javascript files in the workspace
     */
    async getJavascriptFiles(): Promise<string[]> {
        if (!this.javascriptFiles) {
            this.javascriptFiles = (await this.delegateWorkspace.getExpandedFiles())
                .filter(file => this.javascriptExtensions.includes(path.extname(file).toLowerCase()));
        }
        return this.javascriptFiles;
    }

    async getTypescriptFiles(): Promise<string[]> {
        if (!this.typescriptFiles) {
            this.typescriptFiles = (await this.delegateWorkspace.getExpandedFiles())
                .filter(file => this.typescriptExtensions.includes(path.extname(file).toLowerCase()));
        }
        return this.typescriptFiles;
    }

    private async hasJavascriptFiles(): Promise<boolean> {
        return (await this.getJavascriptFiles()).length > 0;
    }

    private async hasTypescriptFiles(): Promise<boolean> {
        return (await this.getTypescriptFiles()).length > 0;
    }

    async getCandidateFilesForBaseConfig(): Promise<string[]> {
        let candidateFiles: string[] = [];
        if (await this.hasJavascriptFiles()) {
            candidateFiles = [...candidateFiles,
                ...this.javascriptExtensions.map(ext => `${this.getWorkspaceRoot()}${path.sep}someJavascriptFile${ext}`)];
        }
        if (await this.hasTypescriptFiles()) {
            candidateFiles = [...candidateFiles,
                ...this.typescriptExtensions.map(ext => `${this.getWorkspaceRoot()}${path.sep}someTypescriptFile${ext}`)];
        }
        return candidateFiles;
    }

    getLegacyConfigFile(): string | undefined {
        // TODO: Once we pass in user provided config file, then if it exists return that if it is a legacy one
        return findLegacyConfigFile(makeUnique([this.getWorkspaceRoot(), process.cwd()]));
    }
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

function findLegacyConfigFile(foldersToCheck: string[]): string | undefined {
    // See https://eslint.org/docs/v8.x/use/configure/configuration-files#configuration-file-formats
    const legacyConfigFileNames: string[] = [".eslintrc.js", ".eslintrc.cjs", ".eslintrc.yaml", ".eslintrc.yml", ".eslintrc.json"];

    for (const folder of foldersToCheck) {
        for (const legacyConfigFileName of legacyConfigFileNames) {
            const possibleUserConfigFile = path.join(folder, legacyConfigFileName);
            if (fs.existsSync(possibleUserConfigFile)) { // Using synchronous code to ensure we check for the files in the correct order
                return possibleUserConfigFile;
            }
        }
    }
    return undefined;
}

function makeUnique(values: string[]): string[] {
    return [... new Set(values)];
}