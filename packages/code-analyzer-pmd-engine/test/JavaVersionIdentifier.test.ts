import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as fsp from "node:fs/promises";
import {RuntimeJavaVersionIdentifier} from "../src/JavaVersionIdentifier";

const EXECUTABLE_SCRIPTS_DIR: string = path.resolve(__dirname, 'test-data', 'executable-scripts');
const PATH_TO_FAKE_JAVA: string = path.join(EXECUTABLE_SCRIPTS_DIR, 'fake-java.sh');
const PATH_TO_PLANTED_JAVA_MARKER: string = path.join(EXECUTABLE_SCRIPTS_DIR, 'planted-java-marker.sh');
// The fake-java probe records the cwd it was actually spawned with into this file (a fixed path alongside
// the script). We report through a file rather than reading the child's stdout because jest's node
// testEnvironment sandboxes process.env, so an env-var-based channel would not reach the spawned child.
const PATH_TO_SPAWN_CWD_REPORT: string = path.join(EXECUTABLE_SCRIPTS_DIR, 'spawn-cwd-report.txt');
// The trust anchor: the engine's own installed module directory that identifyJavaVersion pins the java
// -version spawn's cwd to. This mirrors __dirname of the source module (JavaVersionIdentifier.ts). Under
// ts-jest the source runs from src (not dist), so the trusted directory resolves to the package's src dir.
const TRUSTED_DIR: string = fs.realpathSync(path.resolve(__dirname, '..', 'src'));

describe('Security regression: java -version spawn is not satisfiable by a repo-local (cwd) executable', () => {
    // Regression tests for the CWE-427 search-path-element RCE. This identifier is shared by both the PMD and
    // CPD sub-engines. On Windows, spawning a bare command name (the "java" auto-detect fallback) without
    // pinning cwd lets child_process resolve an attacker-committed java.exe from the inherited scanned-repo
    // cwd ahead of the trusted PATH entry. Pinning the spawn's cwd to this engine's installed module directory
    // (__dirname) closes that vector while leaving absolute-path and PATH-resolved java resolution unchanged.
    // Mirrors the Flow engine test pattern (test/python/PythonCommandExecutor.test.ts).

    it('spawned java child runs from a trusted directory, not the inherited scanned-repo cwd', async () => {
        const tempDir: string = await fsp.mkdtemp(path.join(os.tmpdir(), 'pmd-java-cwd-test-'));
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
        const tempDir: string = await fsp.mkdtemp(path.join(os.tmpdir(), 'pmd-java-planted-test-'));
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
