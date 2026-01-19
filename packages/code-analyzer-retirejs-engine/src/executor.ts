import {Finding} from "retire/lib/types";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import fs from "node:fs";
import * as utils from "./utils";
import path from "node:path";
import {DecoratedStreamZip} from './zip-decorator';
import {getMessage} from "./messages";
import {LogLevel} from "@salesforce/code-analyzer-engine-api";

// To handle the special case where a vulnerable library is found within a zip archive, a RetireJsExecutor can use this
// marker to update the file field to look like <zip_file>::[ZIPPED_FILE]::<embedded_file> which the engine handles.
export const ZIPPED_FILE_MARKER = '::[ZIPPED_FILE]::';

const RETIRE_JS_VULN_REPO_FILE: string = path.resolve(__dirname, '..', 'vulnerabilities', 'RetireJsVulns.json')
const RETIRE_COMMAND: string = utils.findCommand('retire');
export const JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];

export interface RetireJsExecutor {
    execute(filesAndFolders: string[], workingFolder: string): Promise<Finding[]>
}

export type EmitLogEventFcn = (logLevel: LogLevel, msg: string) => void;
const NO_OP: () => void = () => {};

const IS_WINDOWS: boolean = process.platform.startsWith('win');

/**
 * SimpleRetireJsExecutor - A simple wrapper around the retire command
 *
 * This executor does not do anything fancy and therefore only catches what users could catch if they ran
 * the retire command themselves.
 *
 * Currently, the SimpleRetireJsExecutor is just used by the AdvancedRetireJsExecutor where we always pass in
 * temporary folders to scan. In the future we might consider allowing users to configure the retire-js engine if
 * they want to just run this simple RetireJs strategy on their input directly. At that point, the advantage would
 * be that we wouldn't make any copies of their code to a temporary directory, thus allowing them to use of
 * '.retireignore' and '.retireignore.json' files in their project if they wish to do so.
 */
export class SimpleRetireJsExecutor implements RetireJsExecutor {
    private readonly emitLogEvent: EmitLogEventFcn;

    // A counter to just help generate unique numbers to be appended to the generated result files.
    private uniqNameCounter: number = 0;

    constructor(emitLogEvent: EmitLogEventFcn = NO_OP) {
        this.emitLogEvent = emitLogEvent;
    }

    async execute(targetFilesAndFolders: string[], workingFolder: string): Promise<Finding[]> {
        let findings: Finding[] = [];
        for (const fileOrFolder of targetFilesAndFolders) {
            if (fs.statSync(fileOrFolder).isFile()) {
                findings = findings.concat(await this.scanFile(fileOrFolder));
            } else {
                findings = findings.concat(await this.scanFolder(fileOrFolder, workingFolder));
            }
        }
        return findings;
    }

    private async scanFile(_file: string): Promise<Finding[]> {
        // This line shouldn't be hit in production since users can't directly access this SimpleRetireJsExecutor themselves yet.
        // See: https://github.com/RetireJS/retire.js/blob/master/node/README.md#retireignore
        throw new Error('Currently the SimpleRetireJsExecutor does not support scanning individual files.');
    }

    private async scanFolder(folderToScan: string, workingFolder: string): Promise<Finding[]> {
        const tempOutputFile: string = path.join(workingFolder, `output_${this.uniqNameCounter++}.json`);
        const commandArgs: string[] = [
            '--path', folderToScan,
            '--exitwith', '13',
            '--outputformat', 'jsonsimple',
            '--outputpath', tempOutputFile,
            '--jsrepo', RETIRE_JS_VULN_REPO_FILE,
            '--ext', JS_EXTENSIONS.map(ext => ext.replace('.','')).join(',')
        ]

        const cmdStr: string = `${RETIRE_COMMAND} ${commandArgs.map(a => a.includes(' ') ?
            /* istanbul ignore next */ `"${a}"` : a).join(',')}`;
        this.emitLogEvent(LogLevel.Fine, `Executing command: ${cmdStr}`);
        try {
            await this.runRetireCmdWithArgs(RETIRE_COMMAND, commandArgs);
        } catch (err) /* istanbul ignore next */ {
            const errMsg: string = err instanceof Error ? (err as Error).message : `${err}`;
            throw new Error(getMessage('UnexpectedErrorWhenExecutingCommand', cmdStr, errMsg));
        }

        this.emitLogEvent(LogLevel.Fine, `Parsing output file: ${tempOutputFile}`);
        try {
            const fileContents: string = fs.readFileSync(tempOutputFile, 'utf-8');
            return JSON.parse(fileContents) as Finding[];
        } catch (err) {
            /* istanbul ignore next */
            throw new Error(getMessage('UnexpectedErrorWhenProcessingOutputFile', tempOutputFile, (err as Error).message),
                {cause: err});
        }
    }

