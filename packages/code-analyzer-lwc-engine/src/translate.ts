import { Violation } from "@salesforce/code-analyzer-engine-api";
import { CollectedDiagnostic } from "./compile";
import { ruleNameForCode } from "./rules";

// Spike doc §11. Trust d.url only — no synthesis or fallback.
export function toViolation(d: CollectedDiagnostic, fallbackFile: string): Violation {
    return {
        ruleName: ruleNameForCode(d.code),
        message: d.message,
        codeLocations: [{
            file: d.filename ?? fallbackFile,
            startLine: d.location?.line ?? 1,
            startColumn: d.location?.column ?? 1,
        }],
        primaryLocationIndex: 0,
        resourceUrls: d.url ? [d.url] : [],
    };
}
