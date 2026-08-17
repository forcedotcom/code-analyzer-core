import { promises as fs } from "node:fs";
import { TraceMap, eachMapping } from "@jridgewell/trace-mapping";
import { walk } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const COVERAGE_ANALYSIS_RULE = "coverage-analysis";

const UNMAPPED_THRESHOLD = 50;
const EXCESSIVE_UNMAPPED_PCT = 2.0;
const LINE1_EXEMPT_CHARS = 150;

interface UnmappedRegion {
    line: number; // 1-based for display
    startCol: number;
    endCol: number;
    length: number;
}

/**
 * Char-level coverage analysis (informational). For each compiled JS line,
 * groups all mapped destination columns; anything before the first mapped
 * column that exceeds UNMAPPED_THRESHOLD chars is flagged as an unmapped
 * region. Total unmapped chars (line-1 preamble discounted) above
 * EXCESSIVE_UNMAPPED_PCT of file size raises a cumulative-budget finding.
 */
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
            return; // missing-sourcemap handles this
        }
        let tracer: TraceMap;
        try {
            tracer = new TraceMap(mapRaw);
        } catch {
            return; // vlq-integrity handles this
        }
        let compiledJs: string;
        try {
            compiledJs = await fs.readFile(jsPath, "utf8");
        } catch {
            return;
        }

        const report = analyzeCoverage(tracer, compiledJs);

        for (const region of report.unmappedRegions) {
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

    // Group destination columns by 0-based line index.
    const lineCols: number[][] = Array.from({ length: lineCount }, () => []);
    eachMapping(tracer, (m) => {
        // eachMapping yields 1-based lines; convert to 0-based.
        const dstLine = m.generatedLine - 1;
        if (dstLine >= 0 && dstLine < lineCount) {
            lineCols[dstLine]!.push(m.generatedColumn);
        }
    });
    for (const cols of lineCols) {
        cols.sort((a, b) => a - b);
        // Dedup in place
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

    for (let i = 0; i < lineCount; i++) {
        const lineText = lines[i]!;
        const lineLen = lineText.length;
        totalChars += lineLen;
        if (lineLen === 0) continue;

        const cols = lineCols[i]!;
        if (cols.length === 0) {
            if (lineLen >= UNMAPPED_THRESHOLD) {
                unmappedRegions.push({ line: i + 1, startCol: 0, endCol: lineLen, length: lineLen });
            }
            continue;
        }

        const firstCol = cols[0]!;
        if (firstCol > 0 && firstCol >= UNMAPPED_THRESHOLD) {
            unmappedRegions.push({ line: i + 1, startCol: 0, endCol: firstCol, length: firstCol });
        }
        mappedChars += lineLen - firstCol;
    }

    const coveragePct = totalChars > 0 ? (mappedChars / totalChars) * 100 : 100;

    let totalUnmappedCounted = 0;
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
