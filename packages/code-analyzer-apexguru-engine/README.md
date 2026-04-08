# @salesforce/code-analyzer-apexguru-engine

ApexGuru Engine package for Salesforce Code Analyzer. Analyzes Apex code for anti-patterns and performance issues using Salesforce ApexGuru APIs.

## Features

- Detects Apex anti-patterns (SOQL in loops, DML in loops, etc.)
- Provides AI-generated fix suggestions
- Integrates with Salesforce org authentication via SF CLI
- Supports both static and production analysis modes

## Prerequisites

- Node.js >= 20.0.0
- Salesforce CLI (`sf`) installed and authenticated
- ApexGuru feature enabled in target org

## Installation

```bash
npm install @salesforce/code-analyzer-apexguru-engine
```

## Usage

### Basic Usage

```typescript
import { ApexGuruEngine } from '@salesforce/code-analyzer-apexguru-engine';
import { Workspace } from '@salesforce/code-analyzer-engine-api';

const engine = new ApexGuruEngine();
const workspace = new Workspace('/path/to/apex/classes');

const results = await engine.runRules([], {
    workspace,
    // Optional: specify target org
    // targetOrg: 'myorg'
});

console.log(`Found ${results.violations.length} violations`);
```

### Authentication

The engine uses `@salesforce/core` to authenticate with Salesforce orgs.

**Option 1: Default Org (Recommended)**
```bash
sf org login web
sf code-analyzer run --engine apexguru --source-path ./classes
```

**Option 2: Specific Org**
```bash
sf code-analyzer run --engine apexguru --target-org myorg --source-path ./classes
```

**Option 3: CI/CD with Environment Variables**
```bash
export SF_ACCESS_TOKEN="00D..."
export SF_INSTANCE_URL="https://test.salesforce.com"
sf code-analyzer run --engine apexguru --source-path ./classes
```

## API Response Format

ApexGuru returns violations with:
- `fixes[]`: Line-level code fixes with exact positions
- `suggestions[]`: Method-level guidance with explanation + code

Example:
```typescript
{
  ruleName: "SoqlInALoop",
  message: "You're calling an expensive SOQL in a loop...",
  codeLocations: [{ file: "...", startLine: 5, ... }],
  resourceUrls: ["https://help.salesforce.com/..."],
  suggestions: [{
    location: { ... },
    message: "// Explanation...\npublic void fixedMethod() { ... }"
  }]
}
```

## Architecture

```
src/
├── engine.ts              # Main Engine implementation
├── services/
│   ├── ApexGuruAuthService.ts   # Authentication via @salesforce/core
│   └── ApexGuruService.ts       # API client with polling
├── mappers/
│   └── ViolationMapper.ts       # Transform API response to Code Analyzer format
└── types/
    └── index.ts                 # TypeScript type definitions
```

## Development

```bash
# Build
npm run build

# Test
npm run test

# Lint
npm run lint

# Clean
npm run clean
```

## License

BSD-3-Clause
