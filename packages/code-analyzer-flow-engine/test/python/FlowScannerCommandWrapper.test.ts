import fs from 'node:fs';
import path from 'node:path';
import {FlowScannerExecutionResult, RunTimeFlowScannerCommandWrapper} from "../../src/python/FlowScannerCommandWrapper";
import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';
import os from "node:os";

const PYTHON_COMMAND = 'python3';
const PATH_TO_GOLDFILES = path.join(__dirname, '..', 'test-data', 'goldfiles', 'FlowScannerCommandWrapper.test.ts');
const PATH_TO_MULTIPLE_FLOWS_WORKSPACE = path.resolve(__dirname, '..', 'test-data', 'example workspaces', 'contains-multiple-flows');
const PATH_TO_EXAMPLE1: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example1_containsWithoutSharingViolations.flow-meta.xml');
const PATH_TO_EXAMPLE2: string = path.join(PATH_TO_MULTIPLE_FLOWS_WORKSPACE, 'example2_containsWithSharingViolations.flow');

jest.setTimeout(60_000);

describe('FlowScannerCommandWrapper implementations', () => {
    describe('RunTimeFlowScannerCommandWrapper', () => {
        let workingFolder: string;
        let tempLogFile: string;

        beforeAll(async () => {
            workingFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'engine-test'));
            tempLogFile = path.join(workingFolder, "flow_scanner_logfile.log");
        })

        describe('#runFlowScannerRules()', () => {

            describe('Successful execution', () => {
                const wrapper: RunTimeFlowScannerCommandWrapper = new RunTimeFlowScannerCommandWrapper(PYTHON_COMMAND);
                let results: FlowScannerExecutionResult;
                const completionPercentages: number[] = [];
                const statusProcessorFunction = (completionPercentage: number) => {
                    completionPercentages.push(completionPercentage);
                };

                beforeAll(async () => {
                    results = await wrapper.runFlowScannerRules(
                        workingFolder,
                        [PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2],
                        [PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2],
                        tempLogFile,
                        ['PreventPassingUserDataIntoElementWithoutSharing','PreventPassingUserDataIntoElementWithSharing','MissingFaultHandler'],
                        statusProcessorFunction);
                    // The `counter` property is irrelevant to us, and causes problems across platforms. So delete it.
                    for (const queryName of Object.keys(results.results)) {
                        for (const queryResults of results.results[queryName]) {
                            delete queryResults.counter;
                        }
                    }
                });

                it('Correctly reads and parses results', async () => {
                    const goldfileName: string = 'results.goldfile.json';
                    const goldFileContents: string = (await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, goldfileName), {encoding: 'utf-8'}))
                        .replaceAll('"__PATH_TO_EXAMPLE1__"', JSON.stringify(PATH_TO_EXAMPLE1))
                        .replaceAll('"__PATH_TO_EXAMPLE2__"', JSON.stringify(PATH_TO_EXAMPLE2));

                    const expectedResults: FlowScannerExecutionResult = JSON.parse(goldFileContents) as FlowScannerExecutionResult;

                    // When a Jest equality check fails, the expected and actual objects are logged in their entirety.
                    // Since the results objects are so big here, we'll compare their sub-objects one-at-a-time to keep
                    // failure messages somewhat readable.
                    const expectedKeys: string[] = Object.keys(expectedResults.results);
                    expect(Object.keys(results.results)).toHaveLength(expectedKeys.length);
                    for (let i = 0; i < expectedKeys.length; i++) {
                        const key = expectedKeys[i];
                        const expectedValue = expectedResults.results[key];
                        expect(key in results.results).toEqual(true);
                        expect(results.results[key]).toHaveLength(expectedValue.length);
                        for(const expectedElement of expectedValue) { // Need to do this because it seems that flow_scanner does not give results in a sorted or deterministic fashion
                            expect(results.results[key]).toContainEqual(expectedElement);
                        }
                    }
                });

                it('Correctly parses status updates from stdout', () => {
                    expect(completionPercentages).toEqual([0, 50]);
                });

                it('Generates no local log file', async () => {
                    const logFileMatcher = /\.flow_log_.+\.log/;
                    const logFiles = (await fs.promises.readdir('.')).filter(f => f.match(logFileMatcher));
                    expect(logFiles).toHaveLength(0);
                });

                it('Generates log file in designated location', async() => {
                    const contents: string = await fs.promises.readFile(tempLogFile, 'utf-8');
                    expect(contents.length).toBeGreaterThan(0);
                });
            });

            describe('Module shadowing resistance', () => {
                const wrapper: RunTimeFlowScannerCommandWrapper = new RunTimeFlowScannerCommandWrapper(PYTHON_COMMAND);

                it('resolves the bundled flow_scanner even when a malicious flow_scanner is planted in the process cwd', async () => {
                    // End-to-end defense-in-depth check for the CWE-427 module-shadowing RCE. We plant a hostile
                    // `flow_scanner` package into a directory, make it the process cwd (as would happen when the
                    // CLI is run from within a scanned repo), and confirm the wrapper still executes the trusted
                    // bundled scanner (results match the goldfile) and that the hostile payload never runs.
                    const scannedRepoDir: string = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'shadow-repo-'));
                    const isolatedWorkingFolder: string = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'shadow-work-'));
                    const isolatedLogFile: string = path.join(isolatedWorkingFolder, 'flow_scanner_logfile.log');
                    const sentinelFile: string = path.join(scannedRepoDir, 'PWNED.txt');
                    const originalCwd: string = process.cwd();
                    try {
                        // Plant a hostile `flow_scanner` package that writes a sentinel and fake (empty) results
                        // if it is ever imported/executed in place of the bundled scanner.
                        const maliciousModuleDir: string = path.join(scannedRepoDir, 'flow_scanner');
                        await fs.promises.mkdir(maliciousModuleDir);
                        await fs.promises.writeFile(path.join(maliciousModuleDir, '__init__.py'), '', 'utf-8');
                        await fs.promises.writeFile(path.join(maliciousModuleDir, '__main__.py'),
                            `import os, sys\n` +
                            `with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'PWNED.txt'), 'w') as f:\n` +
                            `    f.write('pwned')\n` +
                            `# Write empty results to the --json path so the run would appear clean.\n` +
                            `if '--json' in sys.argv:\n` +
                            `    with open(sys.argv[sys.argv.index('--json') + 1], 'w') as f:\n` +
                            `        f.write('{"results": {}}')\n`,
                            'utf-8');

                        // Simulate the CLI being invoked from within the malicious scanned repo.
                        process.chdir(scannedRepoDir);

                        const shadowResults: FlowScannerExecutionResult = await wrapper.runFlowScannerRules(
                            isolatedWorkingFolder,
                            [PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2],
                            [PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2],
                            isolatedLogFile,
                            ['PreventPassingUserDataIntoElementWithoutSharing', 'PreventPassingUserDataIntoElementWithSharing', 'MissingFaultHandler'],
                            () => {});
                        for (const queryName of Object.keys(shadowResults.results)) {
                            for (const queryResults of shadowResults.results[queryName]) {
                                delete queryResults.counter;
                            }
                        }

                        // The planted hostile module must never have executed.
                        expect(fs.existsSync(sentinelFile)).toEqual(false);

                        // The bundled scanner produced real results (proving it ran, not the empty-results payload).
                        const goldFileContents: string = (await fs.promises.readFile(path.join(PATH_TO_GOLDFILES, 'results.goldfile.json'), {encoding: 'utf-8'}))
                            .replaceAll('"__PATH_TO_EXAMPLE1__"', JSON.stringify(PATH_TO_EXAMPLE1))
                            .replaceAll('"__PATH_TO_EXAMPLE2__"', JSON.stringify(PATH_TO_EXAMPLE2));
                        const expectedResults: FlowScannerExecutionResult = JSON.parse(goldFileContents) as FlowScannerExecutionResult;

                        const expectedKeys: string[] = Object.keys(expectedResults.results);
                        expect(Object.keys(shadowResults.results)).toHaveLength(expectedKeys.length);
                        for (const key of expectedKeys) {
                            expect(key in shadowResults.results).toEqual(true);
                            expect(shadowResults.results[key]).toHaveLength(expectedResults.results[key].length);
                            for (const expectedElement of expectedResults.results[key]) {
                                expect(shadowResults.results[key]).toContainEqual(expectedElement);
                            }
                        }
                    } finally {
                        process.chdir(originalCwd);
                        await fs.promises.rm(scannedRepoDir, {recursive: true, force: true});
                        await fs.promises.rm(isolatedWorkingFolder, {recursive: true, force: true});
                    }
                });
            });

            describe('Failure Modes', () => {
                afterEach(() => {
                    jest.restoreAllMocks();
                });

                it.each([
                    {problem: 'an unparseable JSON', fakeResults: '{asdfasdfe,;]eawe}', expectedMessage: 'Results file contents are not a valid JSON'},
                    {problem: 'a malformed JSON', fakeResults: '{"undesiredProperty": "beep"}', expectedMessage: 'Could not parse results from '}
                ])('When execution produces $problem, an informative error is thrown', async ({fakeResults, expectedMessage}) => {
                    // Stub out the underlying Exec method to fake a success without actually invoking flow, since
                    // we don't care about the actual results.
                    jest.spyOn(PythonCommandExecutor.prototype, 'exec').mockImplementation(async (_args, _processStdout) => {
                        return Promise.resolve();
                    });

                    // Stub out the underlying ReadFile method to return the specified invalid results
                    jest.spyOn(fs.promises, 'readFile').mockImplementation(async (_file) => {
                        return fakeResults;
                    });

                    const wrapper: RunTimeFlowScannerCommandWrapper = new RunTimeFlowScannerCommandWrapper(PYTHON_COMMAND);
                    await expect(wrapper.runFlowScannerRules(workingFolder, [PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2], [PATH_TO_EXAMPLE1, PATH_TO_EXAMPLE2], tempLogFile, [], (_num: number) => {}))
                        .rejects
                        .toThrow(expectedMessage);
                });
            });
        });
    });
});