    private async runRetireCmdWithArgs(cmd:string, argArray: string[]): Promise<void> {
        return new Promise<void>((res, rej) => {
            const cmdPath: string = ['.', path.basename(cmd)].join(path.sep);
            // On Windows, since we are calling a script (not a native command) then we must use shell and when using
            // shell, it is required to wrap arguments that have spaces with double quotes. Currently, we control
            // the arguments and they most likely won't have spaces, but we should add in the wrap just in case.
            const childProcess: ChildProcessWithoutNullStreams = IS_WINDOWS ?
                spawn(cmdPath, wrapArgsWithSpacesWithQuotes(argArray), {shell: true, cwd: path.dirname(cmd)}) :
                spawn(cmdPath, argArray, {cwd: path.dirname(cmd)});

            let output: string = '';
            /* istanbul ignore next */
            const processOutput = (data: string) => output += data;
            childProcess.stdout.on('data', processOutput);
            childProcess.stderr.on('data', processOutput);
            /* istanbul ignore next */
            childProcess.on('error', err => rej(err.message));
            childProcess.on('exit', (code: number) => {
                /* istanbul ignore else */
                if (code === 0 || code === 13) { // 0: success with 0 found,  13: success with >0 found
                    res();
                } else {
                    rej(output);
                }
            });
        });
    }
}

/**
 * AdvancedRetireJsExecutor - An advanced strategy of calling retire that does a lot more work to catch more vulnerabilities
 *
 * This executor examines all specifies files and makes a copy of all text based files into a temporary folder, renaming
 * the files with a .js extension before running the retire command on that folder. Additionally, it extracts all zip
 * folders as well into this temporary folder. If any vulnerabilities are found in the temporary duplicated/extracted
 * files then these vulnerabilities are mapped back to the original file names. If a vulnerability is found in a file
 * that is from an extracted zip folder, then we update the file field to look like
 *    <zip_file>::[ZIPPED_FILE]::<embedded_file>
 * which the engine then knows how to further process with special handling.
 */
export class AdvancedRetireJsExecutor implements RetireJsExecutor {
    private readonly simpleExecutor: RetireJsExecutor;
    private readonly emitLogEvent: EmitLogEventFcn;

    // Map to associate each temp file (under the parentTempDir) to its original file
    private readonly tempToOrigFileMap: Map<string, string> = new Map();

    // Map to associate a list of original folders to a corresponding temporary subfolders name
    private readonly origToTempDirMap: Map<string, string> = new Map();

    // A counter to just help generate unique numbers to be appended to the generated file and subfolder names.
    // Since this counter is used for both files and folders which, it may not give the best human names for debugging.
    private uniqNameCounter: number = 0;

    constructor(emitLogEvent: EmitLogEventFcn = NO_OP) {
        this.simpleExecutor = new SimpleRetireJsExecutor(emitLogEvent);
        this.emitLogEvent = emitLogEvent;
    }

    /**
     * Note that this execute function assumes that only files are passed in.
     */
    async execute(targetFiles: string[], workingFolder: string): Promise<Finding[]> {
        const { textFiles, zipFiles } = separateTextAndZipFiles(targetFiles);
        if (textFiles.length + zipFiles.length === 0) {
            return []; // Quick return
        }

        const parentFolder: string = await this.prepareTempDirs(textFiles, workingFolder);
        this.emitLogEvent(LogLevel.Fine, `Created a temporary directory where relevant files will be copied to for scanning: ${parentFolder}`);

        await Promise.all([
            ...textFiles.map(file => this.processTextFile(file)),
            ...zipFiles.map(file => this.processZipFile(file, parentFolder))]);
        this.emitLogEvent(LogLevel.Fine, `Finished copying relevant files to temporary directory: '${parentFolder}'`);

        const findings: Finding[] = await this.simpleExecutor.execute([parentFolder], workingFolder);
        for (let i = 0; i < findings.length; i++) {
            findings[i].file = this.tempToOrigFileMap.get(findings[i].file) as string;
        }
        return findings;
    }

