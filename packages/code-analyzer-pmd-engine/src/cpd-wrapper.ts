import {getMessageFromCatalog, LogLevel, SHARED_MESSAGE_CATALOG} from "@salesforce/code-analyzer-engine-api";
import {JavaCommandExecutor} from "@salesforce/code-analyzer-engine-api/utils";
import path from "node:path";
import fs from "node:fs";

const CPD_WRAPPER_JAVA_CLASS: string = "com.salesforce.sfca.cpdwrapper.CpdWrapper";
const CPD_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'java-lib');

const STDOUT_PROGRESS_MARKER = '[Progress]';

export type CpdRunInputData = {
    runDataPerLanguage: Record<string, LanguageSpecificCpdRunData>,
    skipDuplicateFiles: boolean
}
export type LanguageSpecificCpdRunData = {
    filesToScan: string[],
    minimumTokens: number
}

export type CpdRunResults = {
    [language: string]: CpdLanguageRunResults
}
export type CpdLanguageRunResults = {
    matches: CpdMatch[],
    processingErrors: CpdProcessingError[]
}
export type CpdMatch = {
    numTokensInBlock: number,
    numNonemptyLinesInBlock: number,
    numBlocks: number,
    blockLocations: CpdBlockLocation[]
}
export type CpdBlockLocation = {
    file: string,
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number
}
export type CpdProcessingError = {
    file: string,
    message: string,
    detail: string
}

export class CpdWrapperInvoker {
    private readonly javaCommandExecutor: JavaCommandExecutor;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;

    constructor(javaCommandExecutor: JavaCommandExecutor, emitLogEvent: (logLevel: LogLevel, message: string) => void) {
        this.javaCommandExecutor = javaCommandExecutor;
        this.emitLogEvent = emitLogEvent;
    }

    async invokeRunCommand(inputData: CpdRunInputData, workingFolder: string, emitProgress: (percComplete: number) => void): Promise<CpdRunResults> {
        emitProgress(5);

        const inputFile: string = path.join(workingFolder, 'cpdRunInput.json');
        await fs.promises.writeFile(inputFile, JSON.stringify(inputData), 'utf-8');
        emitProgress(10);

        const outputFile: string = path.join(workingFolder, 'cpdRunOutput.json');

        const javaCmdArgs: string[] = [CPD_WRAPPER_JAVA_CLASS, 'run', inputFile, outputFile];
        const javaClassPaths: string[] = [
            path.join(CPD_WRAPPER_LIB_FOLDER, '*'),
        ];
        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg: string) => {
            if (stdOutMsg.startsWith(STDOUT_PROGRESS_MARKER)) {
                const cpdWrapperProgress: number = parseFloat(stdOutMsg.slice(STDOUT_PROGRESS_MARKER.length));
                emitProgress(10 + 80*(cpdWrapperProgress/100)); // 10 to 90%
            } else {
                this.emitLogEvent(LogLevel.Fine, `[JAVA StdOut]: ${stdOutMsg}`);
            }
        });

        try {
            const resultsFileContents: string = await fs.promises.readFile(outputFile, 'utf-8');
            emitProgress(95);

            const cpdResults:CpdRunResults = JSON.parse(resultsFileContents);
            emitProgress(100);
            return cpdResults;

        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ErrorParsingOutputFile', outputFile, errMsg), {cause: err});
        }
    }
}