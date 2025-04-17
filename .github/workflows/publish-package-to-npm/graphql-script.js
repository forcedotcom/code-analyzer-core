const fs = require('fs/promises');
const child_process = require('child_process');
const graphql = require('@octokit/graphql');
const path = require('path');

const pathToRoot = path.resolve(__dirname, '..', '..', '..');

main();

async function main() {
    // Get the package names from the argument, splitting on `\n` instead of ` ` because the argument comes from $(ls).
    const packageNames = process.argv[2].split("\n");
    if (!packageNames || packageNames.length === 0) {
        console.error("❌ No package names provided");
        process.exit(1);
    }

// Get the Github Token from the GH_TOKEN environment variable and use it to authenticate a client.
    const token = process.env.GH_TOKEN;
    if (!token) {
        console.error("❌ GH_TOKEN is not set");
        process.exit(1);
    }

// Authenticate GraphQL client
    const authedGraphQl = graphql.graphql.defaults({
        headers: {
            authorization: `token ${token}`
        }
    });

    const branch = child_process.execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const oldOid = child_process.execSync('git rev-parse HEAD').toString().trim();
    const message = `Preparing Core Ecosystem for release`;

    await authedGraphQl(generateMutation(packageNames), {
        message,
        oldOid,
        branch,
        packageLock: await readBase64('package-lock.json')
    });

    console.log('✅ Commit created! ID:', result.createCommitOnBranch.commit.id);
}

function generateMutation(packageNames) {
    return `
    mutation ($message: String!, $oldOid: GitObjectID!, $branch: String!, $packageLock: Base64String!) {
      createCommitOnBranch(input: {
        branch: {
          repositoryNameWithOwner: "forcedotcom/code-analyzer-core",
          branchName: $branch
        },
        message: {
          headline: $message
        },
        fileChanges: {
          additions: [
            { path: "package-lock.json", contents: $packageLock }
          ]
        },
        expectedHeadOid: $oldOid
      }) {
        commit {
          id
        }
      }
    }
`;
}

function readBase64(filePath) {
    return fs.readFile(path.resolve(pathToRoot, filePath), 'base64');
}
/*

import { execSync } from 'child_process';
import { graphql } from '@octokit/graphql';
import { resolve } from 'path';

// Utility to read a file and base64 encode it
const readBase64 = async (filePath) => {
    const content = await readFile(resolve(filePath));
    return content.toString('base64');
};
// Get branch name and latest commit SHA (OID)
const branchName = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const oldOid = execSync('git rev-parse HEAD').toString().trim();
const message = 'Preparing Core Ecosystem for release';
// Authenticated GraphQL client
const graphqlWithAuth = graphql.defaults({
    headers: {
        authorization: `token ${token}`,
    },
});
// Run the mutation
const result = await graphqlWithAuth(
    `
  mutation (
    $message: String!, $oldOid: GitObjectID!, $branch: String!,
    $corePackage: Base64String!, $apiPackage: Base64String!, $eslintPackage: Base64String!,
    $flowPackage: Base64String!, $pmdPackage: Base64String!, $regexPackage: Base64String!,
    $retirejsPackage: Base64String!, $sfgePackage: Base64String!, $stylelintPackage: Base64String!,
    $engineTemplatePackage: Base64String!, $templatePackage: Base64String!, $packageLock: Base64String!
  ) {
    createCommitOnBranch(input: {
      branch: {
        repositoryNameWithOwner: "forcedotcom/code-analyzer-core",
        branchName: $branch
      },
      message: {
        headline: $message
      },
      fileChanges: {
        additions: [
          { path: "packages/code-analyzer-core/package.json", contents: $corePackage },
          { path: "packages/code-analyzer-engine-api/package.json", contents: $apiPackage },
          { path: "packages/code-analyzer-eslint-engine/package.json", contents: $eslintPackage },
          { path: "packages/code-analyzer-flow-engine/package.json", contents: $flowPackage },
          { path: "packages/code-analyzer-pmd-engine/package.json", contents: $pmdPackage },
          { path: "packages/code-analyzer-regex-engine/package.json", contents: $regexPackage },
          { path: "packages/code-analyzer-retirejs-engine/package.json", contents: $retirejsPackage },
          { path: "packages/code-analyzer-sfge-engine/package.json", contents: $sfgePackage },
          { path: "packages/code-analyzer-stylelint-engine/package.json", contents: $stylelintPackage },
          { path: "packages/ENGINE-TEMPLATE/package.json", contents: $engineTemplatePackage },
          { path: "packages/T-E-M-P-L-A-T-E/package.json", contents: $templatePackage },
          { path: "package-lock.json", contents: $packageLock }
        ]
      },
      expectedHeadOid: $oldOid
    }) {
      commit {
        id
      }
    }
  }
`,
    {
        message,
        oldOid,
        branch: branchName,
        corePackage: await readBase64('packages/code-analyzer-core/package.json'),
        apiPackage: await readBase64('packages/code-analyzer-engine-api/package.json'),
        eslintPackage: await readBase64('packages/code-analyzer-eslint-engine/package.json'),
        flowPackage: await readBase64('packages/code-analyzer-flow-engine/package.json'),
        pmdPackage: await readBase64('packages/code-analyzer-pmd-engine/package.json'),
        regexPackage: await readBase64('packages/code-analyzer-regex-engine/package.json'),
        retirejsPackage: await readBase64('packages/code-analyzer-retirejs-engine/package.json'),
        sfgePackage: await readBase64('packages/code-analyzer-sfge-engine/package.json'),
        stylelintPackage: await readBase64('packages/code-analyzer-stylelint-engine/package.json'),
        engineTemplatePackage: await readBase64('packages/ENGINE-TEMPLATE/package.json'),
        templatePackage: await readBase64('packages/T-E-M-P-L-A-T-E/package.json'),
        packageLock: await readBase64('package-lock.json'),
    }
);

 */
