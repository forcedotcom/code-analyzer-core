import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    EventType,
    LogLevel,
    RuleDescription,
    RunOptions,
    Workspace,
} from '@salesforce/code-analyzer-engine-api'
import {ESLintEngineConfig} from "./config";
import {UserConfigInfo, UserConfigState} from "./user-config-info";
import {getMessage} from "./messages";

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";

    private readonly engineConfig: ESLintEngineConfig;
    private readonly delegateV8Engine: Engine;
    private userConfigInfoCache: Map<string, UserConfigInfo> = new Map();

    constructor(engineConfig: ESLintEngineConfig, delegateV8Engine: Engine) {
        super();
        this.engineConfig = engineConfig;
        this.delegateV8Engine = delegateV8Engine;
        for (const eventType of Object.values(EventType)) {
            this.delegateV8Engine.onEvent(eventType, this.emitEvent.bind(this));
        }
    }

    getName(): string {
        return ESLintEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const userConfigInfo: UserConfigInfo = this.getUserConfigInfo(describeOptions.workspace);
        this.emitLogEvent(LogLevel.Fine, `Detected the following regarding the user's eslint configuration files: ${userConfigInfo}`);

        if (this.shouldDelegateToV8(userConfigInfo)) {
            return this.delegateV8Engine.describeRules(describeOptions);
        }

        // Temporary code until we support flat config (this code currently can only get hit when auto discovery is
        // enabled and a flat config was found without any legacy config):
        this.emitLogEvent(LogLevel.Warn, getMessage('IgnoringFlatConfigFile', userConfigInfo.getUserConfigFile()!));
        return this.delegateV8Engine.describeRules(describeOptions);

        // TODO: When we do support flat config, we should warn if we see a flat config file but a legacy ignore file
        //       saying that the legacy ignore file is ignored.
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const userConfigInfo: UserConfigInfo = this.getUserConfigInfo(runOptions.workspace);
        if (this.shouldDelegateToV8(userConfigInfo)) {
            return this.delegateV8Engine.runRules(ruleNames, runOptions);
        }

        // Temporary code until we support flat config (this code currently can only get hit when auto discovery is
        // enabled and a flat config was found without any legacy config):
        return this.delegateV8Engine.runRules(ruleNames, runOptions);
    }

    private getUserConfigInfo(workspace?: Workspace): UserConfigInfo {
        const cacheKey: string = workspace?.getWorkspaceId() || process.cwd();
        if (!this.userConfigInfoCache.has(cacheKey)) {
            this.userConfigInfoCache.set(cacheKey, new UserConfigInfo(this.engineConfig, workspace));
        }
        return this.userConfigInfoCache.get(cacheKey)!;
    }

    private shouldDelegateToV8(userConfigInfo: UserConfigInfo): boolean {
        return userConfigInfo.getState() === UserConfigState.LEGACY_USER_CONFIG
            || userConfigInfo.getState() === UserConfigState.NO_USER_CONFIG; // Soon this will be removed when we support a default flat base config
    }
}
