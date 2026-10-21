import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RuleDescription, SeverityLevel, Workspace } from '@salesforce/code-analyzer-engine-api';
import { FlowAnalyzerEngine } from '../src/engine';
import { FlowAnalyzerEngineConfig } from '../src/config';
import { FlowAnalyzerAuthService } from '../src/services/FlowAnalyzerAuthService';
import { FlowAnalyzerApiClient } from '../src/services/FlowAnalyzerApiClient';
import { FlowFileCollector } from '../src/services/FlowFileCollector';
import { FindingLocationMapper } from '../src/services/FindingLocationMapper';
import { changeWorkingDirectoryToPackageRoot, createDescribeOptions, createRunOptions } from './test-helpers';
import { getMessage } from '../src/messages';

changeWorkingDirectoryToPackageRoot();

const TEST_DATA_FOLDER: string = path.join(__dirname, 'test-data');

function createConfig(overrides: Partial<FlowAnalyzerEngineConfig> = {}): FlowAnalyzerEngineConfig {
    return {
        target_org: 'my-org',
        api_timeout_ms: 1000,
        api_version: '68.0',
        rules_path: '/flowbuilder/flow-analyzer/rules',
        analyze_path: '/flowbuilder/flow-analyzer/analysis/metadata-archive',
        max_file_count: 10,
        max_file_bytes: 10000,
        max_payload_bytes: 20000,
        ...overrides
    };
}

const SAMPLE_RULES: RuleDescription[] = [{
    name: 'UnusedVariable',
    severityLevel: SeverityLevel.Moderate,
    tags: ['Recommended'],
    description: 'Unused flow variable',
    resourceUrls: []
}];

