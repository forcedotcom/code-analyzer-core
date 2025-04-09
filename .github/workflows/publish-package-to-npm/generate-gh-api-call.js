const path = require('path');
const fs = require('fs');

const COMMIT_MESSAGE = "Preparing Core Ecosystem for release";

async function main() {
    const oldOid = process.argv[2];
    const branchName = process.argv[3];
    // Split on `\n` instead of ` ` because this argument comes from $(ls).
    const packageNames = process.argv[4].split("\n");

    console.log('====== RUNNING generate-gh-api-call.js =======');
    console.log(`Commiting to branch ${branchName}`);
    if (packageNames.length > 0) {
        displayList('RECEIVED THE FOLLOWING PACKAGE NAMES:', packageNames);
    } else {
        console.log('NO PACKAGE NAMES PROVIDED');
        // If we received no package names, that probably indicates a problem in the release process.
        process.exit(1);
    }

    const graphQlChangeDescriptors = createGraphQlChangeDescriptors(packageNames);

    const graphQlQuery = `gh api graphql ${createGraphQlParameters(oldOid, branchName, graphQlChangeDescriptors)}`;

    fs.writeFileSync('graphQlQuery.txt', graphQlQuery);
}

function displayList(header, list) {
    console.log(header);
    for (const listItem of list) {
        console.log(`* ${listItem}`);
    }
    console.log('');
}

function createGraphQlChangeDescriptors(packageDirs) {
    const changeDescriptorMap = new Map();
    for (const packageDir of packageDirs) {
        const packageKey = packageDir.toLowerCase().replaceAll('-', '');
        changeDescriptorMap.set(packageKey, createGraphQlComponentDescriptorForPackage(packageDir));
    }
    // We also need to add one for the package-lock.json file.
    changeDescriptorMap.set('packageLock', {
        filePath: 'package-lock.json',
        fileEncoding: fs.readFileSync('package-lock.json', 'base64')
    });
    return changeDescriptorMap;
}

function createGraphQlComponentDescriptorForPackage(packageDir) {
    // The relative path to this package's package.json file is needed.
    const packageJsonPath = path.join('packages', packageDir, 'package.json');
    // GraphQL needs the latest version of this package's package.json file, as a Base64 encoded string.
    const packageJsonEncoding = fs.readFileSync(packageJsonPath, 'base64');

    return {
        filePath: packageJsonPath,
        fileEncoding: packageJsonEncoding
    };
}

function createGraphQlParameters(oldOid, branchName, descriptorMap) {
    const params = ['-F', `message="${COMMIT_MESSAGE}"`];

    params.push('-F', `oldOid=${oldOid}`);
    params.push('-F', `branch="${branchName}"`);
    for (const [name, descriptor] of descriptorMap.entries()) {
        params.push('-F', `${name}="${descriptor.fileEncoding}"`);
    }
    params.push('-f', `query=${createMutation(descriptorMap)}`);
    return params.join(' ');
}

function createMutation(descriptorMap) {
    const paramList = [];
    paramList.push('$message: String!', '$oldOid: GitObjectID!', '$branch: String!,');
    for (const name of descriptorMap.keys()) {
        paramList.push(`$${name}: Base64String!`);
    }
    const fileChanges = [];
    for (const [name, descriptor] of descriptorMap.entries()) {
        fileChanges.push(
          `path: "${descriptor.filePath}",\n` +
          `contents: $${name}\n`
        );
    }
    return `
mutation (${paramList.join(', ')}) {
  createCommitOnBranch(input: {
    branch: {
      repositoryNameWithOwner: "forcedotcom/code-analyzer-core",
      brancHName: $branch
    },
    message: {
      headline: $message
    },
    fileChanges: {
      additions: [
      {
${fileChanges.join('\n}, {\n')}
      }
    ],
    expectedHeadOid: $oldOid
  }) {
    commit {
      id
    }
  }
}`;
}

main();
