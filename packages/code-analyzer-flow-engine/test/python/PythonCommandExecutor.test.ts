import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as fsp from 'node:fs/promises';

import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';

const PATH_TO_ERROR_THROWER = path.resolve(__dirname, '..', 'test-data', 'executable-scripts', 'error-thrower.py');
const PATH_TO_CWD_PROBE = path.resolve(__dirname, '..', 'test-data', 'executable-scripts', 'cwd-probe.py');
// The trust anchor: the bundled FlowScanner root that the executor pins PYTHONPATH to. Mirrors
// PATH_TO_FLOW_SCANNER_ROOT in PythonCommandExecutor.ts (path.join(__dirname, '..', '..', 'FlowScanner')),
// resolved from the compiled dist/python directory. From the test's location that is two levels up.
const PATH_TO_FLOW_SCANNER_ROOT = fs.realpathSync(path.resolve(__dirname, '..', '..', 'FlowScanner'));


describe('PythonCommandExecutor', () => {
    const executor: PythonCommandExecutor = new PythonCommandExecutor('python3');
    describe('#exec()', () => {
        it('When invoked script fails, rejects with informative message', async () => {
            const pathToGoldfile = path.resolve(__dirname, '..', 'test-data', 'goldfiles', 'PythonCommandExecutor.test.ts', 'error.goldfile.txt');
            const expectedOutput: string = (await fsp.readFile(pathToGoldfile, {encoding: 'utf-8'}))
                .replace('__PYTHON__', 'python3')
                .replace('__FILE__', PATH_TO_ERROR_THROWER);

            let errorThrown: boolean = false;
            let msg: string = '';
            try {
                await executor.exec([PATH_TO_ERROR_THROWER]);
            } catch (e) {
                msg = e instanceof Error ? e.message : e as string;
                errorThrown = true;
            }
            expect(errorThrown).toEqual(true);
            // The need to clean up carriage returns prevents us from using the `await expect().rejects` syntax that we'd
            // typically use.
            expect(msg.replaceAll('\r\n', '\n')).toEqual(expectedOutput);
        });

        it('When scanned repo plants a flow_scanner module, spawned python does not execute it (no cwd-based sys.path[0] shadowing)', async () => {
            // Regression test for the CWE-427 module-shadowing RCE: because CPython places the process's
            // current working directory at sys.path[0] (ahead of PYTHONPATH), a spawned python that inherits
            // the CLI's cwd (the scanned repo) would resolve a repo-planted `flow_scanner` package instead of
            // the trusted bundled one. We prove the child process runs from the trusted FlowScanner root and
            // that a hostile payload planted in the scanned directory is never executed.
            const tempDir: string = await fsp.mkdtemp(path.join(os.tmpdir(), 'flow-shadowing-test-'));
            const sentinelFile: string = path.join(tempDir, 'PWNED.txt');
            const originalCwd: string = process.cwd();
            try {
                // Plant a hostile `flow_scanner` package that writes a sentinel file if it is ever imported/run.
                const maliciousModuleDir: string = path.join(tempDir, 'flow_scanner');
                await fsp.mkdir(maliciousModuleDir);
                await fsp.writeFile(path.join(maliciousModuleDir, '__init__.py'), '', 'utf-8');
                await fsp.writeFile(path.join(maliciousModuleDir, '__main__.py'),
                    `import os\n` +
                    `with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'PWNED.txt'), 'w') as f:\n` +
                    `    f.write('pwned')\n`,
                    'utf-8');

                // Simulate the CLI being invoked from within the scanned repo.
                process.chdir(tempDir);

                let capturedStdout: string = '';
                await executor.exec([PATH_TO_CWD_PROBE], (line: string) => {
                    capturedStdout += line;
                });

                const probeResult: {cwd: string; syspath0: string} = JSON.parse(capturedStdout);
                // The spawned child's working directory is what CPython places at sys.path[0] when invoked
                // with `-m flow_scanner`. Pinning it to the trusted bundled FlowScanner root (rather than the
                // inherited, attacker-controlled scanned repo) is exactly what closes the shadowing vector.
                expect(fs.realpathSync(probeResult.cwd)).toEqual(PATH_TO_FLOW_SCANNER_ROOT);
                expect(fs.realpathSync(probeResult.cwd)).not.toEqual(fs.realpathSync(tempDir));

                // Defense-in-depth: no hostile payload planted in the scanned directory was executed.
                expect(fs.existsSync(sentinelFile)).toEqual(false);
            } finally {
                process.chdir(originalCwd);
                await fsp.rm(tempDir, {recursive: true, force: true});
            }
        });
    });
});