import path from "node:path";
import fs from "node:fs";
import {
    ESLintEngineConfig,
    DISCOVERABLE_FLAT_ESLINT_CONFIG_FILES,
    LEGACY_ESLINT_CONFIG_FILES,
    LEGACY_ESLINT_IGNORE_FILE
} from "./config";
import {makeUnique} from "./utils";
import {Workspace} from "@salesforce/code-analyzer-engine-api";

export enum UserConfigState {
    NO_USER_CONFIG = "NO_USER_CONFIG",
    LEGACY_USER_CONFIG = "LEGACY_USER_CONFIG",
    FLAT_USER_CONFIG = "FLAT_USER_CONFIG"
}

export class UserConfigInfo {
    private readonly engineConfig: ESLintEngineConfig;
    private readonly workspace?: Workspace;
    private userConfigState?: UserConfigState;
    private userConfigFile?: string;
    private userIgnoreFile?: string;
    private discoveredConfigFile?: string;
    private discoveredIgnoreFile?: string;

    constructor(config: ESLintEngineConfig, workspace?: Workspace) {
        this.engineConfig = config;
        this.workspace = workspace;
    }

    getState(): UserConfigState {
        this.initIfNeeded();
        return this.userConfigState!;
    }

    getChosenUserConfigFile(): string | undefined {
        this.initIfNeeded();
        return this.userConfigFile;
    }

    getChosenUserIgnoreFile(): string | undefined {
        this.initIfNeeded();
        return this.userIgnoreFile;
    }

    getDiscoveredConfigFile(): string | undefined {
        this.initIfNeeded();
        return this.discoveredConfigFile;
    }

    toString(): string {
        return JSON.stringify({
            state: this.getState(),
            userConfigFile: this.getChosenUserConfigFile() || null,
            userIgnoreFile: this.getChosenUserIgnoreFile() || null
        });
    }

    private initIfNeeded(): void {
        if (this.userConfigState !== undefined) {
            return;
        }
        this.userConfigState = UserConfigState.NO_USER_CONFIG;

        if (this.engineConfig.eslint_config_file) {
            this.userConfigFile = this.engineConfig.eslint_config_file;
        } else {
            this.discoveredConfigFile = this.discoverFile(
                [...DISCOVERABLE_FLAT_ESLINT_CONFIG_FILES, ...LEGACY_ESLINT_CONFIG_FILES]);
            this.userConfigFile = this.engineConfig.auto_discover_eslint_config ?
                this.discoveredConfigFile : undefined;
        }
        if (this.userConfigFile) {
            this.userConfigState = isLegacyConfigFile(this.userConfigFile) ? UserConfigState.LEGACY_USER_CONFIG : UserConfigState.FLAT_USER_CONFIG;
        }

        if (this.engineConfig.eslint_ignore_file) {
            this.userIgnoreFile = this.engineConfig.eslint_ignore_file;
        } else {
            this.discoveredIgnoreFile = this.discoverFile([LEGACY_ESLINT_IGNORE_FILE]);
            this.userIgnoreFile = this.engineConfig.auto_discover_eslint_config ?
                this.discoveredIgnoreFile : undefined;
        }
        if (this.userIgnoreFile && this.userConfigState !== UserConfigState.FLAT_USER_CONFIG) {
            this.userConfigState = UserConfigState.LEGACY_USER_CONFIG;
        }
    }

    private discoverFile(possibleFileNames: string[]): string | undefined {
        const workspaceRoot: string | undefined | null = this.workspace?.getWorkspaceRoot();
        const foldersToCheck: string[] = makeUnique([
                ... workspaceRoot ? [workspaceRoot] : [],
            this.engineConfig.config_root,
            process.cwd()]);

        for (const folder of foldersToCheck) {
            for (const fileNameToFind of possibleFileNames) {
                const filePath: string = path.join(folder, fileNameToFind);
                if (fs.existsSync(filePath)) { // Using synchronous code to ensure we check for the files in the correct order
                    return filePath;
                }
            }
        }
        return undefined;
    }
}

function isLegacyConfigFile(configFilePath: string): boolean {
    return LEGACY_ESLINT_CONFIG_FILES.includes(path.basename(configFilePath).toLowerCase())
        || ['.json','.yaml','.yml'].includes(path.extname(configFilePath));
}
