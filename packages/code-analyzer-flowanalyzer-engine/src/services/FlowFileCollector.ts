import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { Workspace } from '@salesforce/code-analyzer-engine-api';
import { getMessage } from '../messages';
import { FLOW_FILE_EXTENSIONS } from '../constants';
import { CollectedFlowFile } from '../types';

export class FlowFileCollector {
    constructor(
        private readonly maxFileCount: number,
        private readonly maxFileBytes: number,
        private readonly maxPayloadBytes: number,
        private readonly fsAdapter: {
            lstatSync: (filePath: string) => { isSymbolicLink: () => boolean };
            readFileSync: (filePath: string, encoding: BufferEncoding) => string;
            realpathSync: (filePath: string) => string;
        } = { lstatSync, readFileSync, realpathSync }
    ) {}

    async collect(workspace: Workspace): Promise<CollectedFlowFile[]> {
        const workspaceRoot = workspace.getWorkspaceRoot();
        const targetedFiles = await workspace.getTargetedFiles();
        const flowFiles = targetedFiles.filter(file => this.isFlowFile(file));
        if (flowFiles.length === 0) {
            return [];
        }
        if (flowFiles.length > this.maxFileCount) {
            throw new Error(getMessage('ExcessiveFileCount', flowFiles.length, this.maxFileCount));
        }

        const collected: CollectedFlowFile[] = [];
        const seenNormalized = new Set<string>();
        let totalBytes = 0;

        for (const absolutePath of flowFiles) {
            this.rejectIfUnsafeAbsolutePath(absolutePath);
            const relativeFilePath = this.toRelativePath(absolutePath, workspaceRoot);
            this.validateRelativePath(relativeFilePath);
            this.rejectIfSymlink(absolutePath);

            const normalized = relativeFilePath.toLowerCase();
            if (seenNormalized.has(normalized)) {
                throw new Error(getMessage('DuplicatePathRejected', relativeFilePath));
            }
            seenNormalized.add(normalized);

            const content = this.fsAdapter.readFileSync(absolutePath, 'utf-8');
            const byteLength = Buffer.byteLength(content, 'utf-8');
            if (byteLength > this.maxFileBytes) {
                throw new Error(getMessage('OversizedFile', relativeFilePath, byteLength, this.maxFileBytes));
            }
            totalBytes += byteLength;
            if (totalBytes > this.maxPayloadBytes) {
                throw new Error(getMessage('OversizedPayload', totalBytes, this.maxPayloadBytes));
            }

            collected.push({
                absolutePath,
                relativeFilePath,
                content
            });
        }

        return collected;
    }

    private isFlowFile(fileName: string): boolean {
        const lower = fileName.toLowerCase();
        return FLOW_FILE_EXTENSIONS.some(ext => lower.endsWith(ext));
    }

    private toRelativePath(absolutePath: string, workspaceRoot: string | null): string {
        if (!workspaceRoot) {
            throw new Error(getMessage('AbsolutePathRejected', absolutePath));
        }
        const relative = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error(getMessage('AbsolutePathRejected', absolutePath));
        }
        return relative;
    }

    private validateRelativePath(relativeFilePath: string): void {
        if (path.isAbsolute(relativeFilePath) || relativeFilePath.startsWith('/')) {
            throw new Error(getMessage('AbsolutePathRejected', relativeFilePath));
        }
        const segments = relativeFilePath.split('/');
        if (segments.some(segment => segment === '..')) {
            throw new Error(getMessage('TraversalPathRejected', relativeFilePath));
        }
        if (!this.isFlowFile(relativeFilePath)) {
            throw new Error(getMessage('UnsupportedFileType', relativeFilePath));
        }
    }

    private rejectIfUnsafeAbsolutePath(absolutePath: string): void {
        if (!path.isAbsolute(absolutePath)) {
            throw new Error(getMessage('AbsolutePathRejected', absolutePath));
        }
    }

    private rejectIfSymlink(absolutePath: string): void {
        const stats = this.fsAdapter.lstatSync(absolutePath);
        if (stats.isSymbolicLink()) {
            throw new Error(getMessage('SymlinkRejected', absolutePath));
        }
        const realPath = this.fsAdapter.realpathSync(absolutePath);
        if (path.resolve(absolutePath) !== realPath) {
            throw new Error(getMessage('SymlinkRejected', absolutePath));
        }
    }
}
