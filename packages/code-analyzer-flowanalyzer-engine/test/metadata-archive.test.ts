import { createMetadataArchive } from '../src/services/MetadataArchiveBuilder';

describe('createMetadataArchive', () => {
    it('builds a zip containing workspace-relative flow paths', async () => {
        const zip = await createMetadataArchive([{
            absolutePath: '/tmp/Sample.flow-meta.xml',
            relativeFilePath: 'flows/Sample.flow-meta.xml',
            content: '<Flow></Flow>'
        }]);
        expect(zip.subarray(0, 2).toString()).toEqual('PK');
        expect(zip.length).toBeGreaterThan(20);
    });
});
