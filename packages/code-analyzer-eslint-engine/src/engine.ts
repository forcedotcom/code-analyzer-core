import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions,
} from '@salesforce/code-analyzer-engine-api'
import {ESLintEngineConfig} from "./config";

export class ESLintEngine extends Engine {
    static readonly NAME = "eslint";

    constructor(_config: ESLintEngineConfig) {
        super();
    }

    getName(): string {
        return ESLintEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        throw new Error('Not implemented. Soon this will be implemented for ESLint v9.');
    }

    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {
        throw new Error('Not implemented. Soon this will be implemented for ESLint v9.');
    }
}
