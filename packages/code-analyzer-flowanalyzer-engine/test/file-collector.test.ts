import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Workspace } from '@salesforce/code-analyzer-engine-api';
import { FlowFileCollector } from '../src/services/FlowFileCollector';
import { getMessage } from '../src/messages';

describe('FlowFileCollector', () => {
    const collector = new FlowFileCollector(2, 1000, 2000);
    const sampleDir = path.join(__dirname, 'test-data', 'example-workspaces', 'contains-one-flow');

    it('collects workspace-relative flow paths', async () => {
        const workspace = new Workspace('id', [sampleDir]);
        const files = await collector.collect(workspace);
        expect(files).toHaveLength(1);
        expect(files[0].relativeFilePath).toEqual('Sample.flow-meta.xml');
        expect(files[0].content).toContain('unusedVar');
    });

    describe('with targeted subsets of a workspace', () => {
        let root: string;
        beforeAll(() => {
            root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'flow-targets-')));
            fs.mkdirSync(path.join(root, 'flows', 'nested'), { recursive: true });
            for (const rel of ['flows/A.flow-meta.xml', 'flows/B.flow-meta.xml', 'flows/nested/C.flow-meta.xml']) {
                fs.writeFileSync(path.join(root, rel), '<Flow></Flow>');
            }
        });
        afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

        const collectPaths = async (targets: string[]): Promise<string[]> => {
            const workspace = new Workspace('id', [root], targets);
            return (await collector.collect(workspace)).map(f => f.relativeFilePath).sort();
        };

        it('collects only the single flow that is targeted', async () => {
            expect(await collectPaths([path.join(root, 'flows', 'A.flow-meta.xml')]))
                .toEqual(['flows/A.flow-meta.xml']);
        });

        it('collects only the multiple flows that are targeted', async () => {
            expect(await collectPaths([
                path.join(root, 'flows', 'A.flow-meta.xml'),
                path.join(root, 'flows', 'nested', 'C.flow-meta.xml')
            ])).toEqual(['flows/A.flow-meta.xml', 'flows/nested/C.flow-meta.xml']);
        });

        it('collects all flows under a targeted folder', async () => {
            expect(await collectPaths([path.join(root, 'flows', 'nested')]))
                .toEqual(['flows/nested/C.flow-meta.xml']);
        });
    });

    it('rejects oversized files', async () => {
        const tiny = new FlowFileCollector(2, 10, 300);
        const workspace = new Workspace('id', [sampleDir]);
        await expect(tiny.collect(workspace)).rejects.toThrow('exceeds the per-file limit');
    });

    it('rejects too many files', async () => {
        const limited = new FlowFileCollector(1, 200, 300);
        const extra = path.join(sampleDir, 'Other.flow-meta.xml');
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => [
                path.join(sampleDir, 'Sample.flow-meta.xml'),
                extra
            ]
        } as unknown as Workspace;
        await expect(limited.collect(workspace)).rejects.toThrow(getMessage('ExcessiveFileCount', 2, 1));
    });

    it('rejects unsupported file types supplied as targets', async () => {
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => [path.join(sampleDir, 'notes.txt')]
        } as unknown as Workspace;
        fs.writeFileSync(path.join(sampleDir, 'notes.txt'), 'not a flow');
        await expect(collector.collect(workspace)).resolves.toEqual([]);
    });

    it('rejects files that resolve outside the workspace root', async () => {
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => [path.join(sampleDir, '..', 'contains-one-flow', '..', 'outside.flow-meta.xml')]
        } as unknown as Workspace;
        await expect(collector.collect(workspace)).rejects.toThrow('absolute path');
    });

    it('rejects a realpath that does not match the submitted path', async () => {
        const collectorWithFs = new FlowFileCollector(5, 1000, 1000, {
            lstatSync: () => ({ isSymbolicLink: () => false }),
            readFileSync: () => '<Flow></Flow>',
            realpathSync: () => '/some/other/path.flow-meta.xml'
        });
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => [path.join(sampleDir, 'Sample.flow-meta.xml')]
        } as unknown as Workspace;
        await expect(collectorWithFs.collect(workspace)).rejects.toThrow('symbolic links are not allowed');
    });

    it('rejects a missing workspace root', async () => {
        const workspace = {
            getWorkspaceRoot: () => null,
            getTargetedFiles: async () => [path.join(sampleDir, 'Sample.flow-meta.xml')]
        } as unknown as Workspace;
        await expect(collector.collect(workspace)).rejects.toThrow('absolute path');
    });

    it('rejects an oversized total payload', async () => {
        const limited = new FlowFileCollector(5, 10000, 10);
        const workspace = new Workspace('id', [sampleDir]);
        await expect(limited.collect(workspace)).rejects.toThrow('exceeds the limit of 10');
    });

    it('rejects case-colliding relative paths', async () => {
        const colliding = new FlowFileCollector(5, 1000, 1000);
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => [
                path.join(sampleDir, 'Sample.flow-meta.xml'),
                path.join(sampleDir, 'sample.flow-meta.xml')
            ]
        } as unknown as Workspace;
        await expect(colliding.collect(workspace)).rejects.toThrow(
            getMessage('DuplicatePathRejected', 'sample.flow-meta.xml'));
    });

    it('rejects symbolic links', async () => {
        const collectorWithFs = new FlowFileCollector(5, 1000, 1000, {
            lstatSync: () => ({ isSymbolicLink: () => true }) as fs.Stats,
            readFileSync: fs.readFileSync,
            realpathSync: fs.realpathSync
        });
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => [path.join(sampleDir, 'Sample.flow-meta.xml')]
        } as unknown as Workspace;
        await expect(collectorWithFs.collect(workspace)).rejects.toThrow('symbolic links are not allowed');
    });

    it('rejects relative target paths that are not absolute on disk', async () => {
        const workspace = {
            getWorkspaceRoot: () => sampleDir,
            getTargetedFiles: async () => ['Sample.flow-meta.xml']
        } as unknown as Workspace;
        await expect(collector.collect(workspace)).rejects.toThrow('absolute path');
    });

    it('uses a unique temp directory helper so os import stays live', () => {
        expect(os.tmpdir().length).toBeGreaterThan(0);
    });
});
