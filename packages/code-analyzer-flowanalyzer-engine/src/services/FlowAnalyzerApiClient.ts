import { LogLevel, RuleDescription, SeverityLevel } from '@salesforce/code-analyzer-engine-api';
import FormData from 'form-data';
import { FLOW_ANALYZER_OPT_IN_TAG, MIN_API_VERSION } from '../constants';
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

const MAX_ERROR_BODY_LENGTH = 300;

export class FlowAnalyzerApiClient {
    private readonly authService: FlowAnalyzerAuthService;
    private readonly timeoutMs: number;
    private readonly apiVersion?: string;
    private readonly rulesPath: string;
    private readonly analyzePath: string;
    private readonly emitLogEvent: (logLevel: LogLevel, message: string) => void;
    private readonly fetchImpl: typeof fetch;

    constructor(
        authService: FlowAnalyzerAuthService,
        timeoutMs: number,
        apiVersion: string | undefined,
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
        // Flow Analyzer is a non-GA, org-backed engine, so its rules are strictly opt-in: they carry the
        // engine-specific opt-in tag and must never carry 'Recommended'.
        const tags: string[] = [FLOW_ANALYZER_OPT_IN_TAG];
        if (categoryId) {
            tags.push(categoryId);
        }
        if (rule.tags) {
            for (const tag of rule.tags) {
                if (tag.toLowerCase() !== 'recommended' && !tags.includes(tag)) {
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
            tags,
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

    /**
     * An explicitly configured api_version always wins. Otherwise use the org's version, but never one older than
     * MIN_API_VERSION, since the CLI connection's version may predate the Flow Analyzer endpoints.
     */
    private resolveApiVersion(): string {
        if (this.apiVersion) {
            return this.apiVersion;
        }
        const orgVersion = this.authService.getApiVersion();
        return orgVersion && parseFloat(orgVersion) > parseFloat(MIN_API_VERSION) ? orgVersion : MIN_API_VERSION;
    }

    /**
     * Error bodies can be Salesforce JSON errors, but also whole HTML pages from a proxy or gateway in front of the
     * org. Show the useful part only; the full body goes to the fine-level log.
     */
    private summarizeErrorBody(text: string): string {
        try {
            const parsed: unknown = JSON.parse(text);
            const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
            const messages: string[] = entries
                .map(entry => (entry as { message?: unknown } | null)?.message)
                .filter((message): message is string => typeof message === 'string' && message.length > 0);
            if (messages.length > 0) {
                return messages.join('; ');
            }
        } catch (_err) {
            // Not JSON, so fall through to the text handling below.
        }
        if (/^\s*<(!doctype|html)/i.test(text)) {
            const title: string | undefined = /<title[^>]*>([^<]*)<\/title>/i.exec(text)?.[1].trim();
            return getMessage('NonJsonErrorResponse', title || 'no title');
        }
        const collapsed: string = text.replace(/\s+/g, ' ').trim();
        return collapsed.length > MAX_ERROR_BODY_LENGTH ? `${collapsed.slice(0, MAX_ERROR_BODY_LENGTH)}...` : collapsed;
    }

    private async requestJson<T>(method: 'GET' | 'POST', resourcePath: string, body?: unknown): Promise<T> {
        const url = `${this.authService.getInstanceUrl()}/services/data/v${this.resolveApiVersion()}${resourcePath}`;
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
                this.emitLogEvent(LogLevel.Fine, `Flow Analyzer response body for HTTP ${response.status}: ${text}`);
                throw new Error(getMessage('HttpError', url, response.status, this.summarizeErrorBody(text)));
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
