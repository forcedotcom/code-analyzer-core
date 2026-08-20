import { promises as fs } from "node:fs";
import { TraceMap, eachMapping } from "@jridgewell/trace-mapping";
import { walk } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const COVERAGE_ANALYSIS_RULE = "coverage-analysis";

const UNMAPPED_THRESHOLD = 50;
const EXCESSIVE_UNMAPPED_PCT = 5.0;
const LINE1_EXEMPT_CHARS = 2000;
// "Dense minified line" = a line long enough that a mapping-per-token minifier output
// produces ambient gaps that are not tamper signal. On such lines, we require a much
// larger gap to consider it an unmapped region. AST-level dangerous-pattern detection
// in source-content-verification catches smaller injections regardless of this threshold.
const DENSE_LINE_MIN_LENGTH = 5000;
const DENSE_LINE_UNMAPPED_THRESHOLD = 2000;
// Cap per-file region emissions — reviewers only need the largest few. The count is
// still surfaced via the cumulative-budget finding when it fires. Guarantees that the
// biggest stealth injection is always visible even on files with many ambient regions.
const MAX_REGIONS_EMITTED_PER_FILE = 5;

interface UnmappedRegion {
    line: number;
    startCol: number;
    endCol: number;
    length: number;
}

export async function validateCoverageAnalysis(distPath: string): Promise<ValidatorResult> {
    let distStat;
    try {
        distStat = await fs.stat(distPath);
    } catch {
        return { findings: [], skipped: { reason: `dist path not found: ${distPath}` } };
    }
    if (!distStat.isDirectory()) {
        return { findings: [], skipped: { reason: `dist path is not a directory: ${distPath}` } };
    }

    const findings: ValidatorFinding[] = [];

    await walk(distPath, async (jsPath) => {
        if (!jsPath.endsWith(".js")) return;
        const mapPath = `${jsPath}.map`;
        let mapRaw: string;
        try {
            mapRaw = await fs.readFile(mapPath, "utf8");
        } catch {
            return;
        }
        let tracer: TraceMap;
        try {
            tracer = new TraceMap(mapRaw);
        } catch {
            return;
        }
        let compiledJs: string;
        try {
            compiledJs = await fs.readFile(jsPath, "utf8");
        } catch {
            return;
        }

        const report = analyzeCoverage(tracer, compiledJs);

        const regionsBySize = [...report.unmappedRegions].sort((a, b) => b.length - a.length);
        for (const region of regionsBySize.slice(0, MAX_REGIONS_EMITTED_PER_FILE)) {
            findings.push({
                ruleName: COVERAGE_ANALYSIS_RULE,
                message: getMessage('CoverageUnmappedRegion', region.line, region.startCol, region.endCol, region.length),
                file: jsPath,
                startLine: region.line,
                startColumn: region.startCol + 1,
            });
        }

        if (report.excessiveUnmapped) {
            findings.push({
                ruleName: COVERAGE_ANALYSIS_RULE,
                message: getMessage('CoverageExcessiveCumulative', report.unmappedCountedPct.toFixed(2), report.totalChars, EXCESSIVE_UNMAPPED_PCT.toString()),
                file: jsPath,
            });
        }
    });

    return { findings };
}

