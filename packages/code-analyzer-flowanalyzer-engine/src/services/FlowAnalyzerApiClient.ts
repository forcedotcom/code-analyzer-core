import { LogLevel, RuleDescription, SeverityLevel } from '@salesforce/code-analyzer-engine-api';
import FormData from 'form-data';
import { getMessage } from '../messages';
import {
    CollectedFlowFile,
    FlowAnalyzerAnalyzeResponse,
    FlowAnalyzerCatalogRule,
    FlowAnalyzerFinding,
    FlowAnalyzerRuleSelection,
    FlowAnalyzerRulesResponse
} from '../types';
import { FlowAnalyzerAuthService } from './FlowAnalyzerAuthService';
import { createMetadataArchive } from './MetadataArchiveBuilder';

export class FlowAnalyzerApiClient {
    private readonly authService: FlowAnalyzerAuthService;
    private readonly timeoutMs: number;
    private readonly apiVersion: string;
    private readonly rulesPath: string;
    private readonly analyzePath: string;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;
    private readonly fetchImpl: typeof fetch;

    constructor(
        authService: FlowAnalyzerAuthService,
        timeoutMs: number,
        apiVersion: string,
        rulesPath: string,
        analyzePath: string,
        emitLogEvent: (logLevel: LogLevel, message: string) => void = () => {},
        fetchImpl: typeof fetch = fetch
    ) {
        this.authService = authService;
        this.timeoutMs = timeoutMs;
        this.apiVersion = apiVersion;
        this.rulesPath = rulesPath;
        this.analyzePath = analyzePath;
        this.emitLogEvent = emitLogEvent;
        this.fetchImpl = fetchImpl;
    }

    async describeRules(): Promise<RuleDescription[]> {
        const payload = await this.requestJson<FlowAnalyzerRulesResponse>('GET', this.rulesPath);
        const rules = Array.isArray(payload) ? payload : payload.rules;
        if (!rules) {
            throw new Error(getMessage('CatalogMalformed'));
        }
        return rules.map(rule => this.toRuleDescription(rule));
    }

    async analyze(files: CollectedFlowFile[], ruleSelection?: FlowAnalyzerRuleSelection): Promise<FlowAnalyzerFinding[]> {
        const zipBuffer = await createMetadataArchive(files);
        const form = new FormData();
        form.append('fileData', zipBuffer, { filename: 'flows.zip', contentType: 'application/zip' });
        if (ruleSelection) {
            form.append('ruleSelection', JSON.stringify(ruleSelection), { contentType: 'application/json' });
        }

        const payload = await this.requestJson<FlowAnalyzerAnalyzeResponse>('POST', this.analyzePath, form);
        return this.extractFindings(payload);
    }

    private extractFindings(payload: FlowAnalyzerAnalyzeResponse): FlowAnalyzerFinding[] {
        if (payload.flowAnalyses && Array.isArray(payload.flowAnalyses)) {
            return payload.flowAnalyses.flatMap(analysis =>
                (analysis.findings ?? []).map(finding => ({
                    ...finding,
                    relativeFilePath: finding.relativeFilePath || analysis.relativeFilePath,
                    ruleName: finding.ruleName || finding.ruleId || ''
                }))
            );
        }
        if (Array.isArray(payload.findings)) {
            return payload.findings;
        }
        throw new Error(getMessage('AnalyzeMalformed'));
    }

    private toRuleDescription(rule: FlowAnalyzerCatalogRule): RuleDescription {
        const name = rule.id || rule.ruleId || rule.ruleName || rule.name;
        if (!name) {
            throw new Error(getMessage('CatalogMalformed'));
        }
        const categoryId = typeof rule.category === 'string' ? rule.category : rule.category?.id;
        const tags: string[] = [];
        if (rule.enabled !== false) {
            tags.push('Recommended');
        }
        if (categoryId) {
            tags.push(categoryId);
        }
        if (rule.tags) {
            for (const tag of rule.tags) {
                if (!tags.includes(tag)) {
                    tags.push(tag);
                }
            }
        }
        const localizedName = rule.name && rule.name !== name ? rule.name : undefined;
        return {
            name,
            severityLevel: this.toSeverityLevel(
                rule.effectiveSeverity ?? rule.severityLevel ?? rule.severity ?? rule.defaultSeverity
            ),
            tags: tags.length > 0 ? tags : ['Recommended'],
            description: rule.description || localizedName || '',
            resourceUrls: rule.resourceUrls ?? []
        };
    }

    private toSeverityLevel(value: SeverityLevel | string | number | undefined): SeverityLevel {
        if (typeof value === 'number' && value >= 1 && value <= 5) {
            return value as SeverityLevel;
        }
        if (typeof value === 'string') {
            const upper = value.toUpperCase();
            if (upper === 'ERROR' || upper === 'CRITICAL' || upper === 'HIGH') {
                return upper === 'ERROR' || upper === 'CRITICAL' ? SeverityLevel.High : SeverityLevel.High;
            }
            if (upper === 'WARNING' || upper === 'MODERATE') {
                return SeverityLevel.Moderate;
            }
            if (upper === 'INFO' || upper === 'LOW') {
                return upper === 'INFO' ? SeverityLevel.Info : SeverityLevel.Low;
            }
            const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
            const mapped = SeverityLevel[normalized as keyof typeof SeverityLevel];
            if (typeof mapped === 'number') {
                return mapped;
            }
        }
        return SeverityLevel.Moderate;
    }

    private async requestJson<T>(method: 'GET' | 'POST', resourcePath: string, body?: unknown): Promise<T> {
        const version = this.authService.getApiVersion() || this.apiVersion;
        const url = `${this.authService.getInstanceUrl()}/services/data/v${version}${resourcePath}`;
        this.emitLogEvent(LogLevel.Fine, `Flow Analyzer ${method} ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers: Record<string, string> = {
            Accept: 'application/json'
        };
        let requestBody: Buffer | string | undefined;
        if (body instanceof FormData) {
            Object.assign(headers, body.getHeaders());
            requestBody = body.getBuffer();
        } else if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            requestBody = JSON.stringify(body);
        }

        const send = (): Promise<Response> => this.fetchImpl(url, {
            method,
            headers: { ...headers, Authorization: `Bearer ${this.authService.getAccessToken()}` },
            body: requestBody,
            signal: controller.signal
        });

        try {
            let response = await send();
            if (response.status === 401) {
                // Cached session token expired: refresh it once and retry.
                await this.authService.refreshAccessToken();
                response = await send();
            }
            const text = await response.text();
            if (!response.ok) {
                throw new Error(getMessage('HttpError', url, response.status, text));
            }
            try {
                return JSON.parse(text) as T;
            } catch (_err) {
                throw new Error(method === 'GET' ? getMessage('CatalogMalformed') : getMessage('AnalyzeMalformed'));
            }
        } catch (err) {
            if (err instanceof Error && (err.message.startsWith('Flow Analyzer') || err.message.includes('malformed'))) {
                throw err;
            }
            const detail = err instanceof Error ? err.message : String(err);
            throw new Error(method === 'GET' ? getMessage('CatalogUnavailable', detail) : getMessage('AnalyzeFailed', detail));
        } finally {
            clearTimeout(timeout);
        }
    }
}
