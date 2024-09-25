import * as fsp from 'node:fs/promises';
import path from 'node:path';
import {sync} from 'which';
import {FlowTestRuleDescriptor, RunTimeFlowTestCommandWrapper} from "../../src/python/FlowTestCommandWrapper";

const PATH_TO_PYTHON_EXE: string = sync('python3');

describe('FlowTestCommandWrapper implementations', () => {
    describe('RunTimeFlowTestCommandWrapper', () => {
        describe('#getFlowTestRuleDescriptions()', () => {
            it('Returns valid, well-formed rule descriptions', async () => {
                const wrapper: RunTimeFlowTestCommandWrapper = new RunTimeFlowTestCommandWrapper(PATH_TO_PYTHON_EXE);

                const rules: FlowTestRuleDescriptor[] = await wrapper.getFlowTestRuleDescriptions();

                const expectedRules: FlowTestRuleDescriptor[] = JSON.parse(await fsp.readFile(
                    path.join(__dirname, '..', 'test-data', 'goldfiles', 'FlowTestCommandWrapper.test.ts', 'catalog.json'),
                    {encoding: 'utf-8'}
                )) as FlowTestRuleDescriptor[];

                expect(rules).toEqual(expectedRules);
            // For the sake of CI/CD, set the timeout to a truly absurd value.
            }, 30000);
        });
    });
});