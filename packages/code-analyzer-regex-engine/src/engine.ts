import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults, LogLevel,
    RuleDescription,
    RunOptions,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import fs from "node:fs";
import * as fsp from 'node:fs/promises';
import os from "node:os";
import {RegexRule, RegexRules} from "./config";
import {isBinaryFile} from "isbinaryfile";
import {convertToRegex} from "./utils";
import {getMessage} from "./messages";

const TEXT_BASED_FILE_EXTS = new Set<string>(
    [
        '.cjs', '.cls', '.cmp', '.css', '.csv', '.htm', '.html', '.js', '.json', '.jsx', '.md', '.mdt', '.mjs', '.page',
        '.rtf', '.trigger', '.ts', '.tsx', '.txt', '.xml', '.xsl', '.xslt', '.yaml', '.yml'
    ]
)

/**
 * The number of files that can be processed by the Regex engine simultaneously.
 * Batching the files allows us to control how many are open at once, and avoid hitting system limits over it.
 */
const FILE_BATCH_SIZE = 1000;

export class RegexEngine extends Engine {
    static readonly NAME = "regex";
    private readonly regexRules: RegexRules;
    private readonly regexValues: Map<string, RegExp> = new Map();
    private readonly textFilesCache: Map<string, string[]> = new Map();
    private readonly ruleResourceUrls: Map<string, string[]>;

    constructor(regexRules: RegexRules, ruleResourceUrls: Map<string, string[]>) {
        super();
        this.regexRules = regexRules;
        this.ruleResourceUrls = ruleResourceUrls
    }

