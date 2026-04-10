import {applyBulkSuppressions, BulkSuppressionQuotas} from "../../src/suppressions/bulk-suppression-processor";
import {BulkSuppressionRule} from "../../src/config";
import {Violation, CodeLocation} from "../../src/results";
import {RuleImpl} from "../../src/rules";

// Helper to enable debug logging in tests via environment variable
const createTestLogger = () => {
    if (process.env.DEBUG_BULK_SUPPRESSIONS === 'true') {
        return (level: 'error' | 'warn' | 'debug', message: string) => {
            console.log(`[${level.toUpperCase()}] ${message}`);
        };
    }
    return undefined;
};

/**
 * Tests specifically for Bug #2: Workspace Root vs Config Root inconsistency
 *
 * BUG: Bulk suppressions were using config.getConfigRoot() while ignores feature
 * uses workspace.getWorkspaceRoot(). This caused path resolution inconsistency.
 *
 * SCENARIO: User runs from /workspace/dreamhouse with config at
 * /workspace/dreamhouse/force-app/main/default/react-components/code-analyzer.yml
 *
 * EXPECTED: Paths in config should be relative to workspace root (consistent with ignores)
 * ACTUAL (Bug): Paths were relative to config root (where config file lives)
 */

// Mock violation and code location for testing
class MockCodeLocation implements CodeLocation {
    constructor(
        private file: string,
        private startLine: number,
        private startColumn: number,
        private endLine: number,
        private endColumn: number
    ) {}

    getFile(): string { return this.file; }
    getStartLine(): number { return this.startLine; }
    getStartColumn(): number { return this.startColumn; }
    getEndLine(): number { return this.endLine; }
    getEndColumn(): number { return this.endColumn; }
    getComment(): string | undefined { return undefined; }
}

class MockViolation implements Violation {
    constructor(
        private rule: RuleImpl,
        private message: string,
        private primaryLocation: CodeLocation,
        private otherLocations: CodeLocation[] = []
    ) {}

    getRule(): RuleImpl { return this.rule; }
    getMessage(): string { return this.message; }
    getPrimaryLocation(): CodeLocation { return this.primaryLocation; }
    getCodeLocations(): CodeLocation[] {
        return [this.primaryLocation, ...this.otherLocations];
    }
    getPrimaryLocationIndex(): number { return 0; }
    getResourceUrls(): string[] { return []; }
    getFixes(): any[] { return []; }
    getSuggestions(): any[] { return []; }
}

// Mock rule for testing
const mockRule = {
    getName: () => 'no-console',
    getEngineName: () => 'eslint',
    getSeverityLevel: () => 3,
    getTags: () => ['Recommended'],
    getDescription: () => 'Mock rule',
    getResourceUrls: () => [],
    matchesRuleSelector: () => true
} as unknown as RuleImpl;

