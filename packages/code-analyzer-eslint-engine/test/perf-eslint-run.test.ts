import {Engine, RuleDescription, Workspace} from "@salesforce/code-analyzer-engine-api";
import {ESLintEnginePlugin} from "../src";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {createDescribeOptions, createRunOptions} from "./test-helpers";

/**
 * One-off performance probe for running ESLint rules (runRules).
 *
 * What this test does:
 * - Instantiates the ESLint engine with the current base configuration.
 * - Discovers rules (describeRules), then selects a subset to run (e.g., Recommended).
 * - Runs the engine against the provided workspace (PERF_WS must be set).
 * - Samples Node's resident set size (RSS) and prints a JSON summary:
 *     {
 *       "files_scanned": <unique files that produced violations>,
 *       "rules_run": <number of rules executed>,
 *       "run_ms": <wall time in milliseconds for runRules>,
 *       "peak_rss_mb": <approximate peak memory (MB) observed during the run>,
 *       "violations": <total violations found>
 *     }
 *
 * How to run (skipped by default; opt-in with env var):
 *   ESLINT_ENGINE_PERF_RUN=true PERF_WS="/absolute/path/to/project" PERF_DISCOVER=true \
 *   npm run test-typescript -- packages/code-analyzer-eslint-engine/test/perf-eslint-run.test.ts
 *
 * Optional env vars:
 * - PERF_RULES_LIMIT=200  → cap the number of rules to run (keeps runtime stable)
 * - PERF_DISCOVER=true    → let ESLint auto-discover configs from PERF_WS (sets config_root to PERF_WS)
 * - You can toggle:
 *     // disable_react_base_config: true,
 *     // disable_typescript_base_config: true,
 *   in the config below to attribute parser/plugin costs.
 */
const RUN = process.env.ESLINT_ENGINE_PERF_RUN === 'true';
(RUN ? describe : describe.skip)('ESLint engine perf (runRules one-off)', () => {
    it('measures runRules wall time and peak RSS', async () => {
        const cfg: ESLintEngineConfig = {
            ...DEFAULT_CONFIG,
            // Toggle to isolate costs if desired:
            disable_react_base_config: false,
            disable_typescript_base_config: true,
            config_root: __dirname,
            auto_discover_eslint_config: process.env.PERF_DISCOVER === 'true',
        };

        const wsPath = process.env.PERF_WS;
        if (!wsPath) {
            throw new Error('PERF_WS env var must be set to an absolute path for runRules perf test.');
        }
        const ws: Workspace = new Workspace('perf', [wsPath]);
        if (process.env.PERF_DISCOVER === 'true') {
            cfg.config_root = wsPath;
        }

        const engine: Engine = await new ESLintEnginePlugin().createEngine('eslint', cfg);

        // Discover and select rules to run (Recommended by default), with an optional cap.
        const discovered: RuleDescription[] = await engine.describeRules(createDescribeOptions(ws));
        const rulesToRun: string[] = discovered
            .filter(r => r.tags.includes('Recommended'))
            .slice(0, Number(process.env.PERF_RULES_LIMIT) || 200)
            .map(r => r.name);

        const peak = {rss: 0};
        const sampler = setInterval(() => {
            const m = process.memoryUsage();
            if (m.rss > peak.rss) peak.rss = m.rss;
        }, 50);

        const mem0 = process.memoryUsage().rss;
        const t0 = performance.now();
        const results = await engine.runRules(rulesToRun, createRunOptions(ws));
        const t1 = performance.now();
        const mem1 = process.memoryUsage().rss;
        clearInterval(sampler);

        // Calculate files that produced violations (as a proxy for scanned footprint).
        const filesScanned = Array.from(new Set(results.violations.map(v => v.codeLocations[0].file))).length;

        // eslint-disable-next-line no-console
        console.log(JSON.stringify({
            files_scanned: filesScanned,
            rules_run: rulesToRun.length,
            run_ms: Math.round(t1 - t0),
            peak_rss_mb: Math.round(Math.max(peak.rss, mem0, mem1) / (1024 * 1024)),
            violations: results.violations.length
        }, null, 2));

        expect(rulesToRun.length).toBeGreaterThan(0);
    });
});

