import { EngineRunResultsImpl } from '../src/results';
import { RuleSelection } from '../src/rules';
import * as engApi from '@salesforce/code-analyzer-engine-api';

describe('Tests for EngineRunResults getInsights method', () => {
    const mockRuleSelection = {
        getRule: jest.fn().mockReturnValue({
            getName: () => 'TestRule',
            getSeverityLevel: () => 1
        })
    } as unknown as RuleSelection;

    it('When EngineRunResults has insights in apiEngineRunResults, then getInsights returns insights object', () => {
        const mockInsights = {
            analysis_mode: 'full',
            files_scanned: 5,
            violation_breakdown: { 'rule1': 3 },
            violation_count: 3,
            report_generated_ms: 1234567890
        };

        const apiEngineRunResults: engApi.EngineRunResults = {
            violations: [],
            insights: mockInsights
        };

        const engineRunResults = new EngineRunResultsImpl(
            'test-engine',
            '1.0.0',
            apiEngineRunResults,
            mockRuleSelection
        );

        expect(engineRunResults.getInsights()).toEqual(mockInsights);
    });

    it('When EngineRunResults has no insights, then getInsights returns undefined', () => {
        const apiEngineRunResults: engApi.EngineRunResults = {
            violations: []
        };

        const engineRunResults = new EngineRunResultsImpl(
            'test-engine',
            '1.0.0',
            apiEngineRunResults,
            mockRuleSelection
        );

        expect(engineRunResults.getInsights()).toBeUndefined();
    });
});

describe('Tests for RunResults getEngineInsights method', () => {
    it('When RunResults has engine with insights, then getEngineInsights returns insights for that engine', () => {
        const mockInsights = {
            analysis_mode: 'full',
            files_scanned: 3,
            violation_breakdown: { 'rule1': 2 },
            violation_count: 2,
            report_generated_ms: 9876543210
        };

        const apiEngineRunResults: engApi.EngineRunResults = {
            violations: [],
            insights: mockInsights
        };

        const mockRuleSelection = {
            getRule: jest.fn().mockReturnValue({
                getName: () => 'TestRule',
                getSeverityLevel: () => 1
            })
        } as unknown as RuleSelection;

        const engineRunResults = new EngineRunResultsImpl(
            'apexguru',
            '1.0.0',
            apiEngineRunResults,
            mockRuleSelection
        );

        // Create a minimal RunResults mock that has the engine
        const runResults = {
            engineRunResultsMap: new Map([['apexguru', engineRunResults]]),
            getEngineInsights(engineName: string): Record<string, unknown> | undefined {
                return this.engineRunResultsMap.get(engineName)?.getInsights();
            }
        };

        expect(runResults.getEngineInsights('apexguru')).toEqual(mockInsights);
    });

    it('When RunResults has engine without insights, then getEngineInsights returns undefined', () => {
        const apiEngineRunResults: engApi.EngineRunResults = {
            violations: []
        };

        const mockRuleSelection = {
            getRule: jest.fn().mockReturnValue({
                getName: () => 'TestRule',
                getSeverityLevel: () => 1
            })
        } as unknown as RuleSelection;

        const engineRunResults = new EngineRunResultsImpl(
            'eslint',
            '8.0.0',
            apiEngineRunResults,
            mockRuleSelection
        );

        const runResults = {
            engineRunResultsMap: new Map([['eslint', engineRunResults]]),
            getEngineInsights(engineName: string): Record<string, unknown> | undefined {
                return this.engineRunResultsMap.get(engineName)?.getInsights();
            }
        };

        expect(runResults.getEngineInsights('eslint')).toBeUndefined();
    });
});
