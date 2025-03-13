import path from 'node:path';
import fs from 'node:fs';
import {
    getMessageFromCatalog,
    LogLevel,
    SHARED_MESSAGE_CATALOG
} from '@salesforce/code-analyzer-engine-api';
import {createTempDir, JavaCommandExecutor} from '@salesforce/code-analyzer-engine-api/utils';

export type SfgeRuleInfo = {
    name: string;
    description: string;
    category: string;
    severity: number;
    url: string;
    isPilot: boolean;
};

const SFGE_MAIN_JAVA_CLASS: string = "com.salesforce.Sfge";
const SFGE_WRAPPER_LIB_FOLDER: string = path.resolve(__dirname, '..', 'dist', 'java-lib');


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
        const sfgeRulesOutputFile: string = path.join(tmpDir, 'ruleInfo.json');
        emitProgress(10);

        const javaCmdArgs: string[] = [SFGE_MAIN_JAVA_CLASS, 'catalog', 'all', sfgeRulesOutputFile];
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

    private async getTemporaryWorkingDir(): Promise<string> {
        if (this.temporaryWorkingDir === undefined) {
            this.temporaryWorkingDir = await createTempDir();
        }
        return this.temporaryWorkingDir;
    }
}