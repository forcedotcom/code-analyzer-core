const path = require('path');
const fs = require('fs');

function main() {
    const packageNames = process.argv[2].split('\n');

    if (packageNames.length > 0) {
        displayList('WILL ATTEMPT TO VALIDATE THESE PACKAGES:', packageNames);
    } else {
        console.log('NO PACKAGES PROVIDED FOR VALIDATION');
        process.exit(0);
    }

    const packageJsons = getAllPackageJsons(packageNames);

    const incorrectPackageInterdependencies = identifyIncorrectlyInterdependentPackages(packageJsons);

    if (incorrectPackageInterdependencies.length > 0) {
        displayList('PROBLEM: SOME INTER-PACKAGE DEPENDENCIES ARE INCORRECT:', incorrectPackageInterdependencies);
        process.exit(1);
    } else {
        console.log('ALL PACKAGE INTERDEPENDENCIES ARE CORRECT');
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

function getAllPackageJsons(packageNames) {
    return packageNames.map(getPackageJson);
}

function getPackageJson(packageName) {
    const packageJsonPath = path.join('packages', packageName, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}

function identifyIncorrectlyInterdependentPackages(packageJsons) {
    const incorrectInterdependencies = [];
    for (const potentialDependency of packageJsons) {
        const dependencyName = potentialDependency.name;
        const dependencyVersion = potentialDependency.version;

        for (const potentialDependant of packageJsons) {
            const dependedUponVersion = potentialDependant.dependencies[dependencyName];
            if (dependedUponVersion != null && dependedUponVersion !== dependencyVersion) {
                incorrectInterdependencies.push(`${potentialDependant.name} uses ${dependencyName}@${dependedUponVersion} instead of ${dependencyVersion}`);
            }
        }
    }
    return incorrectInterdependencies;
}

main();