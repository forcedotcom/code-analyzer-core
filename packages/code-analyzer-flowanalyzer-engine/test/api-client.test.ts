import { SeverityLevel } from '@salesforce/code-analyzer-engine-api';
import { FlowAnalyzerApiClient } from '../src/services/FlowAnalyzerApiClient';
import { FlowAnalyzerAuthService } from '../src/services/FlowAnalyzerAuthService';
import { getMessage } from '../src/messages';
import { CollectedFlowFile } from '../src/types';

describe('FlowAnalyzerApiClient', () => {
    let token = 'token';
    const refreshAccessToken = jest.fn(async () => { token = 'fresh-token'; });
    const authService = {
        getAccessToken: () => token,
        refreshAccessToken,
        getInstanceUrl: () => 'https://example.my.salesforce.com',
        getApiVersion: () => '68.0'
    } as unknown as FlowAnalyzerAuthService;

    const sampleFiles: CollectedFlowFile[] = [{
        absolutePath: '/tmp/a.flow-meta.xml',
        relativeFilePath: 'a.flow-meta.xml',
        content: '<Flow></Flow>'
    }];

    function createClient(fetchImpl: typeof fetch): FlowAnalyzerApiClient {
        return new FlowAnalyzerApiClient(
            authService,
            1000,
            '68.0',
            '/flowbuilder/flow-analyzer/rules',
            '/flowbuilder/flow-analyzer/analysis/metadata-archive',
            jest.fn(),
            fetchImpl
        );
    }

    it('maps the listFlowAnalyzerRules catalog contract', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                rules: [{
                    id: 'MISSING_FLOW_DESCRIPTION',
                    name: 'Localized rule',
                    category: { id: 'DOCUMENTATION_AND_NAMING_STANDARDS', label: 'Docs' },
                    defaultSeverity: 'INFO',
                    effectiveSeverity: 'ERROR',
                    enabled: true
                }]
            })
        });
        const rules = await createClient(fetchImpl as unknown as typeof fetch).describeRules();
        expect(rules[0]).toEqual({
            name: 'MISSING_FLOW_DESCRIPTION',
            severityLevel: SeverityLevel.High,
            tags: ['Recommended', 'DOCUMENTATION_AND_NAMING_STANDARDS'],
            description: 'Localized rule',
            resourceUrls: []
        });
        expect(fetchImpl.mock.calls[0][0]).toContain('/flowbuilder/flow-analyzer/rules');
    });

    it('maps a top-level catalog array and numeric severity', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify([{ name: 'R2', severityLevel: 4 }])
        });
        const rules = await createClient(fetchImpl as unknown as typeof fetch).describeRules();
        expect(rules[0].severityLevel).toEqual(SeverityLevel.Low);
        expect(rules[0].tags).toEqual(['Recommended']);
    });

    it('maps ERROR/WARNING/INFO severities from the analyzer contract', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify([
                { ruleId: 'R-ERR', severity: 'ERROR' },
                { ruleId: 'R-WARN', severity: 'WARNING' },
                { ruleId: 'R-INFO', severity: 'INFO', category: 'Performance' }
            ])
        });
        const rules = await createClient(fetchImpl as unknown as typeof fetch).describeRules();
        expect(rules[0].name).toEqual('R-ERR');
        expect(rules[0].severityLevel).toEqual(SeverityLevel.High);
        expect(rules[1].severityLevel).toEqual(SeverityLevel.Moderate);
        expect(rules[2].severityLevel).toEqual(SeverityLevel.Info);
        expect(rules[2].tags).toEqual(['Recommended', 'Performance']);
    });

    it('fails on a malformed catalog', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ unexpected: true })
        });
        await expect(createClient(fetchImpl as unknown as typeof fetch).describeRules())
            .rejects.toThrow(getMessage('CatalogMalformed'));
    });

    it('posts a multipart ZIP to the metadata-archive endpoint', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                flowAnalyses: [{
                    relativeFilePath: 'a.flow-meta.xml',
                    findings: [{
                        ruleId: 'R1',
                        ruleName: 'R1',
                        message: 'm',
                        elementApiName: 'n'
                    }]
                }]
            })
        });
        const findings = await createClient(fetchImpl as unknown as typeof fetch).analyze(sampleFiles);
        expect(findings).toHaveLength(1);
        expect(findings[0].relativeFilePath).toEqual('a.flow-meta.xml');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, options] = fetchImpl.mock.calls[0];
        expect(url).toContain('/flowbuilder/flow-analyzer/analysis/metadata-archive');
        expect(options.method).toEqual('POST');
        expect(Buffer.isBuffer(options.body)).toBe(true);
        expect(options.headers['content-type']).toMatch(/multipart\/form-data/);
    });

    it('includes ruleSelection.rules when provided and omits categories', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ flowAnalyses: [] })
        });
        await createClient(fetchImpl as unknown as typeof fetch).analyze(sampleFiles, { rules: ['UnusedVariable'] });
        const body = fetchImpl.mock.calls[0][1].body as Buffer;
        expect(body.toString('utf8')).toContain('ruleSelection');
        expect(body.toString('utf8')).toContain('UnusedVariable');
        expect(body.toString('utf8')).not.toContain('categories');
    });

    beforeEach(() => {
        token = 'token';
        refreshAccessToken.mockClear();
    });

    it('refreshes the access token and retries once on a 401', async () => {
        const fetchImpl = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'expired' })
            .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ rules: [{ name: 'A' }] }) });
        const rules = await createClient(fetchImpl as unknown as typeof fetch).describeRules();
        expect(rules).toHaveLength(1);
        expect(refreshAccessToken).toHaveBeenCalledTimes(1);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
        expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-token');
    });

    it('surfaces HTTP failures', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'nope'
        });
        await expect(createClient(fetchImpl as unknown as typeof fetch).describeRules())
            .rejects.toThrow('HTTP 401');
    });

    it('wraps network failures from analyze as AnalyzeFailed', async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error('socket hang up'));
        await expect(createClient(fetchImpl as unknown as typeof fetch).analyze(sampleFiles))
            .rejects.toThrow(getMessage('AnalyzeFailed', 'socket hang up'));
    });

    it('fails when analyze JSON is not an object with findings', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ nope: true })
        });
        await expect(createClient(fetchImpl as unknown as typeof fetch).analyze(sampleFiles))
            .rejects.toThrow(getMessage('AnalyzeMalformed'));
    });

    it('fails when the catalog JSON is not parseable', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => 'not-json'
        });
        await expect(createClient(fetchImpl as unknown as typeof fetch).describeRules())
            .rejects.toThrow(getMessage('CatalogMalformed'));
    });

    it('fails when a catalog rule is missing a name', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify([{ severityLevel: 2 }])
        });
        await expect(createClient(fetchImpl as unknown as typeof fetch).describeRules())
            .rejects.toThrow(getMessage('CatalogMalformed'));
    });

    it('uses default fetch when no implementation is injected', () => {
        const client = new FlowAnalyzerApiClient(
            authService,
            1000,
            '68.0',
            '/flowbuilder/flow-analyzer/rules',
            '/flowbuilder/flow-analyzer/analysis/metadata-archive'
        );
        expect(client).toBeInstanceOf(FlowAnalyzerApiClient);
    });

    it('keeps disabled catalog rules and omits Recommended', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                rules: [{
                    id: 'DISABLED_RULE',
                    name: 'Off',
                    effectiveSeverity: 'WARNING',
                    enabled: false,
                    category: { id: 'SECURITY' }
                }]
            })
        });
        const rules = await createClient(fetchImpl as unknown as typeof fetch).describeRules();
        expect(rules[0].name).toEqual('DISABLED_RULE');
        expect(rules[0].tags).toEqual(['SECURITY']);
        expect(rules[0].severityLevel).toEqual(SeverityLevel.Moderate);
    });

    it('defaults unknown severity strings to Moderate', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify([{ name: 'R3', severityLevel: 'nope' }])
        });
        const rules = await createClient(fetchImpl as unknown as typeof fetch).describeRules();
        expect(rules[0].severityLevel).toEqual(SeverityLevel.Moderate);
    });
});
