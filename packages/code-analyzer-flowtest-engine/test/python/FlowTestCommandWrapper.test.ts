import * as fsp from 'node:fs/promises';
import path from 'node:path';
import {Workspace} from '@salesforce/code-analyzer-engine-api';
import {sync} from 'which';
import {FlowTestResultFile, FlowTestRuleDescriptor, RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";

const PATH_TO_PYTHON_EXE: string = sync('python3');
const PATH_TO_SAMPLE_WORKSPACE: string = path.resolve(__dirname, '..', 'test-data', 'sample-workspace');
const PATH_TO_GOLDFILES: string = path.resolve(__dirname, '..', 'test-data', 'goldfiles', 'FlowTestCommandWrapper.test.ts');


describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
        describe('#getFlowTestRuleDescriptions()', () => {
            it('Returns valid, well-formed rule descriptions', async () => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PATH_TO_PYTHON_EXE);

                const rules: FlowTestRuleDescriptor[] = await wrapper.getFlowTestRuleDescriptions();

                const expectedRules: FlowTestRuleDescriptor[] = JSON.parse(await fsp.readFile(
                    path.join(PATH_TO_GOLDFILES, 'catalog.json'),
                    {encoding: 'utf-8'}
                )) as FlowTestRuleDescriptor[];

                expect(rules).toEqual(expectedRules);
            // For the sake of CI/CD, set the timeout to a truly absurd value.
            }, 30000);
        });

        describe('#runFlowTest()', () => {
            describe.each([
                {
                    case: 'Running against a clean file',
                    target: path.join(PATH_TO_SAMPLE_WORKSPACE, 'case_collections_crud_example.flow-meta.xml'),
                    goldfile: path.join(PATH_TO_GOLDFILES, 'clean-file-results.json')
                },
                {
                    case: 'Running against a dirty file',
                    target: path.join(PATH_TO_SAMPLE_WORKSPACE, 'example.flow-meta.xml'),
                    goldfile: path.join(PATH_TO_GOLDFILES, 'dirty-file-results.json')
                },
                {
                    case: 'Running against a directory containing dirty files',
                    target: PATH_TO_SAMPLE_WORKSPACE,
                    goldfile: path.join(PATH_TO_GOLDFILES, 'dirty-directory-results.json')
                }
            ])('Successful execution. Case: $case', ({target, goldfile}) => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PATH_TO_PYTHON_EXE);

                let results: FlowTestResultFile;

                const workspace: Workspace = new Workspace([target]);

                beforeAll(async () => {
                    results = await wrapper.runFlowTest(workspace);
                }, 30000);

                it('Provides status updates during execution', async () => {
                    expect(true).toEqual(false);
                });

                it('Resolves to results file contents', async () => {
                    expect(results).toEqual(JSON.parse(await fsp.readFile(goldfile, {encoding: 'utf-8'})));
                });
            });

            it('Failed execution yields coherent error message', () => {
                expect(true).toEqual(false);
            });
        })
    });
});