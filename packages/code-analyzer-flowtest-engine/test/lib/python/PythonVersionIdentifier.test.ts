import {SemVer} from 'semver';
import {RuntimePythonVersionIdentifier} from '../../../src/lib/python/PythonVersionIdentifier';

describe('PythonVersionIdentifier implementations', () => {
    describe('PythonVersionIdentifierImpl', () => {

        it('When command outputs parseable version, resolves to that version', async () => {
            const identifier = new RuntimePythonVersionIdentifier();
            // NOTE: We can't guarantee that the current machine has Python on it, but we _can_ guarantee that it has Node.
            //       So we'll tell it to provide Node's version, and then just compare that to the version of this node process.
            const output: SemVer|null = await identifier.identifyPythonVersion('node');
            expect((output as SemVer).compare(process.version)).toEqual(0);
        });

        it('When command does not output a parsable version, returns null', async () => {
            const identifier = new RuntimePythonVersionIdentifier();
            // Feed the identifier something that directly outputs nonsense.
            const output: SemVer|null = await identifier.identifyPythonVersion('echo');
            expect(output).toBeNull();
        });

        it('When command throws an error, rejects', async () => {
            const identifier = new RuntimePythonVersionIdentifier();
            // Feed the identifier a completely nonsensical command.
            await expect(identifier.identifyPythonVersion('aaaaaaaa')).rejects.toContain('aaaaaaaa');
        });
    });
});