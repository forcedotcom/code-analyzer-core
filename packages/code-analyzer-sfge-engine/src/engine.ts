import path from 'node:path';
import fs from 'node:fs';
import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions
} from '@salesforce/code-analyzer-engine-api';
import {SfgeEngineConfig} from "./config";

export class SfgeEngine extends Engine {
    public static readonly NAME: string = 'sfge';
    private readonly config: SfgeEngineConfig;

    public constructor(config: SfgeEngineConfig) {
        super();
        this.config = config;
    }

    public override getName(): string {
        return SfgeEngine.NAME;
    }

    public override async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.promises.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    public override describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        return Promise.resolve([]);
    }

    public override runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        return Promise.resolve({
            violations: []
        });
    }
}