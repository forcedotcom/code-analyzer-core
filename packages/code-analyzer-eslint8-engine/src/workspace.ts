import {Workspace} from "@salesforce/code-analyzer-engine-api";
import fs from "node:fs";
import path from "node:path";
import {ESLint8EngineConfig, isExecutableConfigFile, LEGACY_ESLINT_CONFIG_FILES, LEGACY_ESLINT_IGNORE_FILE} from "./config";
import {makeUnique} from "./utils";

export type AsyncFilterFnc<T> = (value: T) => Promise<boolean>;

export interface ESLintWorkspace {
    getFilesToScan(filterFcn: AsyncFilterFnc<string>): Promise<string[]>
    getCandidateFilesForUserConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]>
    getCandidateFilesForBaseConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]>
    getUserConfigInfo(): UserConfigInfo
}

export class UserConfigInfo {
    private readonly engineConfig: ESLint8EngineConfig;
    private readonly autoDiscoveredConfigFile?: string;
    private readonly autoDiscoveredIgnoreFile?: string;

    constructor(config: ESLint8EngineConfig, autoDiscoveredConfigFile?: string, autoDiscoveredIgnoreFile?: string) {
        this.engineConfig = config;
        this.autoDiscoveredConfigFile = autoDiscoveredConfigFile;
        this.autoDiscoveredIgnoreFile = autoDiscoveredIgnoreFile;
    }

    getUserConfigFile(): string | undefined {
        if (this.engineConfig.eslint_config_file) {
            return this.engineConfig.eslint_config_file;
        }
        // When auto-discovering config, we deliberately refuse to apply an executable config file because doing so
        // would run its top-level JavaScript during analysis (an arbitrary code execution vector). Only declarative
        // auto-discovered config files (e.g. .eslintrc.json/.yaml/.yml) are applied automatically.
        if (this.engineConfig.auto_discover_eslint_config && this.autoDiscoveredConfigFile
                && !isExecutableConfigFile(this.autoDiscoveredConfigFile)) {
            return this.autoDiscoveredConfigFile;
        }
        return undefined;
    }

    // Returns the auto-discovered config file that was NOT applied because it is executable (and thus would run
    // arbitrary top-level code when loaded). Returns undefined when no such file was skipped.
    getSkippedExecutableConfigFile(): string | undefined {
        if (!this.engineConfig.eslint_config_file && this.engineConfig.auto_discover_eslint_config
                && this.autoDiscoveredConfigFile && isExecutableConfigFile(this.autoDiscoveredConfigFile)) {
            return this.autoDiscoveredConfigFile;
        }
        return undefined;
    }

    userConfigIsEnabled(): boolean {
        return this.engineConfig.eslint_config_file !== undefined || this.engineConfig.auto_discover_eslint_config;
    }

    getAutoDiscoveredConfigFile(): string | undefined {
        return this.autoDiscoveredConfigFile;
    }

    getUserIgnoreFile(): string | undefined {
        return this.engineConfig.eslint_ignore_file ||
            (this.engineConfig.auto_discover_eslint_config ? this.autoDiscoveredIgnoreFile : undefined);
    }

    getAutoDiscoveredIgnoreFile(): string | undefined {
        return this.autoDiscoveredIgnoreFile;
    }
}

export class MissingESLintWorkspace implements ESLintWorkspace {
    private readonly config: ESLint8EngineConfig;
    private cachedUserConfigInfo?: UserConfigInfo;

    constructor(config: ESLint8EngineConfig) {
        this.config = config;
    }

    /* istanbul ignore next */
    async getFilesToScan(_filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        throw new Error("This method should never be called");
    }

    async getCandidateFilesForUserConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        // With no workspace, we just reuse same candidate files as base config
        return this.getCandidateFilesForBaseConfig(filterFcn);
    }

    async getCandidateFilesForBaseConfig(_filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        return createPlaceholderCandidateFiles([
                ... this.config.file_extensions.javascript,
                ... this.config.file_extensions.typescript,
                ... this.config.file_extensions.other],
            this.config.config_root
        )
    }

    getUserConfigInfo(): UserConfigInfo {
        if (!this.cachedUserConfigInfo) {
            this.cachedUserConfigInfo = new UserConfigInfo(this.config,
                findLegacyConfigFile(makeUnique([this.config.config_root, process.cwd()])),
                findLegacyIgnoreFile(makeUnique([this.config.config_root, process.cwd()])));
        }
        return this.cachedUserConfigInfo;
    }
}


type FilesOfInterest = {
    javascriptFiles: string[]
    typescriptFiles: string[]
    otherFiles: string[]
}

