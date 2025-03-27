import fs from 'node:fs';
import os from 'node:os';
import {createTempDir, FixedClock, indent, JavaCommandExecutor, RealClock} from "../../src/utils";


describe('Tests for Clock', () => {
    const fixedClock: FixedClock = new FixedClock(new Date(2025, 2, 21, 12, 30, 25, 20));

    describe('Tests for #formatToDateTimeString()', () => {
        it('Properly formats string', () => {
            expect(fixedClock.formatToDateTimeString()).toEqual('2025_03_21_12_30_25_020');
        });
    });

    describe('Tests for RealClock#now()', () => {
        it('Returns accurate DateTime', () => {
            // Get the time at the start of the test.
            const floor: number = Date.now();
            // Use a RealClock to get a timestamp.
            const now: number = new RealClock().now().getTime();
            // Get the time after using the RealClock.
            const ceiling: number = Date.now();
            expect(now).toBeGreaterThanOrEqual(floor);
            expect(now).toBeLessThanOrEqual(ceiling);
        });
    });
})

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
