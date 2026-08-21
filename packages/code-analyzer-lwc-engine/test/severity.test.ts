import { SeverityLevel } from "@salesforce/code-analyzer-engine-api";
import { toSeverityLevel } from "../src/severity";

describe("toSeverityLevel", () => {
    it.each([
        [0, SeverityLevel.Critical],   // Fatal
        [1, SeverityLevel.Critical],   // Error
        [2, SeverityLevel.High],       // Warning
        [3, SeverityLevel.Info],       // Log
    ])("DiagnosticLevel %i maps to SeverityLevel %i", (level, expected) => {
        expect(toSeverityLevel(level)).toBe(expected);
    });

    it("unknown level falls back to Moderate", () => {
        expect(toSeverityLevel(undefined)).toBe(SeverityLevel.Moderate);
        expect(toSeverityLevel(99)).toBe(SeverityLevel.Moderate);
    });
});
