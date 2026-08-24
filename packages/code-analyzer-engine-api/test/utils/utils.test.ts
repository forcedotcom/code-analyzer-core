import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import cp from "node:child_process";
import {EventEmitter} from "node:events";
import {FixedClock, indent, JavaCommandExecutor, RealClock} from "../../src/utils";

jest.setTimeout(30_000);

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

function stubJavaExecProcess(exitCode: number = 0): cp.ChildProcessWithoutNullStreams {
    // Mimics the surface JavaCommandExecutor.exec() consumes: stdout/stderr streams plus a 'close' event.
    const child = Object.assign(new EventEmitter(), {stdout: new EventEmitter(), stderr: new EventEmitter()});
    process.nextTick(() => child.emit('close', exitCode));
    return child as unknown as cp.ChildProcessWithoutNullStreams;
}

describe('JavaCommandExecutor CWE-427 cwd pinning', () => {
    // Under ts-jest the source runs from src/, so java-utils.ts's __dirname (the cwd the spawn is pinned to) is
    // the src/utils dir. This is the shared executor for the actual PMD, CPD, and SFGE rule-listing/execution
    // path (not just the version probe).
    const TRUSTED_DIR: string = path.resolve(__dirname, '..', '..', 'src', 'utils');

    afterEach(() => jest.restoreAllMocks());

    // Regression guard: inheriting the scanned-repo cwd would let a repo-local java.exe shadow the real one on
    // Windows, where a bare command name resolves cwd-before-PATH. We assert the spawn cwd is pinned to the trusted
    // module dir rather than the inherited process cwd. (OS-level shadowing is proven by the Windows integration
    // test below; a directly-spawned command cannot be a portable fake-java script across OSes.)
    it('pins the java spawn cwd to the trusted engine-api module directory', async () => {
        const spawnSpy = jest.spyOn(cp, 'spawn').mockImplementation(() => stubJavaExecProcess(0));

        await new JavaCommandExecutor('java').exec(['-version']);

        expect(spawnSpy).toHaveBeenCalledWith('java', ['-version'], {cwd: TRUSTED_DIR});
        // The pin must not be the inherited (scanned-repo) cwd — that is the vulnerable behavior.
        expect(TRUSTED_DIR).not.toEqual(process.cwd());
    });

    // End-to-end proof of the security property on the only OS where it is reachable. Windows resolves a bare
    // command name cwd-before-PATH, so a repo-local java.exe can shadow the real one; macOS/Linux use PATH only
    // (execvp) and never consult cwd, so this test is skipped there. The CI matrix runs the windows-latest leg,
    // which provisions a real temurin java on PATH via actions/setup-java.
    //
    // We plant a genuine java.exe (a copy of a harmless system .exe) in an attacker-controlled dir and chdir there
    // to simulate scanning that repo. A real .exe is required: on Node >= 18.20.2/20.12.2 (CI uses Node 20)
    // spawning a .bat/.cmd without shell:true throws EINVAL, so a .cmd proxy would never run and the test would
    // pass for the wrong reason. Detection is by output: `java --version` prints its banner to stdout and exits 0
    // on JDK 9+, which the planted hostname.exe cannot reproduce. With the {cwd:__dirname} pin the child resolves
    // to the real PATH java; remove the pin and the planted exe runs instead, failing both assertions below.
    const itOnWindows = process.platform === 'win32' ? it : it.skip;
    itOnWindows('does not execute a repo-local java.exe planted in the scanned-repo cwd', async () => {
        const attackDir: string = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cwd-shadow-'));
        // A genuine .exe named exactly "java.exe": Windows resolves a bare "java" to it when the cwd is searched.
        await fs.promises.copyFile(
            path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'hostname.exe'),
            path.join(attackDir, 'java.exe'));

        const originalCwd: string = process.cwd();
        let stdout: string = '';
        let execError: string = '';
        try {
            process.chdir(attackDir); // simulate the CLI being invoked from inside the untrusted repo
            await new JavaCommandExecutor('java').exec(['--version'], [], line => { stdout += line + '\n'; });
        } catch (err) {
            execError = (err as Error).message;
        } finally {
            process.chdir(originalCwd);
            await fs.promises.rm(attackDir, {recursive: true, force: true});
        }

        // The real PATH java must have run (its version banner reached stdout) and not the planted hostname.exe.
        expect(stdout.toLowerCase()).toMatch(/java|jdk|openjdk|runtime|hotspot/);
        expect(execError).toEqual('');
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
