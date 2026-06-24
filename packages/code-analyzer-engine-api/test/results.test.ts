import { EngineRunResults } from '../src/results';

describe('Tests for EngineRunResults type', () => {
    it('When EngineRunResults has insights field, then it should be optional and accept Record<string,unknown>', () => {
        // Create mock EngineRunResults with insights
        const resultsWithInsights: EngineRunResults = {
            violations: [],
            insights: {
                analysis_mode: 'full',
                files_scanned: 5,
                violation_breakdown: { 'rule1': 3 },
                violation_count: 3,
                report_generated_ms: 1234567890
            }
        };

        // Assert insights is present and matches expected structure
        expect(resultsWithInsights.insights).toBeDefined();
        expect(resultsWithInsights.insights).toEqual({
            analysis_mode: 'full',
            files_scanned: 5,
            violation_breakdown: { 'rule1': 3 },
            violation_count: 3,
            report_generated_ms: 1234567890
        });
    });

    it('When EngineRunResults has no insights field, then it should be valid', () => {
        // Create mock EngineRunResults without insights
        const resultsWithoutInsights: EngineRunResults = {
            violations: []
        };

        // Assert results is valid
        expect(resultsWithoutInsights.violations).toBeDefined();
        expect(resultsWithoutInsights.insights).toBeUndefined();
    });
});
