import {
    CodeLocation,
    DescribeOptions,
    Engine,
    EngineRunResults,
    RuleDescription,
    RunOptions,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import path from "node:path";
import fs from "node:fs";
import * as fsp from 'node:fs/promises';
import {RegexRule, RegexRules} from "./config";
import {convertToRegex, PromiseExecutionLimiter} from "./utils";

// Dynamic import for ESM-only isbinaryfile package
let isBinaryFile: typeof import('isbinaryfile').isBinaryFile;
const loadIsBinaryFile = async () => {
    if (!isBinaryFile) {
        const mod = await import('isbinaryfile');
        isBinaryFile = mod.isBinaryFile;
    }
    return isBinaryFile;
};

const TEXT_BASED_FILE_EXTS = new Set<string>(
    [
        '.cjs', '.cls', '.cmp', '.css', '.csv', '.htm', '.html', '.js', '.json', '.jsx', '.md', '.mdt', '.mjs', '.page',
        '.rtf', '.trigger', '.ts', '.tsx', '.txt', '.xml', '.xsl', '.xslt', '.yaml', '.yml'
    ]
)

export class RegexEngine extends Engine {
    static readonly NAME = "regex";
    private readonly regexRules: RegexRules;
    private readonly regexValues: Map<string, RegExp> = new Map();
    private readonly textFilesCache: Map<string, string[]> = new Map();
    private readonly ruleResourceUrls: Map<string, string[]>;
    private readonly promiseLimiter: PromiseExecutionLimiter = new PromiseExecutionLimiter();

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
        const workspaceTextFiles: string[] =  await this.filterAsync(fullFileList, isTextFile);
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
        const textFiles: string[] = await this.getTextFiles(runOptions.workspace);
        const ruleRunPromiseFunctions: (() => Promise<Violation[]>)[] = textFiles.map(
            file => () => this.runRulesForFile(file, ruleNames));
        return {
            violations: (await this.promiseLimiter.execute(ruleRunPromiseFunctions)).flat()
        };
    }

    private async runRulesForFile(fileName: string, ruleNames: string[]): Promise<Violation[]>{
        const rulesToRun: string[] = ruleNames.filter(rule => this.shouldScanFile(fileName, rule));
        if (rulesToRun.length === 0) {
            return [];
        }
        const fileContents: string = await fs.promises.readFile(fileName, {encoding: 'utf8'});
        let fileContentsPlusMetaData: string = '';
        if (rulesToRun.some(ruleName => this.regexRules[ruleName]?.include_metadata)) {
            const medataFileName = fileName + "-meta.xml";
            try {
                await fs.promises.access(medataFileName, fs.constants.F_OK);
                fileContentsPlusMetaData = fileContents + await fs.promises.readFile(medataFileName, {encoding: 'utf8'});
            } catch (_err) {
                // Silently proceed if -meta.xml file doesn't exist or there was a problem reading it.
            }
        }

        const violationPromises: Promise<Violation[]>[] = rulesToRun.map(
            ruleName => {
                if (this.regexRules[ruleName]?.include_metadata) {
                    return this.scanFileContents(fileName, fileContentsPlusMetaData, ruleName)
                } else {
                    return this.scanFileContents(fileName, fileContents, ruleName)
                }
            });
        return (await Promise.all(violationPromises)).flat();
    }

    private shouldScanFile(fileName: string, ruleName: string): boolean {
        const fileExtensions: string[] | undefined = this.regexRules[ruleName].file_extensions;
        return !fileExtensions || fileExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    private async scanFileContents(fileName: string, fileContents: string, ruleName: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const regex: RegExp = this.getRegExpFor(ruleName);
        const contextuallyDerivedEol: string = contextuallyDeriveEolString(fileContents);
        const newlineIndexes: number[] = getNewlineIndices(fileContents, contextuallyDerivedEol);

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
            const startColumn: number = getColumnNumber(startIndex, newlineIndexes, contextuallyDerivedEol);
            const endLine: number = getLineNumber(startIndex + matchLength, newlineIndexes);
            const endColumn: number = getColumnNumber(startIndex + matchLength, newlineIndexes, contextuallyDerivedEol);
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

    private async filterAsync<T>(array: T[], filterFcn: AsyncFilterFnc<T>): Promise<T[]> {
        const tasks: (() => Promise<boolean>)[] = array.map(item => () => filterFcn(item));
        const mask: boolean[] = await this.promiseLimiter.execute(tasks);
        return array.filter((_, index) => mask[index]);
    }

}


function getColumnNumber(charIndex: number, newlineIndexes: number[], contextuallyDerivedEol: string): number {
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
    const idxOfCurrentLine = idxOfNextNewline === -1 ? newlineIndexes.length - 1: idxOfNextNewline - 1;
    if (idxOfCurrentLine === 0){
        return charIndex + 1;
    } else {
        const eolOffset = contextuallyDerivedEol.length - 1;
        return charIndex - newlineIndexes.at(idxOfCurrentLine)! - eolOffset;
    }
}

function getLineNumber(charIndex: number, newlineIndexes: number[]): number{
    const idxOfNextNewline = newlineIndexes.findIndex(el => el >= charIndex);
    return idxOfNextNewline === -1 ? newlineIndexes.length : idxOfNextNewline;
}

function getNewlineIndices(fileContents: string, contextuallyDerivedEol: string): number[] {
    const newlineRegex: RegExp = new RegExp(contextuallyDerivedEol, "g");
    const matches = fileContents.matchAll(newlineRegex);
    const newlineIndexes = [-1];

    for (const match of matches) {
        newlineIndexes.push(match.index);
    }
    return newlineIndexes;
}

/**
 * We can't assume that the file's EOL indicator matches the OS's, because of edge cases such as a file created on Unix
 * but scanned on Windows. So instead of consulting the OS for the EOL indicator, we look at the file and find which one it uses.
 * @param contents
 */
function contextuallyDeriveEolString(contents: string): string {
    return contents.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
}

async function isTextFile(fileName: string): Promise<boolean> {
    const ext: string = path.extname(fileName).toLowerCase();
    const isBinaryFileFn = await loadIsBinaryFile();
    return TEXT_BASED_FILE_EXTS.has(ext) || !(await isBinaryFileFn(fileName));
}

type AsyncFilterFnc<T> = (value: T) => Promise<boolean>;