describe('Bulk Suppressions - Workspace Root Path Resolution (Bug #2)', () => {
    /**
     * BUG #2 TEST: Config in subdirectory, workspace root at parent level
     *
     * Setup mirrors real-world scenario:
     * - Workspace root: /Users/user/workspace/dreamhouse
     * - Config file at: /Users/user/workspace/dreamhouse/force-app/main/default/react-components/code-analyzer.yml
     * - Violation file: /Users/user/workspace/dreamhouse/force-app/main/default/react-components/utils.js
     *
     * Config path should be: "force-app/main/default/react-components/utils.js" (relative to workspace root)
     * NOT: "utils.js" (relative to config root)
     */
    it('BUG #2: Paths in config are resolved relative to WORKSPACE ROOT, not config file location', () => {
        // Workspace root (where -w flag points)
        const workspaceRoot = '/Users/user/workspace/dreamhouse';

        // Violation file path (absolute)
        const violationFilePath = '/Users/user/workspace/dreamhouse/force-app/main/default/react-components/utils.js';

        // Create violation
        const violation = new MockViolation(
            mockRule,
            'Unexpected console statement',
            new MockCodeLocation(violationFilePath, 10, 1, 10, 20)
        );

        // Bulk config with path relative to WORKSPACE ROOT (consistent with ignores)
        // This is what user should write in config file
        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'force-app/main/default/react-components/utils.js': [
                {
                    rule_selector: 'eslint:all',
                    max_suppressed_violations: 3
                }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();

        // Apply suppressions using workspace root (Bug #2 fix)
        const result = applyBulkSuppressions([violation], bulkConfig, quotas, workspaceRoot, createTestLogger());

        // Violation should be suppressed
        expect(result.unsuppressedViolations).toHaveLength(0);
        expect(result.suppressedCount).toBe(1);
    });

    it('BUG #2: Same directory level - workspace root equals config directory (worked before bug fix)', () => {
        // This case worked even with Bug #2 because workspace root === config root
        const workspaceRoot = '/Users/user/workspace/project';
        const violationFilePath = '/Users/user/workspace/project/utils.js';

        const violation = new MockViolation(
            mockRule,
            'Unexpected console statement',
            new MockCodeLocation(violationFilePath, 10, 1, 10, 20)
        );

        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'utils.js': [
                {
                    rule_selector: 'eslint:all',
                    max_suppressed_violations: 3
                }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions([violation], bulkConfig, quotas, workspaceRoot, createTestLogger());

        // Should work regardless of bug
        expect(result.unsuppressedViolations).toHaveLength(0);
        expect(result.suppressedCount).toBe(1);
    });

    it('BUG #2: Config in subdirectory with WRONG path (relative to config root) does NOT suppress', () => {
        // This demonstrates the bug - if user writes path relative to config file location
        const workspaceRoot = '/Users/user/workspace/dreamhouse';
        const violationFilePath = '/Users/user/workspace/dreamhouse/force-app/main/default/react-components/utils.js';

        const violation = new MockViolation(
            mockRule,
            'Unexpected console statement',
            new MockCodeLocation(violationFilePath, 10, 1, 10, 20)
        );

        // WRONG: Path relative to config file location (where old bug would require)
        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'utils.js': [  // This is relative to config dir, not workspace root
                {
                    rule_selector: 'eslint:all',
                    max_suppressed_violations: 3
                }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions([violation], bulkConfig, quotas, workspaceRoot, createTestLogger());

        // Should NOT suppress because path doesn't match
        expect(result.unsuppressedViolations).toHaveLength(1);
        expect(result.suppressedCount).toBe(0);
    });

    it('BUG #2: Multiple files at different levels all resolve correctly from workspace root', () => {
        const workspaceRoot = '/workspace/project';

        // Violations at different directory levels
        const violation1 = new MockViolation(
            mockRule,
            'Console in nested file',
            new MockCodeLocation('/workspace/project/src/utils.js', 10, 1, 10, 20)
        );

        const violation2 = new MockViolation(
            mockRule,
            'Console in deeper nested file',
            new MockCodeLocation('/workspace/project/force-app/main/default/lwc/component.js', 20, 1, 20, 20)
        );

        const violation3 = new MockViolation(
            mockRule,
            'Console in root file',
            new MockCodeLocation('/workspace/project/index.js', 30, 1, 30, 20)
        );

        // All paths relative to workspace root
        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'src/utils.js': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 1 }
            ],
            'force-app/main/default/lwc/component.js': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 1 }
            ],
            'index.js': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 1 }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions(
            [violation1, violation2, violation3],
            bulkConfig,
            quotas,
            workspaceRoot,
            createTestLogger()
        );

        // All should be suppressed
        expect(result.unsuppressedViolations).toHaveLength(0);
        expect(result.suppressedCount).toBe(3);
    });

    it('BUG #2: Folder-level suppression from workspace root matches nested files', () => {
        const workspaceRoot = '/workspace/project';

        // Violations in nested folder
        const violation1 = new MockViolation(
            mockRule,
            'Console',
            new MockCodeLocation('/workspace/project/src/utils/helper.js', 10, 1, 10, 20)
        );

        const violation2 = new MockViolation(
            mockRule,
            'Console',
            new MockCodeLocation('/workspace/project/src/utils/formatter.js', 20, 1, 20, 20)
        );

        // Suppress entire folder (path relative to workspace root)
        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'src/utils/': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 10 }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions(
            [violation1, violation2],
            bulkConfig,
            quotas,
            workspaceRoot,
            createTestLogger()
        );

        // Both files in folder should be suppressed
        expect(result.unsuppressedViolations).toHaveLength(0);
        expect(result.suppressedCount).toBe(2);
    });

    it('BUG #2: Absolute paths in config still work (edge case)', () => {
        // Users shouldn't use absolute paths, but they should still work
        const workspaceRoot = '/workspace/project';
        const violationFilePath = '/workspace/project/src/file.js';

        const violation = new MockViolation(
            mockRule,
            'Console',
            new MockCodeLocation(violationFilePath, 10, 1, 10, 20)
        );

        // Absolute path in config (not recommended but should work)
        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            '/workspace/project/src/file.js': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 1 }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions([violation], bulkConfig, quotas, workspaceRoot, createTestLogger());

        // Should suppress
        expect(result.unsuppressedViolations).toHaveLength(0);
        expect(result.suppressedCount).toBe(1);
    });

    it('BUG #2: Path resolution consistent with ignores feature behavior', () => {
        /**
         * This test documents that bulk suppressions now behave the same as ignores:
         * - Both use workspace.getWorkspaceRoot() for path resolution
         * - Both resolve paths relative to workspace root
         * - Both fall back to absolute paths if workspace root is null
         */
        const workspaceRoot = '/Users/user/dreamhouse';

        // Imagine ignores config: ["force-app/test/**"]
        // Imagine bulk suppressions: "force-app/main/default/utils.js"
        // Both should resolve relative to /Users/user/dreamhouse

        const violation = new MockViolation(
            mockRule,
            'Console',
            new MockCodeLocation('/Users/user/dreamhouse/force-app/main/default/utils.js', 10, 1, 10, 20)
        );

        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'force-app/main/default/utils.js': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 1 }
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions([violation], bulkConfig, quotas, workspaceRoot, createTestLogger());

        expect(result.unsuppressedViolations).toHaveLength(0);
        expect(result.suppressedCount).toBe(1);
    });

    it('Duplicate rule selectors have independent quotas', () => {
        /**
         * When config has duplicate rule_selector entries, each should get its own quota.
         * This allows users to specify multiple quota allocations for the same selector.
         *
         * Example use case:
         * suppressions:
         *   force-app/utils.js:
         *     - rule_selector: no-magic-numbers,pmd
         *       max_suppressed_violations: 3
         *     - rule_selector: no-magic-numbers,pmd
         *       max_suppressed_violations: 2
         *
         * Expected: 5 total violations suppressed (3 + 2), not 3 with shared quota
         */
        const workspaceRoot = '/Users/user/workspace';
        const filePath = '/Users/user/workspace/force-app/utils.js';

        // Create 6 violations that would match the duplicate selectors
        const violations: Violation[] = [];
        for (let i = 1; i <= 6; i++) {
            violations.push(new MockViolation(
                mockRule,
                `Violation ${i}`,
                new MockCodeLocation(filePath, i, 1, i, 10)
            ));
        }

        const bulkConfig: Record<string, BulkSuppressionRule[]> = {
            'force-app/utils.js': [
                { rule_selector: 'eslint:all', max_suppressed_violations: 3 },
                { rule_selector: 'eslint:all', max_suppressed_violations: 2 }  // Duplicate selector
            ]
        };

        const quotas: BulkSuppressionQuotas = new Map();
        const result = applyBulkSuppressions(violations, bulkConfig, quotas, workspaceRoot, createTestLogger());

        // First rule suppresses 3, second rule suppresses 2 = 5 total
        expect(result.suppressedCount).toBe(5);
        expect(result.unsuppressedViolations).toHaveLength(1);
    });
});
