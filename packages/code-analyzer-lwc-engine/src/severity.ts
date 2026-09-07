import { SeverityLevel } from "@salesforce/code-analyzer-engine-api";

// DiagnosticLevel from @lwc/errors:
//   Fatal=0, Error=1, Warning=2, Log=3
//
// SeverityLevel from code-analyzer-engine-api:
//   Critical=1, High=2, Moderate=3, Low=4, Info=5
//
// Log collapses to Info; SARIF round-trip imperfection is accepted as
// a v1 known limitation (§16).
export function toSeverityLevel(level: number | undefined): SeverityLevel {
    switch (level) {
        case 0: return SeverityLevel.Critical;  // Fatal
        case 1: return SeverityLevel.Critical;  // Error
        case 2: return SeverityLevel.High;      // Warning
        case 3: return SeverityLevel.Info;      // Log
        default: return SeverityLevel.Moderate;     // unknown — bias toward visibility
    }
}
