const fs = require('fs');

function main() {
    // Split on `\n` instead of ` ` because this argument comes from $(ls).
    const packageNames = process.argv[2].split("\n");

    const scriptLines = [];
    scriptLines.push(`BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)`);
    scriptLines.push(`MESSAGE="Preparing Core Ecosystem for release"`);
    scriptLines.push(...generatePackageVarDeclarations(packageNames));
    scriptLines.push(`PACKAGE_LOCK="$(cat package-lock.json | base64)"`);
    scriptLines.push('');
    scriptLines.push('gh api graphql -F message="$MESSAGE" -F oldOid=\`git rev-parse HEAD\` -F branch="$BRANCH_NAME" \\');
    scriptLines.push(...generateGraphQlDashFFlagsForPackages(packageNames));
    scriptLines.push(`-F packagelock="$PACKAGE_LOCK" \\`);
    scriptLines.push(`-f query='`);
    scriptLines.push(`mutation = (${createMutationParameters(packageNames).join(', ')}) {`);
    scriptLines.push(`  createCommitOnBranch(input: {`);
    scriptLines.push(`    branch: {`);
    scriptLines.push(`      repositoryNameWithOwner: "forcedotcom/code-analyzer-core",`);
    scriptLines.push(`      branchName: $branch`);
    scriptLines.push(`    },`);
    scriptLines.push(`    message: {`);
    scriptLines.push(`      headline: $message`);
    scriptLines.push(`    },`);
    scriptLines.push(`    fileChanges: {`);
    scriptLines.push(`      additions: [`);
    scriptLines.push(`        {`);
    scriptLines.push(createAdditionsArray(packageNames).join('}\n, {\n'));
    scriptLines.push(`        }`);
    scriptLines.push(`      ]`);
    scriptLines.push(`    },`);
    scriptLines.push(`      expectedHeadOid: $oldOid`);
    scriptLines.push(`    }) {`);
    scriptLines.push(`      commit {`);
    scriptLines.push(`        id`);
    scriptLines.push(`      }`);
    scriptLines.push(`    }`);
    scriptLines.push(`  }'`);

    const script = scriptLines.join('\n');

    console.log(`========= WRITING THIS SCRIPT TO FILE =======`);
    console.log(script);

    fs.writeFileSync('graphQlScript.txt', script);
}

function generatePackageVarDeclarations(packageNames) {
    const packageVarDeclarations = [];
    for (const packageName of packageNames) {
        packageVarDeclarations.push(`${toPackageVarName(packageName)}="$(cat packages/${packageName}/package.json | base64)"`);
    }
    return packageVarDeclarations;
}

function generateGraphQlDashFFlagsForPackages(packageNames) {
    const dashFFlags = [];
    for (const packageName of packageNames) {
        dashFFlags.push(`-F ${toMutationParamName(packageName)}="$${toPackageVarName(packageName)}" \\`);
    }
    return dashFFlags;
}

function createMutationParameters(packageNames) {
    const mutationParameters = [];
    mutationParameters.push('$message: String!');
    mutationParameters.push('$oldOid: GitObject!');
    mutationParameters.push('$branch: String!');
    for (const packageName of packageNames) {
        mutationParameters.push(`$${toMutationParamName(packageName)}: Base64String!`);
    }
    mutationParameters.push(`$packagelock: Base64String!`);
    return mutationParameters;
}

function createAdditionsArray(packageNames) {
    const additions = [];
    for (const packageName of packageNames) {
        additions.push(
            `          path: "packages/${packageName}/package.json",\n` +
            `          contents: $${toMutationParamName(packageName)}\n`
        );
    }
    additions.push(
        `          path: "package-lock.json",\n` +
        `          contents: $packagelock\n`
    );
    return additions;
}

function toPackageVarName(packageName) {
    return packageName.toUpperCase().replaceAll('-', '_');
}

function toMutationParamName(packageName) {
    return packageName.toLowerCase().replaceAll('-', '');
}

main();