    getName(): string {
        return RegexEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fsp.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    // For testing purposes only
    _getRegexRules(): RegexRules {
        return this.regexRules
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        const textFiles: string[] | undefined = describeOptions.workspace ?
            (await this.getTextFiles(describeOptions.workspace)) : undefined;
        const ruleDescriptions: RuleDescription[] = [];
        for (const [ruleName, regexRule] of Object.entries(this.regexRules)) {
            if (!textFiles || textFiles.some(fileName => this.shouldScanFile(fileName, ruleName))){
                ruleDescriptions.push(this.toRuleDescription(ruleName, regexRule));
            }
        }
        return ruleDescriptions;
    }

    private getRegExpFor(ruleName: string): RegExp {
        if (!this.regexValues.has(ruleName)) {
            this.regexValues.set(ruleName, convertToRegex(this.regexRules[ruleName].regex));
        }
        return this.regexValues.get(ruleName)!;
    }

    private async getTextFiles(workspace: Workspace): Promise<string[]>{
        const cacheKey: string = workspace.getWorkspaceId();
        if (this.textFilesCache.has(cacheKey)){
            return this.textFilesCache.get(cacheKey)!;
        }
        const fullFileList: string[] = await workspace.getTargetedFiles();
        const workspaceTextFiles: string[] =  await filterAsync(fullFileList, isTextFile);
        this.textFilesCache.set(cacheKey, workspaceTextFiles);
        return workspaceTextFiles;
    }

    private toRuleDescription(ruleName: string, regexRule: RegexRule): RuleDescription {
        return {
            name: ruleName,
            severityLevel: regexRule.severity,
            tags: regexRule.tags,
            description: regexRule.description,
            resourceUrls: this.ruleResourceUrls.get(ruleName) ?? []
        }
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        await this.emitLogRegardingIgnoredMethodTargetsIfNeeded(runOptions.workspace);

        const textFiles: string[] = await this.getTextFiles(runOptions.workspace);
        let batchMultiplier = 0;
        const violations: Violation[] = [];
        while (batchMultiplier * FILE_BATCH_SIZE < textFiles.length) {
            // Turns out there's a system-level limit on how many files can be open at once. In order to avoid hitting
            // this limit while still reaping the benefits of `Promise.all()`, we'll process the files in batches.
            const textFileBatch = textFiles.slice(batchMultiplier * FILE_BATCH_SIZE, (batchMultiplier + 1) * FILE_BATCH_SIZE);
            const ruleRunPromises: Promise<Violation[]>[] = textFileBatch.map(file => this.runRulesForFile(file, ruleNames));
            const newViolations = (await Promise.all(ruleRunPromises)).flat();
            violations.push(...newViolations);
            batchMultiplier++;
        }
        return {
            violations
        };
    }

    private async runRulesForFile(file: string, ruleNames: string[]): Promise<Violation[]>{
        const rulesToRun: string[] = ruleNames.filter(rule => this.shouldScanFile(file, rule));
        const violationPromises:  Promise<Violation[]>[]  = rulesToRun.map(ruleName => this.scanFile(file, ruleName));
        return (await Promise.all(violationPromises)).flat();
    }

    private shouldScanFile(fileName: string, ruleName: string): boolean {
        const ext: string = path.extname(fileName).toLowerCase();
        const fileExtensions: string[] | undefined = this.regexRules[ruleName].file_extensions;
        return !fileExtensions || fileExtensions.includes(ext);
    }

    private async scanFile(fileName: string, ruleName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        let fileContents: string = await fs.promises.readFile(fileName, {encoding: 'utf8'})
        if (this.regexRules[ruleName]?.include_metadata) {
            const medataFileName = fileName + "-meta.xml";
            try {
                await fs.promises.access(medataFileName, fs.constants.F_OK);
                fileContents = fileContents + await fs.promises.readFile(medataFileName, {encoding: 'utf8'}) ;
            } catch (_err) {
                // Silently proceed if -meta.xml file doesn't exist or there was a problem reading it.
            }
        }
        const regex: RegExp = this.getRegExpFor(ruleName);
        const newlineIndexes: number[] = getNewlineIndices(fileContents);

        for (const match of fileContents.matchAll(regex)) {
            let startIndex: number = match.index;
            let matchLength: number = match[0].length;

            // If there is a group with name "target" then we make the boundary be around it instead of the whole match.
            // To name a group with "target": add (?<target>innerPattern) inside the outer regular expression pattern.
            if (match.groups?.target) {
                startIndex = startIndex + match[0].indexOf(match.groups.target);
                matchLength = match.groups.target.length;
            }

            const startLine: number = getLineNumber(startIndex, newlineIndexes);
            const startColumn: number = getColumnNumber(startIndex, newlineIndexes);
            const endLine: number = getLineNumber(startIndex + matchLength, newlineIndexes);
            const endColumn: number = getColumnNumber(startIndex + matchLength, newlineIndexes);
            const codeLocation: CodeLocation = {
                file: fileName,
                startLine: startLine,
                startColumn: startColumn,
                endLine: endLine,
                endColumn: endColumn
            };
            violations.push({
                ruleName: ruleName,
                codeLocations: [codeLocation],
                primaryLocationIndex: 0,
                message: this.regexRules[ruleName].violation_message
            });
        }
        return violations;
    }

    private async emitLogRegardingIgnoredMethodTargetsIfNeeded(workspace: Workspace): Promise<void> {
        const targetedMethods: string[] = await workspace.getTargetedMethods();
        if (targetedMethods.length > 0) {
            this.emitLogEvent(LogLevel.Info, getMessage('TargetedMethodsNotSupported', RegexEngine.NAME,
                JSON.stringify(targetedMethods)));
        }
    }
}


function getColumnNumber(charIndex: number, newlineIndexes: number[]): number {
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
    const idxOfCurrentLine = idxOfNextNewline === -1 ? newlineIndexes.length - 1: idxOfNextNewline - 1;
    if (idxOfCurrentLine === 0){
        return charIndex + 1;
    } else {
        const eolOffset = os.EOL.length - 1;
        return charIndex - newlineIndexes.at(idxOfCurrentLine)! - eolOffset;
    }
}

function getLineNumber(charIndex: number, newlineIndexes: number[]): number{
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
    return idxOfNextNewline === -1 ? newlineIndexes.length : idxOfNextNewline;
}

function getNewlineIndices(fileContents: string): number[] {
    const newlineRegex: RegExp = new RegExp(os.EOL, "g");
    const matches = fileContents.matchAll(newlineRegex);
    const newlineIndexes = [-1];

    for (const match of matches) {
        newlineIndexes.push(match.index);
    }
    return newlineIndexes;
}

async function isTextFile(fileName: string): Promise<boolean> {
    const ext: string = path.extname(fileName).toLowerCase();
    return TEXT_BASED_FILE_EXTS.has(ext) || !(await isBinaryFile(fileName));
}

type AsyncFilterFnc<T> = (value: T) => Promise<boolean>;

async function filterAsync<T>(array: T[], filterFcn: AsyncFilterFnc<T>): Promise<T[]> {
    const mask: boolean[] = await Promise.all(array.map(filterFcn));
    return array.filter((_, index) => mask[index]);
}
