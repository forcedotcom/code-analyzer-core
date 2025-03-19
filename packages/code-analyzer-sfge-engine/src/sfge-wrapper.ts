import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
    getMessageFromCatalog,
    LogLevel,
    SHARED_MESSAGE_CATALOG
} from '@salesforce/code-analyzer-engine-api';
import {createTempDir, JavaCommandExecutor} from '@salesforce/code-analyzer-engine-api/utils';
import {getMessage} from "./messages";

export type SfgeRuleInfo = {
    name: string;
    description: string;
    category: string;
    severity: number;
    url: string;
    isPilot: boolean;
};

export type SfgeRunResult = {
    ruleName: string;
    severity: number;
    message: string;
    sourceFileName: string;
    sourceLineNumber: number;
    sourceColumnNumber: number;
    sourceVertexName: string;
    sinkFileName?: string;
    sinkLineNumber?: number;
    sinkColumnNumber?: number;
};

type SfgeTarget = {
    targetFile: string;
    targetMethods: string[];
};

type SfgeInputFile = {
    targets: SfgeTarget[];
    projectDirs: string[];
    rulesToRun: string[];
};

type SfgeMessage = {
    messageKey: string;
    args: string[];
    internalLog: string;
};

type SfgeLogMessage = SfgeMessage & {
    messageSeverity: string;
};

type SfgeProgressMessage = SfgeMessage & {
    progressPercent: number;
};

const SFGE_MAIN_JAVA_CLASS: string = "com.salesforce.Sfge";
const SFGE_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'java-lib');
const SFCA_REALTIME_START: string = 'SFCA-REALTIME-START';
const SFCA_REALTIME_END: string = 'SFCA-REALTIME-END';
const SFGE_ERROR_START: string = 'SfgeErrorStart';

export class RuntimeSfgeWrapper {
    private readonly javaCommandExecutor: JavaCommandExecutor;
    private temporaryWorkingDir?: string;
    private readonly emitLogEvent: (logLeveL: LogLevel, message: string) => void;

    public constructor(javaCommandExecutor: JavaCommandExecutor, emitLogEvent: (logLevel: LogLevel, message: string) => void) {
        this.javaCommandExecutor = javaCommandExecutor;
        this.emitLogEvent = emitLogEvent;
    }

    public async invokeDescribeCommand(emitProgress: (percComplete: number) => void): Promise<SfgeRuleInfo[]> {
        const tmpDir: string = await this.getTemporaryWorkingDir();
        const logFilePath: string = path.join(os.tmpdir(), 'sfge.log');
        const sfgeRulesOutputFile: string = path.join(tmpDir, 'ruleInfo.json');
        emitProgress(10);

        const javaCmdArgs: string[] = [`-Dsfge_log_name=${logFilePath}`, SFGE_MAIN_JAVA_CLASS, 'catalog', 'all', sfgeRulesOutputFile];
        const javaClassPaths: string[] = [path.join(SFGE_WRAPPER_LIB_FOLDER, '*')];

        await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths);

        emitProgress(80);