describe('FlowAnalyzerEngine', () => {
    let authService: jest.Mocked<FlowAnalyzerAuthService>;
    let apiClient: jest.Mocked<FlowAnalyzerApiClient>;

    beforeEach(() => {
        authService = {
            initialize: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<FlowAnalyzerAuthService>;
        apiClient = {
            describeRules: jest.fn().mockResolvedValue(SAMPLE_RULES),
            analyze: jest.fn().mockResolvedValue([])
        } as unknown as jest.Mocked<FlowAnalyzerApiClient>;
    });

    function createEngine(): FlowAnalyzerEngine {
        return new FlowAnalyzerEngine(createConfig(), {
            authService,
            apiClient,
            fileCollector: new FlowFileCollector(10, 10000, 20000),
            locationMapper: new FindingLocationMapper()
        });
    }

    it('returns flowAnalyzer from getName', () => {
        expect(createEngine().getName()).toEqual('flowAnalyzer');
    });

    it('returns a semantic version', async () => {
        const version = await createEngine().getEngineVersion();
        expect(version).toMatch(/\d+\.\d+\.\d+.*/);
    });

    it('returns no rules when the workspace has no Flow files', async () => {
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-no-flows')]);
        const rules = await createEngine().describeRules(createDescribeOptions(workspace));
        expect(rules).toEqual([]);
        expect(apiClient.describeRules).not.toHaveBeenCalled();
    });

    it('maps the remote catalog when Flow files exist', async () => {
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const rules = await createEngine().describeRules(createDescribeOptions(workspace));
        expect(rules).toEqual(SAMPLE_RULES);
        expect(authService.initialize).toHaveBeenCalledWith({ targetOrg: 'my-org' });
    });

    it('returns no rules instead of throwing when the catalog cannot be retrieved', async () => {
        apiClient.describeRules.mockRejectedValue(new Error('HTTP 404'));
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const engine = createEngine();
        const rules = await engine.describeRules(createDescribeOptions(workspace));
        expect(rules).toEqual([]);
    });

    it('throws when the target org cannot be authenticated', async () => {
        authService.initialize.mockRejectedValue(new Error(getMessage('OrgNotFound', 'farmor', 'farmor')));
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        await expect(createEngine().describeRules(createDescribeOptions(workspace)))
            .rejects.toThrow(getMessage('OrgNotFound', 'farmor', 'farmor'));
    });

    it('skips runRules instead of throwing when analyze fails', async () => {
        apiClient.analyze.mockRejectedValue(new Error('HTTP 404'));
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(results.violations).toEqual([]);
        expect(results.insights).toEqual(expect.objectContaining({
            status: 'skipped',
            error: expect.objectContaining({ code: 'FLOW_ANALYZER_UNAVAILABLE' })
        }));
    });

    it('returns zero violations when no rules are selected', async () => {
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules([], createRunOptions(workspace));
        expect(results.violations).toHaveLength(0);
        expect(apiClient.analyze).not.toHaveBeenCalled();
    });

    it('returns zero violations when no Flow files are targeted', async () => {
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-no-flows')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(results.violations).toHaveLength(0);
        expect(apiClient.analyze).not.toHaveBeenCalled();
    });

    it('describes rules without a workspace by calling the remote catalog', async () => {
        const rules = await createEngine().describeRules(createDescribeOptions());
        expect(rules).toEqual(SAMPLE_RULES);
        expect(authService.initialize).toHaveBeenCalled();
    });

    it('filters unselected catalog rules and maps selected findings to XML locations', async () => {
        apiClient.analyze.mockResolvedValue([
            {
                ruleName: 'UnusedVariable',
                message: 'Remove unused var',
                relativeFilePath: 'Sample.flow-meta.xml',
                elementApiName: 'unusedVar',
                elementType: 'variables'
            },
            {
                ruleName: 'UnusedVariable',
                message: 'should be filtered if not selected - still known',
                relativeFilePath: 'Sample.flow-meta.xml',
                elementApiName: 'unusedVar'
            }
        ]);
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(apiClient.analyze).toHaveBeenCalledWith(expect.any(Array), { rules: ['UnusedVariable'] });
        expect(results.violations).toHaveLength(2);
        expect(results.violations[0].codeLocations[0].startLine).toBeGreaterThan(1);
        expect(results.violations[0].codeLocations[0].file).toContain('Sample.flow-meta.xml');
    });

    it('fails on findings whose rule is absent from the catalog', async () => {
        apiClient.analyze.mockResolvedValue([{
            ruleName: 'NotInCatalog',
            message: 'bad',
            relativeFilePath: 'Sample.flow-meta.xml',
            elementApiName: 'unusedVar'
        }]);
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(results.insights).toEqual(expect.objectContaining({
            status: 'skipped',
            error: expect.objectContaining({
                message: getMessage('UnknownRuleInFindings', 'NotInCatalog')
            })
        }));
    });

    it('fails on findings whose path was not submitted', async () => {
        apiClient.analyze.mockResolvedValue([{
            ruleName: 'UnusedVariable',
            message: 'bad',
            relativeFilePath: 'Other.flow-meta.xml',
            elementApiName: 'unusedVar'
        }]);
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(results.insights).toEqual(expect.objectContaining({
            status: 'skipped',
            error: expect.objectContaining({
                message: getMessage('PathNotSubmitted', 'Other.flow-meta.xml')
            })
        }));
    });

    it('uses a file-level 1:1 anchor when the element cannot be mapped', async () => {
        apiClient.analyze.mockResolvedValue([{
            ruleName: 'UnusedVariable',
            message: 'unmapped',
            relativeFilePath: 'Sample.flow-meta.xml',
            elementApiName: 'doesNotExist',
            elementType: 'variables'
        }]);
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(results.violations[0].codeLocations[0].startLine).toEqual(1);
        expect(results.violations[0].codeLocations[0].comment).toContain('File-level 1:1 anchor');
    });

    it('uses a file-level 1:1 anchor when elementApiName is empty', async () => {
        apiClient.analyze.mockResolvedValue([{
            ruleName: 'UnusedVariable',
            message: 'unmapped',
            relativeFilePath: 'Sample.flow-meta.xml',
            elementApiName: ''
        }]);
        const workspace = new Workspace('id', [path.join(TEST_DATA_FOLDER, 'example-workspaces', 'contains-one-flow')]);
        const results = await createEngine().runRules(['UnusedVariable'], createRunOptions(workspace));
        expect(results.violations[0].codeLocations[0].startLine).toEqual(1);
    });

    it('creates a unique temp folder per helper call', () => {
        const first = createRunOptions(new Workspace('id', [os.tmpdir()]));
        const second = createRunOptions(new Workspace('id', [os.tmpdir()]));
        expect(first.workingFolder).not.toEqual(second.workingFolder);
        expect(fs.existsSync(TEST_DATA_FOLDER)).toBe(true);
    });
});
