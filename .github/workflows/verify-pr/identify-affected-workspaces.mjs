import * as path from 'node:path';
import * as fs from 'node:fs';
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToRoot = path.resolve(__dirname, '..', '..', '..');

function main() {
    const changedFiles = readChangedFilesFile(process.argv[2]);
    const tmpFilePath = path.join(pathToRoot, 'workspace-args.txt');

    if (changedFiles.length === 0) {
        console.log('No changed files; no packages need testing');
        fs.writeFileSync(tmpFilePath, '');
        console.log(`WROTE EMPTY WORKSPACE ARGS TO ${tmpFilePath}`);
        process.exit(0);
    }
    displayList('THE FOLLOWING FILES WERE CHANGED:', changedFiles);

    const changedPackages = identifyChangedPackages(changedFiles);

    if (changedPackages.length === 0) {
        console.log(`No package-level changes. Using empty workspace arg to test all packages.`);
        fs.writeFileSync(tmpFilePath, '');
        console.log(`WROTE EMPTY WORKSPACE ARGS TO ${tmpFilePath}`);
        process.exit(0);
    }
    displayList('THE FOLLOWING PACKAGES HAVE CHANGED FILES:', changedPackages);

    const dependentPackages = identifyPackagesWithDependenciesOn(changedPackages);
    if (dependentPackages.length > 0) {
        displayList('THE FOLLOWING PACKAGES HAVE DEPENDENCIES ON CHANGED PACKAGES:', dependentPackages);
    } else {
        console.log(`NO PACKAGES HAVE DEPENDENCIES ON CHANGED PACKAGES.\n`);
    }

    const undeletedChangedPackages = changedPackages.filter(pkgLocation => {
        const packageName = pkgLocation.replace("packages","").replace("/","").replace("\\","");
        if(fs.existsSync(getPackageJsonFile(packageName))) {
            return true;
        } else {
            console.log(`Removing package '${packageName}' from list of workspaces since it seems to have been deleted.`);
        }
    });


    const affectedPackages = [...(new Set([...undeletedChangedPackages, ...dependentPackages]).keys())];
    displayList('BASED ON THE ABOVE, THE FOLLOWING PACKAGES ARE AFFECTED BY CHANGES, AND WILL REQUIRE TESTING:', affectedPackages);

    const correspondingWorkspaceArgs = affectedPackages.map(name => `--workspace ${name}`);
    displayList('THOSE PACKAGES CORRESPOND TO THESE WORKSPACE ARGS:', correspondingWorkspaceArgs);

    fs.writeFileSync(tmpFilePath, correspondingWorkspaceArgs.join(' '));
    console.log(`WROTE WORKSPACE ARGS TO ${tmpFilePath}`);
}

function displayList(header, list) {
    console.log(header);
    for (const listItem of list) {
        console.log(`* ${listItem}`);
    }
    console.log('');
}

function readChangedFilesFile(changedFilesFileName) {
    return fs.readFileSync(path.join(pathToRoot, changedFilesFileName), 'utf-8').split('\n').map(s => s.trim());
}

function identifyChangedPackages(changedFiles) {
    const changedPackages = new Set();

    for (const changedFile of changedFiles) {
        const changedPackage = convertFileNameToPackageNameIfPossible(changedFile);
        if (changedPackage) {
            changedPackages.add(changedPackage);
        }
    }

    return [...changedPackages.keys()];
}

function identifyPackagesWithDependenciesOn(packageNames) {
    const allPackageJsons = getAllPackageJsons();

    const packagesWithDependencies = [];

    for (const possiblyDependentPackageJson of allPackageJsons) {
        const possiblyDependentPackageName = possiblyDependentPackageJson.name;
        for (const possibleDependencyName of packageNames) {
            const dependencyVersionOrUndefined = possiblyDependentPackageJson.dependencies[possibleDependencyName];
            if (dependencyVersionOrUndefined) {
                packagesWithDependencies.push(possiblyDependentPackageName);
            }
        }
    }
    return packagesWithDependencies;
}

function convertFileNameToPackageNameIfPossible(changedFile) {
    const changedFilePathSegments = changedFile.split('/');
    if (changedFilePathSegments.length < 2 || changedFilePathSegments[0] !== 'packages') {
        return null;
    } else {
        return path.join(changedFilePathSegments[0], changedFilePathSegments[1]);
    }
}

function getAllPackageJsons() {
    const packagesDir = fs.readdirSync(path.join(pathToRoot, 'packages'));
    return packagesDir.filter(f => fs.statSync(path.join(pathToRoot, 'packages', f)).isDirectory()).map(getPackageJson);
}

function getPackageJsonFile(packageName) {
    return path.join(pathToRoot, 'packages', packageName, 'package.json');
}

function getPackageJson(packageName) {
    const packageJsonPath = getPackageJsonFile(packageName);
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}

main();
