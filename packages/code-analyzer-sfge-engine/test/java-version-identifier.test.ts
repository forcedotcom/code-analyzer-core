import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as fsp from "node:fs/promises";
import {SemVer} from "semver";
import {_extractJavaVersionFrom, RuntimeJavaVersionIdentifier} from "../src/java-version-identifier";

const EXECUTABLE_SCRIPTS_DIR: string = path.resolve(__dirname, 'test-data', 'executable-scripts');
const PATH_TO_FAKE_JAVA: string = path.join(EXECUTABLE_SCRIPTS_DIR, 'fake-java.sh');
const PATH_TO_PLANTED_JAVA_MARKER: string = path.join(EXECUTABLE_SCRIPTS_DIR, 'planted-java-marker.sh');
// The fake-java probe records the cwd it was actually spawned with into this file (a fixed path alongside
// the script). We report through a file rather than reading the child's stdout because jest's node
// testEnvironment sandboxes process.env, so an env-var-based channel would not reach the spawned child.
const PATH_TO_SPAWN_CWD_REPORT: string = path.join(EXECUTABLE_SCRIPTS_DIR, 'spawn-cwd-report.txt');
// The trust anchor: the engine's own installed module directory that identifyJavaVersion pins the java
// -version spawn's cwd to. This mirrors __dirname of the source module (java-version-identifier.ts). Under
// ts-jest the source runs from src (not dist), so the trusted directory resolves to the package's src dir.
const TRUSTED_DIR: string = fs.realpathSync(path.resolve(__dirname, '..', 'src'));

describe('Test for _extractJavaVersionFrom helper', () => {
    type VERSION_CASE = {description: string, input: string, expected: SemVer};
    const versionCases: VERSION_CASE[] = [
        {
            description: 'v11_linux',
            input: 'openjdk version "11.0.6" 2020-01-14 LTS\nOpenJDK Runtime Environment Zulu11.37+17-CA (build 11.0.6+10-LTS)\nOpenJDK 64-Bit Server VM Zulu11.37+17-CA (build 11.0.6+10-LTS, mixed mode)\n',
            expected: new SemVer('11.0.6')
        },
        {
            description: 'v8_mac',
            input: 'openjdk version "1.8.0_172"\nOpenJDK Runtime Environment (Zulu 8.30.0.2-macosx) (build 1.8.0_172-b01)\nOpenJDK 64-Bit Server VM (Zulu 8.30.0.2-macosx) (build 25.172-b01, mixed mode)\n',
            expected: new SemVer('1.8.0')
        },
        {
            description: 'v12_linux',
            input: 'java version "12.0.1" 2019-04-16\nJava(TM) SE Runtime Environment (build 12.0.1+12)\nJava HotSpot(TM) 64-Bit Server VM (build 12.0.1+12, mixed mode, sharing)',
            expected: new SemVer('12.0.1')
        },
        { // This comes from https://github.com/forcedotcom/sfdx-scanner/issues/1453
            description: 'v17_with_java_options',
            input: 'Picked up _JAVA_OPTIONS: -Xmx5g\njava version "17.0.11" 2024-04-16 LTS\nJava(TM) SE Runtime Environment (build 17.0.11+7-LTS-207)',
            expected: new SemVer('17.0.11')
        },
        { // This type of output typically comes from "java --version" instead of "java -version" but we will try to support it as well
            description: 'v14_windows',
            input: 'openjdk 14 2020-03-17\r\nOpenJDK Runtime Environment (build 14+36-1461)\r\nOpenJDK 64-Bit Server VM (build 14+36-1461, mixed mode, sharing)\r\n',
            expected: new SemVer('14.0.0')
        }
    ];
    it.each(versionCases)('For version $description, make sure _extractJavaVersionFrom returns expected version', async (caseObj: VERSION_CASE) => {
        const version: SemVer = _extractJavaVersionFrom(caseObj.input)!;
        expect(version.toString()).toEqual(caseObj.expected.toString());
    });

    it('Check that _extractJavaVersionFrom returns null if given garbage without version info', async () => {
        expect(_extractJavaVersionFrom('this is garbage')).toEqual(null);
    });
});

describe('Security regression: java -version spawn is not satisfiable by a repo-local (cwd) executable', () => {
    // Regression tests for the CWE-427 search-path-element RCE. On Windows, spawning a bare command name
    // (the "java" auto-detect fallback) without pinning cwd lets child_process resolve an attacker-committed
    // java.exe from the inherited scanned-repo cwd ahead of the trusted PATH entry. Pinning the spawn's cwd
    // to this engine's installed module directory (__dirname) closes that vector while leaving absolute-path
    // and PATH-resolved java resolution unchanged. Mirrors the Flow engine test pattern
    // (test/python/PythonCommandExecutor.test.ts).

    it('spawned java child runs from a trusted directory, not the inherited scanned-repo cwd', async () => {
        const tempDir: string = await fsp.mkdtemp(path.join(os.tmpdir(), 'sfge-java-cwd-test-'));
        const originalCwd: string = process.cwd();
        try {
            await fsp.rm(PATH_TO_SPAWN_CWD_REPORT, {force: true});
            // Simulate the CLI being invoked from within the scanned (attacker-controlled) repo.
            process.chdir(tempDir);

            await new RuntimeJavaVersionIdentifier().identifyJavaVersion(PATH_TO_FAKE_JAVA);

            const reportedCwd: string = (await fsp.readFile(PATH_TO_SPAWN_CWD_REPORT, {encoding: 'utf-8'})).trim();
            // The spawned child's cwd must be the trusted module directory, never the inherited scanned repo.
            expect(fs.realpathSync(reportedCwd)).toEqual(TRUSTED_DIR);
            expect(fs.realpathSync(reportedCwd)).not.toEqual(fs.realpathSync(tempDir));
        } finally {
            process.chdir(originalCwd);
            await fsp.rm(tempDir, {recursive: true, force: true});
            await fsp.rm(PATH_TO_SPAWN_CWD_REPORT, {force: true});
        }
    });

    it('a java executable planted in the scanned-repo cwd is never invoked', async () => {
        const tempDir: string = await fsp.mkdtemp(path.join(os.tmpdir(), 'sfge-java-planted-test-'));
        const sentinelFile: string = path.join(tempDir, 'PWNED.txt');
        const originalCwd: string = process.cwd();
        try {
            const markerContents: string = await fsp.readFile(PATH_TO_PLANTED_JAVA_MARKER, {encoding: 'utf-8'});
            // Plant a hostile executable named exactly as the bare-command fallback would resolve on each OS.
            const plantedNames: string[] = process.platform === 'win32' ? ['java', 'java.exe'] : ['java'];
            for (const name of plantedNames) {
                const plantedPath: string = path.join(tempDir, name);
                await fsp.writeFile(plantedPath, markerContents, {encoding: 'utf-8', mode: 0o755});
                await fsp.chmod(plantedPath, 0o755);
            }
            process.chdir(tempDir);

            // Probe with the known-good fake java so the promise resolves regardless of the pin working; the
            // assertion of interest is purely whether the planted repo-local executable was ever executed.
            await new RuntimeJavaVersionIdentifier().identifyJavaVersion(PATH_TO_FAKE_JAVA);

            expect(fs.existsSync(sentinelFile)).toEqual(false);
        } finally {
            process.chdir(originalCwd);
            await fsp.rm(tempDir, {recursive: true, force: true});
            await fsp.rm(PATH_TO_SPAWN_CWD_REPORT, {force: true});
        }
    });
});
