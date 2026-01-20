import {Engine, RuleDescription, Workspace} from "@salesforce/code-analyzer-engine-api";
import {ESLintEnginePlugin} from "../src";
import {DEFAULT_CONFIG, ESLintEngineConfig} from "../src/config";
import {createDescribeOptions} from "./test-helpers";
import * as path from "node:path";

/**
 * One-off performance probe for the ESLint engine.
 *
 * What this test does:
 * - Instantiates the ESLint engine with the current base configuration.
 * - Calls engine.describeRules(), which exercises rule discovery (parsing configs, resolving plugins, building rule lists).
 * - Samples Node's resident set size (RSS) periodically to estimate the peak memory use during describeRules().
 * - Emits a single JSON object to stdout with:
 *     {
 *       "rule_count": <number of rules discovered>,
 *       "describe_ms": <wall time in milliseconds for describeRules>,
 *       "peak_rss_mb": <approximate peak memory (MB) observed during the call>
 *     }
 *
 * How to run (skipped by default; opt-in with env var):
 *   ESLINT_ENGINE_PERF=true npm run test-typescript -- packages/code-analyzer-eslint-engine/test/perf-eslint.test.ts
 * 
 * ESLINT_ENGINE_PERF=true PERF_WS="/Users/arun.tyagi/projects/dreamhouse-sfdx" PERF_DISCOVER=true \
 * npm run test-typescript -- packages/code-analyzer-eslint-engine/test/perf-eslint.test.ts
 *
 * What to look for:
 * - describe_ms: Use this to compare wall-time across changes. Lower is better.
 * - peak_rss_mb: Track memory impact/regressions (e.g., when enabling additional parsers/plugins).
 * - rule_count: Sanity check that you are comparing like-for-like runs (similar rule surface).
 *
 * How to isolate parser/plugin costs:
 * - Set disable_react_base_config: true  → measure baseline without React rules/plugins.
 * - Set disable_typescript_base_config: true → measure without the TypeScript parser/rules.
 *   Run the test multiple times, toggling these flags, and compare the outputs.
 *
 * Notes:
 * - This is a coarse probe (RSS sampling every 50ms). For deeper analysis, also try:
 *     node --cpu-prof --heap-prof ./node_modules/.bin/jest packages/code-analyzer-eslint-engine/test/perf-eslint.test.ts
 *   and inspect the generated profiles in Chrome DevTools.
 */
const RUN = process.env.ESLINT_ENGINE_PERF === 'true';
(RUN ? describe : describe.skip)('ESLint engine perf (one-off)', () => {
    it('measures describeRules wall time and peak RSS', async () => {
        const config: ESLintEngineConfig = {
            ...DEFAULT_CONFIG,
            // Toggle these to isolate costs:
            // disable_react_base_config: true,
            // disable_typescript_base_config: true,
            config_root: __dirname
        };

        // If a workspace path is provided (PERF_WS), analyze that project.
        // Optionally allow ESLint to auto-discover configs from that project (PERF_DISCOVER=true).
        const wsPath = process.env.PERF_WS;
        const ws: Workspace | undefined = wsPath ? new Workspace('perf', [wsPath]) : undefined;
        if (wsPath && process.env.PERF_DISCOVER === 'true') {
            (config as ESLintEngineConfig).auto_discover_eslint_config = true;
            (config as ESLintEngineConfig).config_root = wsPath;
        }

        // Create engine with the chosen config flags
        const engine: Engine = await new ESLintEnginePlugin().createEngine('eslint', config);

        // Track peak RSS during the measured operation with a light-weight sampler.
        const peak = { rss: 0 };
        const sampler = setInterval(() => {
            const m = process.memoryUsage();
            if (m.rss > peak.rss) peak.rss = m.rss;
        }, 50);

        // Measure wall time of describeRules (rule discovery).
        const mem0 = process.memoryUsage().rss;
        const t0 = performance.now();
        const rules: RuleDescription[] = await engine.describeRules(createDescribeOptions(ws));
        const t1 = performance.now();
        const mem1 = process.memoryUsage().rss;
        clearInterval(sampler);

        // eslint-disable-next-line no-console
        console.log(JSON.stringify({
            rule_count: rules.length,
            describe_ms: Math.round(t1 - t0),
            peak_rss_mb: Math.round(Math.max(peak.rss, mem0, mem1) / (1024 * 1024))
        }, null, 2));

        expect(rules.length).toBeGreaterThan(0);
    });
});