    /**
     *  Create parent temporary directory (that cleans up after itself when process exits) and add subdirectories under
     *  the parent for each of the unique folders containing text files
     */
    private async prepareTempDirs(textFiles: string[], workingFolder: string): Promise<string> {
        const parentFolder =  this.makeUniqueTempDirName(workingFolder);
        await fs.promises.mkdir(parentFolder);
        this.origToTempDirMap.clear();
        this.tempToOrigFileMap.clear();
        this.uniqNameCounter = 0;
        const mkdirPromises: Promise<void>[] = [];
        for (const textFile of textFiles) {
            const folder: string = path.dirname(textFile);
            if (!this.origToTempDirMap.has(folder)) {
                const tempDir: string = this.makeUniqueTempDirName(parentFolder);
                this.origToTempDirMap.set(folder, tempDir);
                mkdirPromises.push(fs.promises.mkdir(tempDir));
            }
        }
        await Promise.all(mkdirPromises);
        return parentFolder;
    }

    /**
     * Make a symlink of the text file into its associated temporary directory with a .js file extension
     * Additionally, we update tempToOrigFileMap so that the original text file can be mapped from the temporary file.
     */
    private async processTextFile(origTextFile: string): Promise<void> {
        const fileInfo: path.ParsedPath = path.parse(origTextFile);
        const tempDir: string = this.origToTempDirMap.get(fileInfo.dir) as string;
        const fileNameWithJsExt: string = this.makeUniqueJsFileNameFor(fileInfo);
        const tempTextFile: string = tempDir + path.sep + fileNameWithJsExt;
        this.tempToOrigFileMap.set(tempTextFile, origTextFile);
        return utils.linkOrCopy(origTextFile, tempTextFile);
    }

    /**
     * Extract text files from zip file forcing them to have a js extension.
     * Additionally, we update the tempToOrigFileMap so that the temp file points to the embedded zip file as:
     *   <zip_file>::[ZIPPED_FILE]::<embedded_file>
     */
    private async processZipFile(zipFile: string, parentFolder: string): Promise<void> {
        const zip: DecoratedStreamZip = new DecoratedStreamZip({file: zipFile, storeEntries: true});
        const entries = await zip.entries();
        for (const entry of Object.values(entries)) {
            if (entry.isDirectory || !(await utils.isTextFile(await zip.entryData(entry.name)))) {
                continue; // Skip directories and non-text files.
            }
            const zippedFileInfo: path.ParsedPath = path.parse(entry.name);
            const folderInZip: string = `${zipFile}${ZIPPED_FILE_MARKER}${zippedFileInfo.dir}`;
            if (!this.origToTempDirMap.has(folderInZip)) {
                const tempSubDir: string = this.makeUniqueTempDirName(parentFolder);
                this.origToTempDirMap.set(folderInZip, tempSubDir);
                await fs.promises.mkdir(tempSubDir);
            }
            const tempDir: string = this.origToTempDirMap.get(folderInZip) as string;
            const zippedFileNameWithJsExt: string = this.makeUniqueJsFileNameFor(zippedFileInfo);
            const tempUnzippedFile: string = tempDir + path.sep + zippedFileNameWithJsExt;
            this.tempToOrigFileMap.set(tempUnzippedFile, `${zipFile}${ZIPPED_FILE_MARKER}${entry.name}`);
            await zip.extract(entry.name, tempUnzippedFile);
        }
        await zip.close();
    }

    /**
     *  Returns the file name if it already is a javascript file (to allow vulnerability detection based on filename).
     *  Otherwise, returns a temp name with a .js extension so that it can be scanned.
     */
    private makeUniqueJsFileNameFor(fileInfo: path.ParsedPath): string {
        return JS_EXTENSIONS.includes(fileInfo.ext) ? fileInfo.base : `TMPFILE_${this.uniqNameCounter++}.js`;
    }

    private makeUniqueTempDirName(parentFolder: string): string {
        return `${parentFolder}${path.sep}TMPDIR_${this.uniqNameCounter++}`;
    }
}

function separateTextAndZipFiles(files: string[]): {textFiles: string[], zipFiles: string[]} {
    const textFiles: string[] = [];
    const zipFiles: string[] = [];
    for (const file of files) {
        if (file.toLowerCase().endsWith(".js") || utils.isTextFile(file)) {
            textFiles.push(file);
        } else if (utils.isZipFile(file)) {
            zipFiles.push(file);
        }
    }
    return {textFiles, zipFiles};
}

function wrapArgsWithSpacesWithQuotes(args: string[]): string[] {
    return args.map(arg => arg.includes(' ') ? `"${arg}"` : arg);
}
