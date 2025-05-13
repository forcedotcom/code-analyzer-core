import {createTempDir, JavaCommandExecutor} from "@salesforce/code-analyzer-engine-api/utils";
import path from "node:path";
import fs from "node:fs";
import {getMessageFromCatalog, LogLevel, SHARED_MESSAGE_CATALOG} from "@salesforce/code-analyzer-engine-api";

const PMD_WRAPPER_JAVA_CLASS: string = "com.salesforce.sfca.pmdwrapper.PmdWrapper";
const PMD_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'java-lib');

export type PmdRuleInfo = {
    name: string,
    languageId: string,
    description: string,
    externalInfoUrl: string,
    ruleSets: string[],
    priority: string,
    ruleSetFile: string
}

export type PmdRunInputData = {
    ruleSetInputFile: string,
    runDataPerLanguage: Record<string, LanguageSpecificPmdRunData>
}
export type LanguageSpecificPmdRunData = {
    filesToScan: string[]
}

export type PmdResults = {
    violations: PmdViolation[]
    processingErrors: PmdProcessingError[]
}
export type PmdViolation = {
    rule: string
    message: string
    codeLocation: PmdCodeLocation
}
export type PmdCodeLocation = {
    file: string
    startLine: number
    startCol: number
    endLine: number
    endCol: number
}
export type PmdProcessingError = {
    file: string
    message: string
    detail: string
}

const STDOUT_PROGRESS_MARKER = '[Progress]';
const STDOUT_ERROR_MARKER = '[Error] ';

export class PmdWrapperInvoker {
    private readonly javaCommandExecutor: JavaCommandExecutor;
    private readonly userProvidedJavaClasspathEntries: string[];
    private temporaryWorkingDir?: string;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(javaCommandExecutor: JavaCommandExecutor, userProvidedJavaClasspathEntries: string[], emitLogEvent: (logLevel: LogLevel, message: string) => void) {
        this.javaCommandExecutor = javaCommandExecutor;
        this.userProvidedJavaClasspathEntries = userProvidedJavaClasspathEntries;
        this.emitLogEvent = emitLogEvent;
    }

    async invokeDescribeCommand(customRulesets: string[], pmdRuleLanguageIds: string[], emitProgress: (percComplete: number) => void): Promise<PmdRuleInfo[]> {
        const tempDir: string = await this.getTemporaryWorkingDir();
        const pmdRulesOutputFile: string = path.join(tempDir, 'ruleInfo.json');
        const customRulesetsListFile: string = path.join(tempDir, 'customRulesetsList.txt');
        await fs.promises.writeFile(customRulesetsListFile, customRulesets.join('\n'), 'utf-8');
        emitProgress(10);

        const javaCmdArgs: string[] = [PMD_WRAPPER_JAVA_CLASS, 'describe', pmdRulesOutputFile, customRulesetsListFile, pmdRuleLanguageIds.join(',')];
        const javaClassPaths: string[] = [
            path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
            ... this.userProvidedJavaClasspathEntries.map(toJavaClasspathEntry)
        ];
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg) => {
            if (stdOutMsg.startsWith(STDOUT_ERROR_MARKER)) {
                const errorMessage: string = stdOutMsg.slice(STDOUT_ERROR_MARKER.length).replaceAll('{NEWLINE}','\n');
                throw new Error(errorMessage);
            } else {
                this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`)
            }
        });
        emitProgress(80);

        try {
            const pmdRulesFileContents: string = await fs.promises.readFile(pmdRulesOutputFile, 'utf-8');
            emitProgress(90);
            const pmdRuleInfoList: PmdRuleInfo[] = JSON.parse(pmdRulesFileContents);
            emitProgress(100);
            return pmdRuleInfoList;
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ErrorParsingOutputFile', pmdRulesOutputFile, errMsg), {cause: err});
        }
    }

    async invokeRunCommand(pmdRuleInfoList: PmdRuleInfo[], runDataPerLanguage: Record<string, LanguageSpecificPmdRunData>, emitProgress: (percComplete: number) => void): Promise<PmdResults> {
        const tempDir: string = await this.getTemporaryWorkingDir();
        emitProgress(2);

        const ruleSetFileContents: string = createRuleSetFileContentsFor(pmdRuleInfoList);
        const ruleSetInputFile: string = path.join(tempDir, 'ruleSetInputFile.xml');
        await fs.promises.writeFile(ruleSetInputFile, ruleSetFileContents, 'utf-8');
        emitProgress(6);

        const inputData: PmdRunInputData = {
            ruleSetInputFile: ruleSetInputFile,
            runDataPerLanguage: runDataPerLanguage
        }

        const inputFile: string = path.join(tempDir, 'pmdRunInput.json');
        await fs.promises.writeFile(inputFile, JSON.stringify(inputData), 'utf-8');
        emitProgress(10);

        const resultsOutputFile: string = path.join(tempDir, 'resultsFile.json');
        const javaCmdArgs: string[] = [PMD_WRAPPER_JAVA_CLASS, 'run', inputFile, resultsOutputFile];
        const javaClassPaths: string[] = [
            path.join(PMD_WRAPPER_LIB_FOLDER, '*'),
            ... this.userProvidedJavaClasspathEntries.map(toJavaClasspathEntry)
        ];
        this.emitLogEvent(LogLevel.Fine, `Calling JAVA command with class path containing ${JSON.stringify(javaClassPaths)} and arguments: ${JSON.stringify(javaCmdArgs)}`);
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg: string) => {
            if (stdOutMsg.startsWith(STDOUT_PROGRESS_MARKER)) {
                const pmdWrapperProgress: number = parseFloat(stdOutMsg.slice(STDOUT_PROGRESS_MARKER.length));
                emitProgress(10 + 80*(pmdWrapperProgress/100)); // 10 to 90%
            } else {
                this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`);
            }
        });

        try {
            const resultsFileContents: string = await fs.promises.readFile(resultsOutputFile, 'utf-8');
            emitProgress(95);

            const pmdResults:PmdResults = JSON.parse(resultsFileContents);
            emitProgress(100);
            return pmdResults;

        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ErrorParsingOutputFile', resultsOutputFile, errMsg), {cause: err});
        }
    }

    private async getTemporaryWorkingDir(): Promise<string> {
        if (this.temporaryWorkingDir === undefined) {
            this.temporaryWorkingDir = await createTempDir();
        }
        return this.temporaryWorkingDir!;
    }
}

function createRuleSetFileContentsFor(pmdRuleInfoList: PmdRuleInfo[]): string {
    const ruleRefs: string[] = pmdRuleInfoList.map(pmdRuleInfo => `    <rule ref="${pmdRuleInfo.ruleSetFile}/${pmdRuleInfo.name}" />`);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<ruleset name="Ruleset for Salesforce Code Analyzer"\n' +
        '    xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"\n' +
        '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
        '    xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd">\n' +
        '    <description>Rules to Run for Salesforce Code Analyzer</description>\n' +
        ruleRefs.join('\n') + '\n' +
        '</ruleset>';
}

function toJavaClasspathEntry(jarfileOrFolder: string): string {
    return jarfileOrFolder.toLowerCase().endsWith(".jar") ? jarfileOrFolder : jarfileOrFolder + path.sep + "*";
}
