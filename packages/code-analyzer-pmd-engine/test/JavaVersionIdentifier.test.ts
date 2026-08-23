import path from "node:path";
import cp from "node:child_process";
import {EventEmitter} from "node:events";
import {RuntimeJavaVersionIdentifier} from "../src/JavaVersionIdentifier";

// Under ts-jest the source runs from src/, so its __dirname (the cwd the spawn is pinned to) is this dir.
const TRUSTED_DIR: string = path.resolve(__dirname, '..', 'src');

function stubJavaProcess(stderrLine: string, exitCode: number = 0): cp.ChildProcessWithoutNullStreams {
    const child = Object.assign(new EventEmitter(), {stderr: new EventEmitter()});
    process.nextTick(() => {
        child.stderr.emit('data', Buffer.from(stderrLine));
        child.emit('exit', exitCode);
    });
    return child as unknown as cp.ChildProcessWithoutNullStreams;
}

describe('RuntimeJavaVersionIdentifier CWE-427 regression', () => {
    afterEach(() => jest.restoreAllMocks());

    // The java -version spawn must run from a trusted directory; inheriting the scanned-repo cwd would let a
    // repo-local java.exe shadow the real one on Windows. We assert the cwd is pinned instead of spawning a
    // real fake-java, since a directly-spawned command cannot be a portable script across OSes.
    it('pins the java -version spawn cwd to the trusted module directory', async () => {
        const spawnSpy = jest.spyOn(cp, 'spawn')
            .mockImplementation(() => stubJavaProcess('openjdk version "11.0.6" 2020-01-14'));

        const version = await new RuntimeJavaVersionIdentifier().identifyJavaVersion('java');

        expect(version?.toString()).toEqual('11.0.6');
        expect(spawnSpy).toHaveBeenCalledWith('java', ['-version'], {cwd: TRUSTED_DIR});
    });
});
