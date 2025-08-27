const path = require('path');
const fs = require('fs');
const cp = require('child_process');

function main() {
    const changedFiles = readChangedFilesFile(process.argv[2]);
    if (changedFiles.length === 0) {
        console.log('No changed files; no verification needed');
        process.exit(0);
    }

    displayList('THE FOLLOWING FILES WERE CHANGED:', changedFiles);

    const changedPackages = identifyMeaningfullyChangedPackages(changedFiles);

    if (changedPackages.length === 0) {
        console.log('No changed packages; no verification needed');
        process.exit(0);
    }

    displayList('THE FOLLOWING PACKAGES HAVE CHANGED (NON-TEST) FILES:', changedPackages);

    const incorrectlyVersionedPackages = identifyIncorrectlyVersionedPackages(changedPackages);

    if (incorrectlyVersionedPackages.length > 0) {
        displayList('PROBLEM: SOME PACKAGES ARE INCORRECTLY VERSIONED:', incorrectlyVersionedPackages);
        process.exit(1);
    } else {
        console.log('ALL CHANGED PACKAGES ARE APPROPRIATELY VERSIONED');
        process.exit(0);
    }
}

function displayList(header, list) {
    console.log(header);
    for (const listItem of list) {
        console.log(`* ${listItem}`);
    }
    console.log('');
}

function readChangedFilesFile(changedFilesFileName) {
    return fs.readFileSync(changedFilesFileName, 'utf-8').split('\n').map(s => s.trim());
}

function identifyMeaningfullyChangedPackages(changedFiles) {
    const changedPackages = new Set();

    for (const changedFile of changedFiles) {
        const changedPackage = convertFileNameToPackageNameIfPossible(changedFile);
        if (changedPackage && !isFileInTestFolder(changedFile)) {
            changedPackages.add(changedPackage);
        }
    }

    return [...changedPackages.keys()];
}

function convertFileNameToPackageNameIfPossible(changedFile) {
    const changedFilePathSegments = changedFile.split('/');
    if (changedFilePathSegments.length < 2 || changedFilePathSegments[0] !== 'packages') {
        return null;
    } else {
        return path.join(changedFilePathSegments[0], changedFilePathSegments[1]);
    }
}

function isFileInTestFolder(changedFile) {
    const changedFilePathSegments = path.dirname(changedFile).split('/');
    return changedFilePathSegments.length >= 3
        && changedFilePathSegments[0] === 'packages'
        && changedFilePathSegments[2] === 'test';
}

function identifyIncorrectlyVersionedPackages(changedPackages) {
    const incorrectlyVersionedPackages = [];
    for (const changedPackage of changedPackages) {
        const packageVersion = getPackageVersion(changedPackage);
        if (!packageVersion.endsWith('-SNAPSHOT')) {
            incorrectlyVersionedPackages.push(`${changedPackage} (currently versioned as ${packageVersion}) lacks a trailing "-SNAPSHOT"`);
            continue;
        }
        const releasedPackageVersions = getReleasedPackageVersions(changedPackage);
        if (releasedPackageVersions.includes(packageVersion.slice(0, packageVersion.length - 9))) {
            incorrectlyVersionedPackages.push(`${changedPackage} (currently versioned as ${packageVersion}) corresponds to an already-published release, and must be incremented.`);
        }
    }
    return incorrectlyVersionedPackages;
}

function getReleasedPackageVersions(changedPackage) {
    const publishedPackageName = JSON.parse(fs.readFileSync(path.join(changedPackage, 'package.json'), 'utf-8')).name;
    try {
        const execResult = cp.execSync(`npm view ${publishedPackageName} versions --json`, {
            encoding: 'utf-8'
        });
        return JSON.parse(execResult);
    } catch (e) {
        console.log(`NOTE: Could not fetch released versions of ${publishedPackageName} (located in ${changedPackage}. Is that an error?`);
        return [];
    }
}

function getPackageVersion(changedPackage) {
    const packageJsonPath = path.join(changedPackage, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;
}

main();