export class PresentESLintWorkspace implements ESLintWorkspace {
    private readonly delegateWorkspace: Workspace;
    private readonly config: ESLint8EngineConfig;
    private filesOfInterest?: FilesOfInterest;
    private cachedUserConfigInfo?: UserConfigInfo;

    constructor(delegateWorkspace: Workspace, config: ESLint8EngineConfig) {
        this.delegateWorkspace = delegateWorkspace;
        this.config = config;
    }

    async getFilesToScan(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        const filesOfInterest: FilesOfInterest = await this.getFilesOfInterest(filterFcn);
        return filesOfInterest.javascriptFiles
            .concat(filesOfInterest.typescriptFiles)
            .concat(filesOfInterest.otherFiles);
    }

    async getCandidateFilesForUserConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        return this.getFilesToScan(filterFcn);
    }

    async getCandidateFilesForBaseConfig(filterFcn: AsyncFilterFnc<string>): Promise<string[]> {
        const filesOfInterest: FilesOfInterest = await this.getFilesOfInterest(filterFcn);
        let candidateFiles: string[] = [];
        if (filesOfInterest.javascriptFiles.length > 0) {
            candidateFiles = createPlaceholderCandidateFiles(this.config.file_extensions.javascript, this.getWorkspaceRoot());
        }
        if (filesOfInterest.typescriptFiles.length > 0) {
            candidateFiles = candidateFiles.concat(
                createPlaceholderCandidateFiles(this.config.file_extensions.typescript, this.getWorkspaceRoot()));
        }
        return candidateFiles;
    }

    getUserConfigInfo(): UserConfigInfo {
        if (!this.cachedUserConfigInfo) {
            this.cachedUserConfigInfo = new UserConfigInfo(this.config,
                findLegacyConfigFile(makeUnique([this.getWorkspaceRoot(), this.config.config_root, process.cwd()])),
                findLegacyIgnoreFile(makeUnique([this.getWorkspaceRoot(), this.config.config_root, process.cwd()])));
        }
        return this.cachedUserConfigInfo;
    }

    private getWorkspaceRoot(): string {
        return this.delegateWorkspace.getWorkspaceRoot() || this.config.config_root;
    }

    private async getFilesOfInterest(filterFcn: AsyncFilterFnc<string>): Promise<FilesOfInterest> {
        if (this.filesOfInterest) {
            return this.filesOfInterest;
        }

        this.filesOfInterest = { javascriptFiles: [], typescriptFiles: [], otherFiles: [] };
        for (const file of await this.delegateWorkspace.getTargetedFiles()) {
            const fileExt = path.extname(file).toLowerCase();
            if (this.config.file_extensions.javascript.includes(fileExt)) {
                this.filesOfInterest.javascriptFiles.push(file);
            } else if (this.config.file_extensions.typescript.includes(fileExt)) {
                this.filesOfInterest.typescriptFiles.push(file);
            } else if (this.config.file_extensions.other.includes(fileExt)) {
                this.filesOfInterest.otherFiles.push(file);
            }
        }
        this.filesOfInterest.javascriptFiles = await filterAsync(this.filesOfInterest.javascriptFiles, filterFcn);
        this.filesOfInterest.typescriptFiles = await filterAsync(this.filesOfInterest.typescriptFiles, filterFcn);
        this.filesOfInterest.otherFiles = await filterAsync(this.filesOfInterest.otherFiles, filterFcn);

        return this.filesOfInterest;
    }
}

function createPlaceholderCandidateFiles(fileExtensions: string[], rootFolder: string) {
    return fileExtensions.map(ext => `${rootFolder}${path.sep}placeholderCandidateFile${ext}`);
}

function findLegacyConfigFile(foldersToCheck: string[]): string | undefined {
    for (const folder of foldersToCheck) {
        for (const legacyConfigFileName of LEGACY_ESLINT_CONFIG_FILES) {
            const legacyConfigFile: string = path.join(folder, legacyConfigFileName);
            if (fs.existsSync(legacyConfigFile)) { // Using synchronous code to ensure we check for the files in the correct order
                return legacyConfigFile;
            }
        }
    }
    return undefined;
}

function findLegacyIgnoreFile(foldersToCheck: string[]): string | undefined {
    for (const folder of foldersToCheck) {
        const legacyIgnoreFile: string = path.join(folder, LEGACY_ESLINT_IGNORE_FILE);
        if (fs.existsSync(legacyIgnoreFile)) { // Using synchronous code to ensure we check for the files in the correct order
            return legacyIgnoreFile;
        }
    }
    return undefined;
}

async function filterAsync<T>(array: T[], filterFcn: AsyncFilterFnc<T>): Promise<T[]> {
    const mask: boolean[] = await Promise.all(array.map(filterFcn));
    return array.filter((_, index) => mask[index]);
}
