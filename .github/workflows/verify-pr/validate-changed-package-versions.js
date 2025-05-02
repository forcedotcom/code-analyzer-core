const path = require('path');
const fs = require('fs');

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
    return fs.readFileSync(path.join(__dirname, '..', '..', '..', changedFilesFileName), 'utf-8').split('\n').map(s => s.trim());
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
        //A temporary workaround for the rename of the flowtest-engine package to flow-engine
        if (changedPackage === 'packages/code-analyzer-flowtest-engine') {
            continue;
        }
        const packageVersion = getPackageVersion(changedPackage);
        if (!packageVersion.endsWith('-SNAPSHOT')) {
            incorrectlyVersionedPackages.push(`${changedPackage} (currently versioned as ${packageVersion}) lacks a trailing "-SNAPSHOT"`);
        }
    }
    return incorrectlyVersionedPackages;
}


function getPackageVersion(changedPackage) {
    const packageJsonPath = path.join(changedPackage, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;
}

main();
