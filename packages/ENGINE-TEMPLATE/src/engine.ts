import { DescribeOptions, Engine, EngineRunResults, LogLevel, RuleDescription, RunOptions, Violation } from "@salesforce/code-analyzer-engine-api";
import * as fsp from 'node:fs/promises';
import path from "path";
import { getMessage } from "./messages";

// *** Change the Class Name to match your engine's name
export class TemplateEngine extends Engine {
    // *** Change the NAME to match your engine's name
    static readonly NAME = "template";

    // *** Consider passing in a configuration object from your engine's plugin if you want to provide user-configuration
    constructor() {
        super();
    }

    getName(): string {
        return TemplateEngine.NAME;
    }

    // *** Update if you want to get your engine version any other way
    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fsp.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    // *** Remove underscore for private naming convention if you need any of the DescribeOptions
    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        // *** Best Practice - Use RunRulesProgressEvents to keep users informed on the scan progress
        this.emitRunRulesProgressEvent(0);

        // *** Parse out relevant file types if you engine is language-specific
        //const relevantFiles: string[] | undefined;

        // *** Get your rules!
        const ruleDescriptions: RuleDescription[] = [];

        this.emitRunRulesProgressEvent(50);

        // *** Retrieval Implementation is up to you, but you'll need to map them into RuleDescription form, such as:
        const exampleRule: RuleDescription = {
            name: "Example Rule",
            severityLevel: 5,
            tags: [
              "Recommended"
            ],
            description: "The description of your rule",
            resourceUrls: []
        };
        ruleDescriptions.push(exampleRule);
        
        // *** Best Practice - Set RunRulesProgressEvents to 100 before completing
        this.emitDescribeRulesProgressEvent(100);
        return ruleDescriptions;
    }

    // *** ruleNames comes from a describeRules call made just before running
    async runRules(_ruleNames: string[], _runOptions: RunOptions): Promise<EngineRunResults> {

        // *** Best Practice - Use RunRulesProgressEvents to keep users informed on the scan progress
        this.emitRunRulesProgressEvent(2);

        // *** Get your violations!
        const violations: Violation[] = [];

        // *** Rule Implementation - map any violations to Violations and CodeLocations
        // *** If Violations do not have CodeLocations they will be shown in modal form

        // *** Best Practice - Use messages sparingly to keep users informed
        // *** Ideal for failures, or an announcement
        const one = '1'
        this.emitLogEvent(LogLevel.Debug, getMessage('TemplateMessage2', one, '2'));

        this.emitRunRulesProgressEvent(100);
        return {
            violations: violations
        };
    }
}