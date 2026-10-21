import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { CollectedFlowFile } from '../types';

export async function createMetadataArchive(files: CollectedFlowFile[]): Promise<Buffer> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const output = new PassThrough();
    output.on('data', (chunk: Buffer) => chunks.push(chunk));

    const completed = new Promise<Buffer>((resolve, reject) => {
        output.on('finish', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);
        output.on('error', reject);
    });

    archive.pipe(output);
    for (const file of files) {
        archive.append(file.content, { name: file.relativeFilePath });
    }
    await archive.finalize();
    return completed;
}