        try {
            const sfgeRulesFileContents: string = await fs.promises.readFile(sfgeRulesOutputFile, 'utf-8');
            emitProgress(90);
            const sfgeRuleInfoList: SfgeRuleInfo[] = JSON.parse(sfgeRulesFileContents);
            emitProgress(100);
            return sfgeRuleInfoList;
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ErrorParsingOutputFile', sfgeRulesOutputFile, errMsg), {cause: err});
        }
    }

    public async invokeRunCommand(selectedRuleInfos: SfgeRuleInfo[], targetPaths: string[], projectFilePaths: string[], emitProgress: (percComplete: number) => void): Promise<SfgeRunResult[]> {
        const tmpDir: string = await this.getTemporaryWorkingDir();
        emitProgress(2);

        const inputFileName: string = path.join(tmpDir, 'sfgeInput.json');
        const logFilePath: string = path.join(os.tmpdir(), 'sfge.log');
        const ruleNames: string[] = selectedRuleInfos.map(sri => sri.name);

        await this.createSfgeInputFile(inputFileName, ruleNames, targetPaths, projectFilePaths);
        const resultsOutputFile: string = path.join(tmpDir, 'resultsFile.json');
        this.emitLogEvent(LogLevel.Info, getMessage('LoggingToFile', logFilePath));
        emitProgress(10);

        const javaCmdArgs: string[] = [`-Dsfge_log_name=${logFilePath}`, SFGE_MAIN_JAVA_CLASS, 'execute', inputFileName, resultsOutputFile];
        const javaClassPaths: string[] = [path.join(SFGE_WRAPPER_LIB_FOLDER, '*')];

        try {
            await this.javaCommandExecutor.exec(javaCmdArgs, javaClassPaths, (stdOutMsg) => handleRunStdOut(stdOutMsg, this.emitLogEvent, emitProgress));
        } catch (err) {
            const errMsg: string = err instanceof Error ? err.message : /* istanbul ignore next */ String(err);
            const processedErrMsg: string = processMessageFromFailedRun(errMsg);
            throw new Error(processedErrMsg, {cause: err});
        }

        try {
            const resultsFileContents: string = await fs.promises.readFile(resultsOutputFile, 'utf-8');
            emitProgress(95);

            const sfgeResults: SfgeRunResult[] = JSON.parse(resultsFileContents);
            emitProgress(100);
            return sfgeResults;
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ErrorParsingOutputFile', resultsOutputFile, errMsg), {cause: err});
        }
    }

    private async getTemporaryWorkingDir(): Promise<string> {
        if (this.temporaryWorkingDir === undefined) {
            this.temporaryWorkingDir = await createTempDir();
        }
        return this.temporaryWorkingDir;
    }

    private async createSfgeInputFile(filePath: string, rules: string[], targets: string[], allWorkspaceFiles: string[]): Promise<void> {
        const sfgeTargets: SfgeTarget[] = targets.map(target => {
            return {
                targetFile: target,
                targetMethods: []
            };
        });
        const inputFileContents: SfgeInputFile = {
            targets: sfgeTargets,
            projectDirs: allWorkspaceFiles,
            rulesToRun: rules
        };
        return fs.promises.writeFile(filePath, JSON.stringify(inputFileContents));
    }
}

function handleRunStdOut(stdOutMsg: string, emitLog: (logLevel: LogLevel, msg: string) => void, emitProgress: (percComplete: number, msg?: string) => void): void {
    if (stdOutMsg.startsWith(SFCA_REALTIME_START) && stdOutMsg.endsWith(SFCA_REALTIME_END)) {
        const sfgeMessages: SfgeMessage[] = JSON.parse(stdOutMsg.slice(
            SFCA_REALTIME_START.length,
            stdOutMsg.length - SFCA_REALTIME_END.length)
        );
        for (const sfgeMessage of sfgeMessages) {
            if (isSfgeLogMessage(sfgeMessage)) {
                if (sfgeMessage.messageSeverity === 'TELEMETRY') {
                    // TODO: TELEMETRY
                } else {
                    const processedMessage = getMessage(sfgeMessage.messageKey, ...sfgeMessage.args);
                    emitLog(sfgeLogLevelToSfcaLogLevel(sfgeMessage.messageSeverity), processedMessage);
                }
            } else if (isSfgeProgressMessage(sfgeMessage)) {
                const processedMessage = getMessage(sfgeMessage.messageKey, ...sfgeMessage.args);
                const completionPercent: number = sfgeMessage.progressPercent;
                emitProgress(10 + 85 * completionPercent / 100, processedMessage); // 10%-95%
            }
        }
    }
}

function processMessageFromFailedRun(errMsg: string): string {
    const indexOfErrorDelimiter: number = errMsg.indexOf(SFGE_ERROR_START);
    return indexOfErrorDelimiter > 0
        // If the error message includes our error delimiter string, then we should pull out that error
        // and wrap it in something slightly easier for the user to read.
        ? getMessage('error_external_sfgeIncompleteAnalysis', errMsg.slice(indexOfErrorDelimiter + SFGE_ERROR_START.length).trim())
        // Otherwise, keep the error message styled as it came back from the Java Command Executor.
        : /* istanbul ignore next */ errMsg;
}

function isSfgeLogMessage(sfgeMessage: SfgeMessage): sfgeMessage is SfgeLogMessage {
    return 'messageSeverity' in sfgeMessage;
}

function isSfgeProgressMessage(sfgeMessage: SfgeMessage): sfgeMessage is SfgeProgressMessage {
    return 'progressPercent' in sfgeMessage;
}

function sfgeLogLevelToSfcaLogLevel(sfgeLogLevel: string): LogLevel {
    switch (sfgeLogLevel.toLowerCase()) {
        // istanbul ignore next
        case 'error':
            return LogLevel.Error;
        // istanbul ignore next
        case 'warning':
            return LogLevel.Warn;
        // istanbul ignore next
        case 'info':
            return LogLevel.Info;
        case 'debug':
            return LogLevel.Debug;
        // istanbul ignore next
        default:
            throw new Error(`Developer error: unexpected Log4J log level '${sfgeLogLevel}`);
    }
}
