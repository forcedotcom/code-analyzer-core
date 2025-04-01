import path from 'node:path';
import * as fsp from 'node:fs/promises';

import {PythonCommandExecutor} from '../../src/python/PythonCommandExecutor';

const PATH_TO_ERROR_THROWER = path.resolve(__dirname, '..', 'test-data', 'executable-scripts', 'error-thrower.py');


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
    });
});