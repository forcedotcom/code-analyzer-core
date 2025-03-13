import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createTempDir, indent, JavaCommandExecutor} from "../../src/utils";

describe('Tests for createTempDir', () => {
    it('Successfully creates temporary directory', async () => {
        // Before testing, figure out how many entries are in the temp folder.
        const preTestTempContentsCount: number = (await fs.promises.readdir(os.tmpdir())).length;

        // Create the directory.
        const tempDir: string = await createTempDir();

        // Verify that the temp folder has one additional entry, and that an entry with the temporary name now exists.
        const postTestTempContentsCount: number = (await fs.promises.readdir(os.tmpdir())).length;
        expect(postTestTempContentsCount).toEqual(preTestTempContentsCount + 1);
        expect(fs.existsSync(tempDir)).toEqual(true);
    });
})

describe('Tests for JavaCommandExecutor', () => {
    it('When a java command fails due to invalid command, then a helpful error should be thrown', async () => {
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor();
        await expect(javaCommandExecutor.exec(['doesNotExist'])).rejects.toThrow(
            /The following call to 'java' exited with non-zero exit code./);
    });

    it('When a java command is valid, then no error is thrown', async () => {
        const javaCommandExecutor: JavaCommandExecutor = new JavaCommandExecutor();
        await expect(javaCommandExecutor.exec(['--version'])).resolves.not.toThrow();
    });
});

describe('Test for indent', () => {
    it('When using standard indentation then four spaces should be used', () => {
        expect(indent(`This is a test\nof a multiline\nmessage`)).toEqual(
            `    This is a test\n` +
            `    of a multiline\n` +
            `    message`);
    });

    it('When using non-standard indentation then provided indentation should be used', () => {
        expect(indent(`item 1\nitem 2\nitem 3\nitem 4`, '--> ')).toEqual(
            `--> item 1\n` +
            `--> item 2\n` +
            `--> item 3\n` +
            `--> item 4`);
    });
});