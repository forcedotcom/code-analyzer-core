import {RuntimePythonVersionIdentifier} from "../../src/python/PythonVersionIdentifier";
import {SemVer} from "semver";

describe('PythonVersionIdentifier implementations', () => {
    describe('RuntimePythonVersionIdentifier', () => {

        it('When command outputs parseable version, resolves to that version', async () => {
            const identifier = new RuntimePythonVersionIdentifier();
            // NOTE: We can't guarantee that the current machine has Python on it, but we _can_ guarantee that it has Node.
            //       So we'll tell it to provide Node's version, and then just compare that to the version of this node process.
            const version: SemVer|null = await identifier.identifyPythonVersion('node');
            expect(version!.compare(process.version)).toEqual(0);
        });

        it('When command throws an error, rejects', async () => {
            const identifier = new RuntimePythonVersionIdentifier();
            // Feed the identifier a completely nonsensical command.
            await expect(identifier.identifyPythonVersion('aaaaaaaa')).rejects.toContain('aaaaaaaa');
        });
    });
});