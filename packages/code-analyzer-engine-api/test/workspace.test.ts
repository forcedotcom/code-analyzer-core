import path from "node:path";
import { Workspace } from "../src";

const SAMPLE_WORKSPACE_FOLDER: string = path.join(__dirname, 'test-data', 'sampleWorkspace');

describe('Tests for the Workspace class', () => {
    describe('Tests for getWorkspaceId', () => {
        it('If a workspace identifier is supplied to the constructor, then the getWorkspaceId method returns it', async () => {
            const workspace: Workspace = new Workspace('someWorkspaceId', [SAMPLE_WORKSPACE_FOLDER]);
            expect(workspace.getWorkspaceId()).toEqual('someWorkspaceId');
        });
    });

    describe('Tests for getWorkspaceRoot', () => {
        it('When workspace is empty, then getWorkspaceRoot returns null', () => {
            const workspace: Workspace = new Workspace('id', []);
            expect(workspace.getWorkspaceRoot()).toEqual(null);
        });

        it('When workspace contains just a file, then getWorkspaceRoot returns its parent folder', () => {
            const workspace: Workspace = new Workspace('id', [path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.cls')]);
            expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'));
        });

        it('When workspace contains just a folder, then getWorkspaceRoot returns the folder', () => {
            const workspace: Workspace = new Workspace('id', [path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1')]);
            expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'));
        });

        it('When workspace contains two files from the same folder (with no common file name overlap), then getWorkspaceRoot their parent folder', () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls'),
            ]);
            expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2'));
        });

        it('When workspace contains two files from the same folder with no common file name overlap (where common name is actually a folder that exists), then getWorkspaceRoot their parent folder', () => {
            // The case has "...sub2/someFile" common to both files but someFile i actually a folder inside sub2 that we shouldn't return
            // We first test when the "someFile" folder is not in the workspace
            const workspace1: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.cls'),
            ]);
            expect(workspace1.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2'));

            // We then test when the "someFile" folder is in the workspace
            const workspace2: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.cls'),
            ]);
            expect(workspace2.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2'));
        });

        it('When root folder of workspace is also partially the name of another file that is not in the workspace, then getWorkspaceRoot returns the folder', () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile') // This is a folder. Notice the someFile1InSub2.cls is not our workspace
            ]);
            expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile'));
        });

        it('When workspace contains a folder and a file from that folder, then getWorkspaceRoot the folder', () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.cls'),
            ]);
            expect(workspace.getWorkspaceRoot()).toEqual(path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1'));
        });

        it('When workspace contains various files and folders, then getWorkspaceRoot returns the longest common parent folder', () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
            ]);
            expect(workspace.getWorkspaceRoot()).toEqual(SAMPLE_WORKSPACE_FOLDER);
        });

        it('When workspace contains files from different drives, then getWorkspaceRoot returns null', () => {
            const workspace: Workspace = new Workspace('id', [
                path.join('C:', 'someFolder', 'someFile1.cls'),
                path.join('D:', 'someFile2.cls')
            ]);
            expect(workspace.getWorkspaceRoot()).toEqual(null);
        });

        it('When workspace contains files that only have the absolute root folder in common, then getWorkspaceRoot returns it', () => {
            const absRoot: string = getAbsoluteRootFolder();
            const workspace: Workspace = new Workspace('id', [
                path.join(absRoot, 'someFolder', 'someFile1.cls'),
                path.join(absRoot, 'someFile2')
            ]);
            expect(workspace.getWorkspaceRoot()).toEqual(absRoot);
        });

        it('When workspace folder ends in path.sep, then getWorkspaceRoot removes the path.sep', () => {
            const workspace: Workspace = new Workspace('id', [__dirname + path.sep]);
            expect(workspace.getWorkspaceRoot()).toEqual(__dirname);
        });
    });

    describe('Tests for getRawFilesAndFolders', () => {
        it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(__dirname, 'tEst-data'),
                path.join(__dirname, 'test-dAta'),
                __dirname,
                path.join(__dirname, 'run.teSt.tS')
            ]);
            expect(workspace.getRawFilesAndFolders()).toEqual([__dirname]);
        });

        it('When workspace folder ends in path.sep, then getRawFilesAndFolders removes the path.sep', () => {
            const workspace: Workspace = new Workspace('id', [__dirname + path.sep]);
            expect(workspace.getRawFilesAndFolders()).toEqual([__dirname]);
        });

        it("When explicitly including files we normally don't care to process like .gitignore file or a node_modules folder, then getRawFilesAndFolders still includes them", async () => {
            const sampleFiles: string[] = [
                path.join(SAMPLE_WORKSPACE_FOLDER ,'sub1', 'sub3', 'node_modules', 'placeholder.txt'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER ,'sub1', 'sub3', '.gitignore')
            ].sort();
            const workspace: Workspace = new Workspace('id', sampleFiles);
            expect(workspace.getRawFilesAndFolders()).toEqual(sampleFiles);
        });

        it('When a workspace root happens to live under a dot folder, then the files are not excluded from getRawFilesAndFolders', async () => {
            const dotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder');
            const workspace: Workspace = new Workspace('id', [
                path.join(dotFolder, 'subFolder'),
                path.join(dotFolder, 'someFile.cls')]);
            expect(workspace.getRawFilesAndFolders()).toEqual([
                path.join(dotFolder, 'subFolder'),
                path.join(dotFolder, 'someFile.cls',)
            ].sort());
        });

        it('When a workspace root happens to live under a node_modules folder, then the files are not excluded from getRawFilesAndFolders', async () => {
            const nodeModulesFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules');
            const workspace: Workspace = new Workspace('id', [
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder'),
            ]);
            expect(workspace.getRawFilesAndFolders()).toEqual([
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder')
            ].sort());
        });

        it('When explicitly including paths that lives in a .dotFolder or a node_modules folder then it should still be included with getRawFilesAndFolders even if the .dotFolder is underneath the workspace root', async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'), // We want everything from the parent folder and to exclude the normal candidates except for the explicitly included files:
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder', 'subFolder'), // This is not redundant since normally it would be excluded
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'subFolder', 'someFile.cls'), // This is not redundant since normally it would be excluded
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'), // This is redundant since we already have its parent
            ]);
            expect(workspace.getRawFilesAndFolders()).toEqual([
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder', 'subFolder'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'subFolder', 'someFile.cls'),
            ].sort());
        });
    });

    describe('Tests for getRawTargets', () => {
        it("When no targets are provided, then return undefined", () => {
            const workspace: Workspace = new Workspace('id', [__dirname], undefined);
            expect(workspace.getRawTargets()).toEqual(undefined);
        });

        it("Although this should never happen in production, if empty targets are provided, then return empty", () => {
            const workspace: Workspace = new Workspace('id', [__dirname], []);
            expect(workspace.getRawTargets()).toEqual([]);
        });

        it("When duplicates are provided, then we de-dup them", () => {
            const workspace: Workspace = new Workspace('id', [__dirname], [
                path.join(__dirname, 'tEst-data'),
                path.join(__dirname, 'test-dAta'),
                path.join(__dirname, 'someFile.cls'),
                path.join(__dirname, 'someFile.cls')
            ]);
            expect(workspace.getRawTargets()).toEqual([
                path.join(__dirname, 'someFile.cls'),
                path.join(__dirname, 'tEst-data')
            ]);
        });

        it("When including a parent folder and child paths under that folder, then the redundant children are removed", async () => {
            const workspace: Workspace = new Workspace('id', [__dirname], [
                path.join(__dirname, 'tEst-data'),
                path.join(__dirname, 'test-dAta'),
                __dirname,
                path.join(__dirname, 'someFile.cls')
            ]);
            expect(workspace.getRawTargets()).toEqual([__dirname]);
        });

        it("When including a parent folder and child files from that folder, then the redundant files methods are removed", async () => {
            const workspace: Workspace = new Workspace('id', [__dirname], [
                __dirname,
                path.join(__dirname, 'someFile1.cls'),
                path.join(__dirname, 'someFile2.cls')
            ]);
            expect(workspace.getRawTargets()).toEqual([__dirname]);
        });

        it('When workspace folder ends in path.sep, then getRawTargets removes the path.sep', () => {
            const workspace: Workspace = new Workspace('id', [__dirname], [__dirname + path.sep]);
            expect(workspace.getRawTargets()).toEqual([__dirname]);
        });

        it("When explicitly including files we normally don't care to process like .gitignore file or a node_modules folder, then getRawTargets still includes them", async () => {
            const sampleFiles: string[] = [
                path.join(SAMPLE_WORKSPACE_FOLDER ,'sub1', 'sub3', 'node_modules', 'placeholder.txt'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER ,'sub1', 'sub3', '.gitignore')
            ].sort();
            const workspace: Workspace = new Workspace('id', [__dirname], sampleFiles);
            expect(workspace.getRawTargets()).toEqual(sampleFiles);
        });

        it('When a workspace root happens to live under a dot folder, then the files are not excluded from getRawTargets', async () => {
            const dotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder');
            const workspace: Workspace = new Workspace('id', [path.join(dotFolder, 'subFolder')], [
                path.join(dotFolder, 'subFolder'),
                path.join(dotFolder, 'someFile.cls')]);
            expect(workspace.getRawTargets()).toEqual([
                path.join(dotFolder, 'subFolder'),
                path.join(dotFolder, 'someFile.cls',)
            ].sort());
        });

        it('When a workspace root happens to live under a node_modules folder, then the files are not excluded from getRawTargets', async () => {
            const nodeModulesFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules');
            const workspace: Workspace = new Workspace('id', [path.join(nodeModulesFolder, 'subFolder')], [
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder'),
            ]);
            expect(workspace.getRawTargets()).toEqual([
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder')
            ].sort());
        });

        it('When explicitly including paths that lives in a .dotFolder or a node_modules folder then it should still be included with getRawTargets even if the .dotFolder is underneath the workspace root', async () => {
            const workspace: Workspace = new Workspace('id', [SAMPLE_WORKSPACE_FOLDER], [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'), // We want everything from the parent folder and to exclude the normal candidates except for the explicitly included files:
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder', 'subFolder'), // This is not redundant since normally it would be excluded
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'subFolder', 'someFile.cls'), // This is not redundant since normally it would be excluded
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'), // This is redundant since we already have its parent
            ]);
            expect(workspace.getRawTargets()).toEqual([
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder', 'subFolder'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'subFolder', 'someFile.cls'),
            ].sort());
        });
    });

    describe('Tests for getWorkspaceFiles', () => {
        it("When explicitly including files we normally don't care to process like .gitignore file or a node_modules folder, then getWorkspaceFiles still includes them", async () => {
            const sampleFiles: string[] = [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'placeholder.txt'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.gitignore')
            ].sort();
            const workspace: Workspace = new Workspace('id', sampleFiles);
            expect(await workspace.getWorkspaceFiles()).toEqual(sampleFiles);
        });

        it('When calling getWorkspaceFiles, then all files underneath all subfolders are found while excluding dot files/folders and node_modules', async () => {
            const workspace: Workspace = new Workspace('id', [path.join(__dirname, 'test-data', 'sampleWorkspace')]);
            expect(await workspace.getWorkspaceFiles()).toEqual([
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile', 'dummy.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someOtherFileInSub3.cls')
            ].sort());
        });

        it('When workspace is empty, then getWorkspaceFiles is empty', async () => {
            const workspace: Workspace = new Workspace('id', []);
            expect(await workspace.getWorkspaceFiles()).toEqual([]);
        });

        it('When a workspace consists a dot file/folder as a direct child underneath the workspace root (as opposed to indirectly) in it, then it should be excluded', async () => {
            // This case is really a sanity check against a specific implementation that we have. It may seem like an
            // arbitrary test, but it will help catch things if our implementation does special handling around direct vs
            // indirect children.
            const folderDirectlyContainingDotFileAndDotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3');
            const workspace: Workspace = new Workspace('id', [folderDirectlyContainingDotFileAndDotFolder]);
            // Sanity checks:
            expect(workspace.getWorkspaceRoot()).toEqual(folderDirectlyContainingDotFileAndDotFolder);
            expect(workspace.getRawFilesAndFolders()).toEqual([folderDirectlyContainingDotFileAndDotFolder]);
            // Actual verification - should not include dot files or folders:
            expect(await workspace.getWorkspaceFiles()).toEqual([
                path.join(folderDirectlyContainingDotFileAndDotFolder, 'someFileInSub3.cls'),
                path.join(folderDirectlyContainingDotFileAndDotFolder, 'someOtherFileInSub3.cls')
            ]);
        });

        it('When a workspace root happens to live under a dot folder, then the files are not excluded from getWorkspaceFiles', async () => {
            const dotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder');
            const workspace: Workspace = new Workspace('id', [
                path.join(dotFolder, 'subFolder'),
                path.join(dotFolder, 'someFile.cls')]);
            expect(await workspace.getWorkspaceFiles()).toEqual([
                path.join(dotFolder, 'subFolder', 'someOtherFile.cls'),
                path.join(dotFolder, 'someFile.cls',)
            ].sort());
        });

        it('When a workspace root happens to live under a node_modules folder, then the files are not excluded from getWorkspaceFiles', async () => {
            const nodeModulesFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules');
            const workspace: Workspace = new Workspace('id', [
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder'),
            ]);
            expect(await workspace.getWorkspaceFiles()).toEqual([
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder', 'someFile.cls')
            ].sort());
        });

        it('When explicitly including paths that lives in a .dotFolder or a node_modules folder then it should still be included with getWorkspaceFiles even if the .dotFolder is underneath the workspace root', async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'), // We want everything from the parent folder and to exclude the normal candidates except for the explicitly included files:
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder', 'subFolder'), // This is not redundant since normally it would be excluded
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'subFolder', 'someFile.cls'), // This is not redundant since normally it would be excluded
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'), // This is redundant since we already have its parent
            ]);

            // This should not contain the .someDotFolder/someFile.cls file since it wasn't explicitly listed
            expect(await workspace.getWorkspaceFiles()).toEqual([
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder', 'subFolder', 'someOtherFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'subFolder', 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someOtherFileInSub3.cls')
            ].sort());
        });
    });

    describe('Tests for getTargetedFiles', () => {
        it("When no targets are provided, then it it should return the same as getWorkspaceFiles", async () => {
            const workspace: Workspace = new Workspace('id', [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls')
            ], undefined);
            expect(await workspace.getTargetedFiles()).toEqual(await workspace.getWorkspaceFiles());
        });

        it("Although this should never happen in production, if empty targets are provided, then return empty", async () => {
            const workspace: Workspace = new Workspace('id', [__dirname], []);
            expect(await workspace.getTargetedFiles()).toEqual([]);
        });

        it("When redundant targets are provided, then they are filtered out", async () => {
            const workspace: Workspace = new Workspace('id', [SAMPLE_WORKSPACE_FOLDER], [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls')
            ]);
            expect(await workspace.getTargetedFiles()).toEqual([
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someOtherFileInSub3.cls'),
            ]);
        });

        it("When explicitly including files we normally don't care to process like .gitignore file or a node_modules folder, then getTargetedFiles still includes them", async () => {
            const sampleFiles: string[] = [
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules', 'placeholder.txt'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.gitignore')
            ].sort();
            const workspace: Workspace = new Workspace('id', [SAMPLE_WORKSPACE_FOLDER], sampleFiles);
            expect(await workspace.getTargetedFiles()).toEqual(sampleFiles);
        });

        it('When calling getTargetedFiles, then all files underneath all subfolders are found while excluding dot files/folders and node_modules', async () => {
            const workspace: Workspace = new Workspace('id', [__dirname], [path.join(__dirname, 'test-data', 'sampleWorkspace')]);
            expect(await workspace.getTargetedFiles()).toEqual([
                path.join(SAMPLE_WORKSPACE_FOLDER, 'someFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'someFileInSub1.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'anotherFile.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile', 'dummy.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile1InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub2', 'someFile2InSub2.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someFileInSub3.cls'),
                path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'someOtherFileInSub3.cls')
            ].sort());
        });

        it('When a workspace consists a dot file/folder as a direct child underneath the workspace root (as opposed to indirectly) in it, then it should be excluded', async () => {
            // This case is really a sanity check against a specific implementation that we have. It may seem like an
            // arbitrary test, but it will help catch things if our implementation does special handling around direct vs
            // indirect children.
            const folderDirectlyContainingDotFileAndDotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3');
            const workspace: Workspace = new Workspace('id', [SAMPLE_WORKSPACE_FOLDER], [folderDirectlyContainingDotFileAndDotFolder]);
            // Actual verification - should not include dot files or folders:
            expect(await workspace.getTargetedFiles()).toEqual([
                path.join(folderDirectlyContainingDotFileAndDotFolder, 'someFileInSub3.cls'),
                path.join(folderDirectlyContainingDotFileAndDotFolder, 'someOtherFileInSub3.cls')
            ]);
        });

        it('When targeted files happen to live under a dot folder, then the files are not excluded from getTargetedFiles', async () => {
            const dotFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', '.someDotFolder');
            const workspace: Workspace = new Workspace('id', [SAMPLE_WORKSPACE_FOLDER], [
                path.join(dotFolder, 'subFolder'),
                path.join(dotFolder, 'someFile.cls')]);
            expect(await workspace.getTargetedFiles()).toEqual([
                path.join(dotFolder, 'subFolder', 'someOtherFile.cls'),
                path.join(dotFolder, 'someFile.cls',)
            ].sort());
        });

        it('When targeted files happen to live under a node_modules folder, then the files are not excluded from getWorkspaceFiles', async () => {
            const nodeModulesFolder: string = path.join(SAMPLE_WORKSPACE_FOLDER, 'sub1', 'sub3', 'node_modules');
            const workspace: Workspace = new Workspace('id', [SAMPLE_WORKSPACE_FOLDER], [
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder'),
            ]);
            expect(await workspace.getTargetedFiles()).toEqual([
                path.join(nodeModulesFolder, 'placeholder.txt'),
                path.join(nodeModulesFolder, 'subFolder', 'someFile.cls')
            ].sort());
        });
    });
});

function getAbsoluteRootFolder(): string {
    let rootFolder: string = __dirname;
    while (rootFolder !== path.dirname(rootFolder)) {
        rootFolder = path.dirname(rootFolder);
    }
    return rootFolder;
}