export function analyzeCoverage(
    tracer: TraceMap,
    compiledJs: string,
): {
    totalChars: number;
    mappedChars: number;
    coveragePct: number;
    unmappedRegions: UnmappedRegion[];
    excessiveUnmapped: boolean;
    unmappedCountedPct: number;
} {
    const lines = compiledJs.split("\n");
    const lineCount = lines.length;

    const lineCols: number[][] = Array.from({ length: lineCount }, () => []);
    eachMapping(tracer, (m) => {
        const dstLine = m.generatedLine - 1;
        if (dstLine >= 0 && dstLine < lineCount) {
            lineCols[dstLine]!.push(m.generatedColumn);
        }
    });
    for (const cols of lineCols) {
        cols.sort((a, b) => a - b);
        let write = 0;
        for (const col of cols) {
            if (write === 0 || col !== cols[write - 1]) {
                cols[write++] = col;
            }
        }
        cols.length = write;
    }

    let totalChars = 0;
    let mappedChars = 0;
    const unmappedRegions: UnmappedRegion[] = [];
    // Sub-threshold uncovered chars that are too small to be flagged as their own region
    // on a dense line (i.e. between UNMAPPED_THRESHOLD and DENSE_LINE_UNMAPPED_THRESHOLD)
    // still count toward the cumulative-budget signal so many small gaps don't slip past.
    // Contributions are banner-adjusted at insertion — line-1 chars within LINE1_EXEMPT_CHARS
    // are discounted so a small preamble gap costs the same as a large one (i.e. zero).
    let subThresholdCounted = 0;

    const addSubThreshold = (lineIdx: number, startCol: number, endCol: number) => {
        if (lineIdx === 0) {
            const countableStart = Math.max(startCol, LINE1_EXEMPT_CHARS);
            if (endCol > countableStart) {
                subThresholdCounted += endCol - countableStart;
            }
        } else {
            subThresholdCounted += endCol - startCol;
        }
    };

    for (let i = 0; i < lineCount; i++) {
        const lineText = lines[i]!;
        const lineLen = lineText.length;
        totalChars += lineLen;
        if (lineLen === 0) continue;

        // Dense minified lines (like the single line of a Vite/webpack production bundle)
        // produce hundreds of small mapping gaps that are structural, not tamper signal.
        // Raise the per-region threshold on such lines so only substantial gaps count.
        // AST-level checks (source-content-verification) still catch small injections.
        const regionThreshold =
            lineLen >= DENSE_LINE_MIN_LENGTH ? DENSE_LINE_UNMAPPED_THRESHOLD : UNMAPPED_THRESHOLD;
        const isDense = lineLen >= DENSE_LINE_MIN_LENGTH;

        const cols = lineCols[i]!;
        if (cols.length === 0) {
            if (lineLen >= regionThreshold) {
                unmappedRegions.push({ line: i + 1, startCol: 0, endCol: lineLen, length: lineLen });
            } else if (isDense && lineLen >= UNMAPPED_THRESHOLD) {
                addSubThreshold(i, 0, lineLen);
            }
            continue;
        }

        // Each mapping covers characters until the NEXT mapping — but only up to
        // UNMAPPED_THRESHOLD chars, so a single mapping cannot silently credit an
        // arbitrarily long minified tail. Gaps between consecutive mappings that
        // exceed the threshold are recorded as unmapped regions.
        let prevBoundary = 0;
        for (let k = 0; k <= cols.length; k++) {
            const boundary = k < cols.length ? cols[k]! : lineLen;
            const gap = boundary - prevBoundary;
            if (k === 0) {
                if (gap >= regionThreshold) {
                    unmappedRegions.push({
                        line: i + 1,
                        startCol: prevBoundary,
                        endCol: boundary,
                        length: gap,
                    });
                } else if (isDense && gap >= UNMAPPED_THRESHOLD) {
                    addSubThreshold(i, prevBoundary, boundary);
                }
            } else {
                const covered = Math.min(gap, UNMAPPED_THRESHOLD);
                mappedChars += covered;
                const uncovered = gap - covered;
                if (uncovered >= regionThreshold) {
                    unmappedRegions.push({
                        line: i + 1,
                        startCol: prevBoundary + covered,
                        endCol: boundary,
                        length: uncovered,
                    });
                } else if (isDense && uncovered >= UNMAPPED_THRESHOLD) {
                    addSubThreshold(i, prevBoundary + covered, boundary);
                }
            }
            prevBoundary = boundary;
        }
    }

    const coveragePct = totalChars > 0 ? (mappedChars / totalChars) * 100 : 100;

    let totalUnmappedCounted = subThresholdCounted;
    for (const region of unmappedRegions) {
        if (region.line === 1) {
            if (region.endCol > LINE1_EXEMPT_CHARS) {
                const countableStart = Math.max(region.startCol, LINE1_EXEMPT_CHARS);
                totalUnmappedCounted += region.endCol - countableStart;
            }
        } else {
            totalUnmappedCounted += region.length;
        }
    }

    const unmappedCountedPct = totalChars > 0 ? (totalUnmappedCounted / totalChars) * 100 : 0;
    const excessiveUnmapped = unmappedCountedPct > EXCESSIVE_UNMAPPED_PCT;

    return {
        totalChars,
        mappedChars,
        coveragePct,
        unmappedRegions,
        excessiveUnmapped,
        unmappedCountedPct,
    };
}
