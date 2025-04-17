import * as fs from 'node:fs/promises';
import * as child_process from 'node:child_process';
import { fileURLToPath } from 'url';
import path from 'node:path';
import {graphql} from '@octokit/graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToRoot = path.resolve(__dirname, '..', '..', '..');

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
    const authedGraphQl = graphql.defaults({
        headers: {
            authorization: `token ${token}`
        }
    });

    // Create the GraphQL query parameters
    const branch = child_process.execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const oldOid = child_process.execSync('git rev-parse HEAD').toString().trim();
    const message = `Preparing Core Ecosystem for release`;
    const queryParameters = {
        message,
        oldOid,
        branch,
        packageLock: await readBase64('package-lock.json')
    };
    for (const packageName of packageNames) {
        queryParameters[toPackageArg(packageName)] = await readBase64(`packages/${packageName}/package.json`);
    }

    // Do the GraphQL callout
    const result = await authedGraphQl(generateMutation(packageNames), queryParameters);

    console.log('✅ Commit created! ID:', result.createCommitOnBranch.commit.id);
}

function generateMutation(packageNames) {
    return `
    mutation ($message: String!, $oldOid: GitObjectID!, $branch: String!, $packageLock: Base64String!
    ${packageNames.map(packageName => `$${toPackageArg(packageName)}: Base64String!`).join (', ')}) {
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
${packageNames.map(packageName => `{ path: "packages/${packageName}/package.json", contents: $${toPackageArg(packageName)} }`).join('\n')}
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

function toPackageArg(packageName) {
    return packageName.toLowerCase().replaceAll('-', '');
}

main();
