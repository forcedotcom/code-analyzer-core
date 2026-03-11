import {changeWorkingDirectoryToPackageRoot} from "./test-helpers";
import {LogLevel} from "@salesforce/code-analyzer-engine-api";
import {JavaCommandExecutor} from "@salesforce/code-analyzer-engine-api/utils";
import {PmdWrapperInvoker, PmdAstDumpResults} from "../src/pmd-wrapper";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

describe('Tests for invokeAstDumpCommand method of PmdWrapperInvoker', () => {
    let javaCommandExecutor: JavaCommandExecutor;
    let pmdWrapperInvoker: PmdWrapperInvoker;
    let workingFolder: string;
    let logEvents: Array<{level: LogLevel, message: string}>;

    beforeEach(() => {
        javaCommandExecutor = new JavaCommandExecutor();
        logEvents = [];
        pmdWrapperInvoker = new PmdWrapperInvoker(
            javaCommandExecutor,
            [],
            (level: LogLevel, message: string) => {
                logEvents.push({level, message});
            }
        );
        workingFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'pmd-ast-dump-test-'));
    });

    afterEach(() => {
        // Clean up working folder
        if (fs.existsSync(workingFolder)) {
            fs.rmSync(workingFolder, {recursive: true, force: true});
        }
    });

    it('When calling invokeAstDumpCommand with valid Apex file, then AST is generated successfully', async () => {
        const apexFile = path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'AvoidDebugStatements.cls');
        const progressEvents: number[] = [];

        const results: PmdAstDumpResults = await pmdWrapperInvoker.invokeAstDumpCommand(
            'apex',
            apexFile,
            workingFolder,
            'UTF-8',
            (progress: number) => progressEvents.push(progress)
        );

        // Assert results
        expect(results.file).toBe(apexFile);
        expect(results.ast).toBeDefined();
        expect(results.ast).not.toBeNull();
        expect(results.ast!).toContain('<?xml version');
        expect(results.ast!).toContain('<ApexFile');
        expect(results.error).toBeUndefined();

        // Assert progress events
        expect(progressEvents).toContain(5);
        expect(progressEvents).toContain(10);
        expect(progressEvents).toContain(95);
        expect(progressEvents).toContain(100);

        // Assert log events
        const fineLogEvents = logEvents.filter(e => e.level === LogLevel.Fine);
        expect(fineLogEvents.length).toBeGreaterThan(0);
        expect(fineLogEvents.some(e => e.message.includes('Calling AST dump'))).toBe(true);
    });

    it('When calling invokeAstDumpCommand with valid Visualforce file, then AST is generated successfully', async () => {
        const vfFile = path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'VfUnescapeEl.page');
        const progressEvents: number[] = [];

        const results: PmdAstDumpResults = await pmdWrapperInvoker.invokeAstDumpCommand(
            'visualforce',
            vfFile,
            workingFolder,
            'UTF-8',
            (progress: number) => progressEvents.push(progress)
        );

        // Assert results
        expect(results.file).toBe(vfFile);
        expect(results.ast).toBeDefined();
        expect(results.ast).not.toBeNull();
        expect(results.ast!).toContain('<?xml version');
        expect(results.error).toBeUndefined();

        // Assert progress events include start and end
        expect(progressEvents).toContain(5);
        expect(progressEvents).toContain(100);
    });

    it('When calling invokeAstDumpCommand with non-existent file, then error is returned', async () => {
        const nonExistentFile = path.join(workingFolder, 'DoesNotExist.cls');

        const results: PmdAstDumpResults = await pmdWrapperInvoker.invokeAstDumpCommand(
            'apex',
            nonExistentFile,
            workingFolder,
            'UTF-8',
            () => {}
        );

        // Assert error is returned
        expect(results.file).toBe(nonExistentFile);
        expect(results.ast).toBeFalsy(); // null or undefined
        expect(results.error).toBeDefined();
        expect(results.error!.file).toBe(nonExistentFile);
        expect(results.error!.message).toContain('File not found');
    });

    it('When calling invokeAstDumpCommand with invalid language, then error is returned', async () => {
        const apexFile = path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'AvoidDebugStatements.cls');

        const results: PmdAstDumpResults = await pmdWrapperInvoker.invokeAstDumpCommand(
            'invalid_language',
            apexFile,
            workingFolder,
            'UTF-8',
            () => {}
        );

        // Assert error is returned
        expect(results.file).toBe(apexFile);
        expect(results.ast).toBeFalsy(); // null or undefined
        expect(results.error).toBeDefined();
        expect(results.error!.message).toContain('Language not supported');
    });

    it('When calling invokeAstDumpCommand with invalid Apex syntax, then error is returned', async () => {
        // Create a file with invalid Apex syntax
        const invalidApexFile = path.join(workingFolder, 'Invalid.cls');
        const invalidApexCode = 'public class Invalid {\n    #### SYNTAX ERROR ####\n}';
        fs.writeFileSync(invalidApexFile, invalidApexCode, 'utf-8');

        const results: PmdAstDumpResults = await pmdWrapperInvoker.invokeAstDumpCommand(
            'apex',
            invalidApexFile,
            workingFolder,
            'UTF-8',
            () => {}
        );

        // Assert error is returned
        expect(results.file).toBe(invalidApexFile);
        expect(results.ast).toBeFalsy(); // null or undefined
        expect(results.error).toBeDefined();
        expect(results.error!.file).toBe(invalidApexFile);
        // Error message should indicate parsing issue
        expect(results.error!.message.length).toBeGreaterThan(0);
    });

    it('When calling invokeAstDumpCommand with valid encoding parameter, then AST is generated', async () => {
        const apexFile = path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'AvoidDebugStatements.cls');

        const results: PmdAstDumpResults = await pmdWrapperInvoker.invokeAstDumpCommand(
            'apex',
            apexFile,
            workingFolder,
            'UTF-8', // Use UTF-8 since the file is actually UTF-8
            () => {}
        );

        // Should succeed
        expect(results.file).toBe(apexFile);
        expect(results.ast).toBeDefined();
        expect(results.ast).not.toBeNull();
        expect(results.error).toBeUndefined();
    });

    it('When calling invokeAstDumpCommand, then input and output files are created in working folder', async () => {
        const apexFile = path.join(TEST_DATA_FOLDER, 'samplePmdWorkspace', 'sampleViolations', 'AvoidDebugStatements.cls');

        await pmdWrapperInvoker.invokeAstDumpCommand(
            'apex',
            apexFile,
            workingFolder,
            'UTF-8',
            () => {}
        );

        // Verify input file was created
        const inputFile = path.join(workingFolder, 'astDumpInput.json');
        expect(fs.existsSync(inputFile)).toBe(true);

        const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
        expect(inputData.language).toBe('apex');
        expect(inputData.fileToDump).toBe(apexFile);
        expect(inputData.encoding).toBe('UTF-8');

        // Verify output file was created
        const outputFile = path.join(workingFolder, 'astDumpResults.json');
        expect(fs.existsSync(outputFile)).toBe(true);
    });
});
