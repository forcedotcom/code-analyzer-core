import {
    SeverityLevel,
    type RuleDescription,
} from "@salesforce/code-analyzer-engine-api";
import { getMessage } from "./messages";

const UIBUNDLE_INTEGRITY_TAG = "UIBundleIntegrity";

export const RULES: RuleDescription[] = [
    {
        name: "missing-sourcemap",
        severityLevel: SeverityLevel.High,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('MissingSourcemapRuleDescription'),
        resourceUrls: [
            "https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map",
        ],
    },
    {
        name: "path-leakage",
        severityLevel: SeverityLevel.Moderate,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('PathLeakageRuleDescription'),
        resourceUrls: [],
    },
    {
        name: "invalid-source-references",
        severityLevel: SeverityLevel.High,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('InvalidSourceReferencesRuleDescription'),
        resourceUrls: [],
    },
    {
        name: "vlq-integrity",
        severityLevel: SeverityLevel.High,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('VlqIntegrityRuleDescription'),
        resourceUrls: ["https://tc39.es/ecma426/#sec-mapping-groups"],
    },
    {
        name: "source-content-verification",
        severityLevel: SeverityLevel.High,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('SourceContentVerificationRuleDescription'),
        resourceUrls: ["https://tc39.es/source-map/"],
    },
    {
        name: "coverage-analysis",
        severityLevel: SeverityLevel.Info,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('CoverageAnalysisRuleDescription'),
        resourceUrls: [],
    },
    {
        name: "structural-coherence",
        severityLevel: SeverityLevel.Info,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('StructuralCoherenceRuleDescription'),
        resourceUrls: [],
    },
    {
        name: "token-consistency",
        severityLevel: SeverityLevel.Info,
        tags: [
            UIBUNDLE_INTEGRITY_TAG,
        ],
        description: getMessage('TokenConsistencyRuleDescription'),
        resourceUrls: [],
    },
];

export const RULE_NAMES: Set<string> = new Set(RULES.map((r) => r.name));
