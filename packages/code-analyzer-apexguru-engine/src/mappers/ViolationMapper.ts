

import { Violation, CodeLocation, Fix, Suggestion } from '@salesforce/code-analyzer-engine-api';
import { ApexGuruViolation, ApexGuruLocation, ApexGuruFix, ApexGuruSuggestion } from '../types';
import { isKnownRule, FALLBACK_RULE_NAME } from '../apexguru-rules';

/**
 * Maps ApexGuru violations to Code Analyzer's Violation format
 *
 * Note: Violations do not include severity/tags in Code Analyzer's data model.
 * Severity and tags are defined in RuleDescription (from describeRules()).
 *
 * For unknown rules (not in apexguru-rules.ts), violations are mapped to the
 * fallback rule "apexguru-other" to ensure Core validation passes.
 */
export class ViolationMapper {
    /**
     * Map ApexGuru violations to Code Analyzer violations
     */
    mapViolations(apexGuruViolations: ApexGuruViolation[], filePath: string): Violation[] {
        return apexGuruViolations.map(av => this.mapSingleViolation(av, filePath));
    }

    /**
     * Map a single ApexGuru violation
     *
     * If the rule is unknown (not declared in describeRules), map it to the fallback rule.
     */
    private mapSingleViolation(av: ApexGuruViolation, filePath: string): Violation {
        // Map unknown rules to fallback to ensure Core validation passes
        const ruleName = isKnownRule(av.rule) ? av.rule : FALLBACK_RULE_NAME;

        return {
            ruleName,
            message: av.message,
            codeLocations: av.locations.map(loc => this.normalizeLocation(loc, filePath)),
            primaryLocationIndex: av.primaryLocationIndex,
            resourceUrls: av.resources,
            fixes: av.fixes?.map(fix => this.mapFix(fix, filePath)),
            suggestions: av.suggestions?.map(suggestion => this.mapSuggestion(suggestion, filePath))
        };
    }

    /**
     * Map ApexGuru fix to Code Analyzer Fix
     * Note: ApexGuru API does not currently return fixes, only suggestions
     */
    private mapFix(apexGuruFix: ApexGuruFix, filePath: string): Fix {
        return {
            location: this.normalizeLocation(apexGuruFix.location, filePath),
            fixedCode: apexGuruFix.fixedCode
        };
    }

    /**
     * Map ApexGuru suggestion to Code Analyzer Suggestion
     * Note: suggestion.message contains "// explanation\ncode" - we keep it as-is
     */
    private mapSuggestion(apexGuruSuggestion: ApexGuruSuggestion, filePath: string): Suggestion {
        return {
            location: this.normalizeLocation(apexGuruSuggestion.location, filePath),
            message: apexGuruSuggestion.message  // Keep "// explanation\ncode" as-is
        };
    }

    /**
     * Normalize location by filling in required fields
     *
     * ApexGuru API only provides:
     * - startLine (required)
     * - comment (optional)
     *
     * We fill in:
     * - file (required by Code Analyzer, not in ApexGuru response)
     * - startColumn = 1 (required by Code Analyzer, reasonable default)
     * - endLine/endColumn are left undefined (optional fields)
     */
    private normalizeLocation(location: ApexGuruLocation, filePath: string): CodeLocation {
        const startLine = location.startLine ?? 1;
        const startColumn = location.startColumn ?? 1;  // Default to column 1 if not provided

        return {
            file: filePath,
            startLine,
            startColumn,
            endLine: location.endLine,      // undefined if not provided (optional)
            endColumn: location.endColumn,  // undefined if not provided (optional)
            comment: location.comment
        };
    }
}
