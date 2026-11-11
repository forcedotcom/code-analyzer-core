import { SeverityLevel } from '@salesforce/code-analyzer-engine-api';

export type AuthConfig = {
    targetOrg: string;
};

export type FlowAnalyzerRuleSelection = {
    rules?: string[];
    categories?: string[];
};

export type FlowAnalyzerCatalogCategory = {
    id?: string;
    label?: string;
};

export type FlowAnalyzerCatalogRule = {
    id?: string;
    name?: string;
    ruleId?: string;
    ruleName?: string;
    severityLevel?: SeverityLevel | string | number;
    severity?: string;
    defaultSeverity?: string;
    effectiveSeverity?: string;
    enabled?: boolean;
    tags?: string[];
    category?: string | FlowAnalyzerCatalogCategory;
    description?: string;
    resourceUrls?: string[];
};

export type FlowAnalyzerRulesResponse = {
    rules?: FlowAnalyzerCatalogRule[];
} | FlowAnalyzerCatalogRule[];

export type FlowAnalyzerFinding = {
    ruleId?: string;
    ruleName: string;
    message: string;
    relativeFilePath: string;
    elementApiName: string;
    elementType?: string;
    affectedField?: string;
    severity?: string;
    category?: string;
    remediation?: string;
};

export type FlowAnalyzerFlowAnalysis = {
    relativeFilePath: string;
    findings: FlowAnalyzerFinding[];
};

export type FlowAnalyzerAnalyzeResponse = {
    flowAnalyses?: FlowAnalyzerFlowAnalysis[];
    findings?: FlowAnalyzerFinding[];
};

export type CollectedFlowFile = {
    absolutePath: string;
    relativeFilePath: string;
    content: string;
};
