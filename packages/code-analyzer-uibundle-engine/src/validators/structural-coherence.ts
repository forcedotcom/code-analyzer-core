import { promises as fs } from "node:fs";
import * as path from "node:path";
import { TraceMap, eachMapping, sourceContentFor } from "@jridgewell/trace-mapping";
import { isAsset, isDependency, normalizeSourcePath, toPosixPath } from "./classification";
import { walk } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const STRUCTURAL_COHERENCE_RULE = "structural-coherence";

const WHITESPACE_SAMPLE_INTERVAL = 10;
const WHITESPACE_SUSPICION_THRESHOLD = 0.8;
const JUMP_RATIO_WARN = 0.5;
const MAX_LISTED_BOUNDS = 10;

interface BoundsViolation {
    sourceFile: string;
    claimedLine: number; // 0-based
    claimedCol: number; // 0-based
    actualLines: number;
}

export interface StructuralCoherenceOptions {
    sourcePath: string;
    distPath: string;
}

export async function validateStructuralCoherence(
    options: StructuralCoherenceOptions,
): Promise<ValidatorResult> {
    let sourceStat, distStat;
    try {
        sourceStat = await fs.stat(options.sourcePath);
    } catch {
        return { findings: [], skipped: { reason: `source path not found: ${options.sourcePath}` } };
    }
    try {
        distStat = await fs.stat(options.distPath);
    } catch {
        return { findings: [], skipped: { reason: `dist path not found: ${options.distPath}` } };
    }
    if (!sourceStat.isDirectory() || !distStat.isDirectory()) {
        return { findings: [], skipped: { reason: "source and dist must both be directories" } };
    }

    const rawIndex = await indexSourceFiles(options.sourcePath);
    const sourceIndex = expandIndexWithBase(rawIndex, path.basename(options.sourcePath));
    const findings: ValidatorFinding[] = [];

    await walk(options.distPath, async (jsPath) => {
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

        const report = analyzeCoherence(tracer, sourceIndex);

        if (report.totalMappingsChecked === 0) return;

        // Bounds violations
        if (report.boundsViolations.length > 0) {
            findings.push({
                ruleName: STRUCTURAL_COHERENCE_RULE,
                message: getMessage('CoherenceBoundsSummary', report.boundsViolations.length),
                file: mapPath,
            });
            for (const v of report.boundsViolations.slice(0, MAX_LISTED_BOUNDS)) {
                findings.push({
                    ruleName: STRUCTURAL_COHERENCE_RULE,
                    message: getMessage('CoherenceBoundsDetail', v.sourceFile, v.claimedLine + 1, v.claimedCol + 1, v.actualLines),
                    file: mapPath,
                });
            }
        }

        // Whitespace/comment sampling — denominator is the actual number of
        // sample fires so the ratio can never exceed 1.0.
        if (report.whitespaceSampleCount > 0) {
            const wsRatio = report.whitespaceOnlyMappings / report.whitespaceSampleCount;
            if (wsRatio > WHITESPACE_SUSPICION_THRESHOLD) {
                findings.push({
                    ruleName: STRUCTURAL_COHERENCE_RULE,
                    message: getMessage('CoherenceWhitespaceSuspicious', (wsRatio * 100).toFixed(1), report.whitespaceOnlyMappings, report.whitespaceSampleCount, (WHITESPACE_SUSPICION_THRESHOLD * 100).toString()),
                    file: mapPath,
                });
            }
        }

        // Cross-file jump ratio
        if (report.suspiciousJumpRatio > JUMP_RATIO_WARN) {
            findings.push({
                ruleName: STRUCTURAL_COHERENCE_RULE,
                message: getMessage('CoherenceCrossFileJumpsSuspicious', report.suspiciousJumpRatio.toFixed(2), JUMP_RATIO_WARN.toString()),
                file: mapPath,
            });
        }
    });

    return { findings };
}

export function analyzeCoherence(
    tracer: TraceMap,
    sourceContents: Map<string, string>,
): {
    totalMappingsChecked: number;
    boundsViolations: BoundsViolation[];
    whitespaceOnlyMappings: number;
    whitespaceSampleCount: number;
    suspiciousJumpRatio: number;
} {
    const submittedLineLens = new Map<string, number[]>();
    for (const [key, content] of sourceContents) {
        submittedLineLens.set(
            key,
            content.split("\n").map((l) => l.length),
        );
    }

    const embeddedLineLens = new Map<string, number[]>();
    const embeddedText = new Map<string, string>();

    let totalMappingsChecked = 0;
    const boundsViolations: BoundsViolation[] = [];
    let whitespaceOnlyMappings = 0;
    let whitespaceSampleCount = 0;

    let prevSource: string | null = null;
    let prevDstLine: number | null = null;
    let consecutivePairs = 0;
    let crossFileJumps = 0;
    let sampleIndex = 0;

    eachMapping(tracer, (m) => {
        if (m.source == null || m.originalLine == null || m.originalColumn == null) return;
        const srcRaw = m.source;
        const normalized = normalizeSourcePath(srcRaw);

        if (isAsset(normalized) || isDependency(normalized)) return;

        const srcLine = m.originalLine - 1;
        const srcCol = m.originalColumn;
        const dstLine = m.generatedLine - 1;

        let lineLens = submittedLineLens.get(normalized);
        if (!lineLens) {
            let cached = embeddedLineLens.get(srcRaw);
            if (!cached) {
                try {
                    const contents = sourceContentFor(tracer, srcRaw);
                    if (contents != null) {
                        cached = contents.split("\n").map((l) => l.length);
                        embeddedLineLens.set(srcRaw, cached);
                        embeddedText.set(srcRaw, contents);
                    }
                } catch {
                    // ignore
                }
            }
            if (!cached) return;
            lineLens = cached;
        }

        totalMappingsChecked++;

        // --- Check 1: bounds ---
        const actualLines = lineLens.length;
        if (srcLine >= actualLines) {
            boundsViolations.push({
                sourceFile: normalized,
                claimedLine: srcLine,
                claimedCol: srcCol,
                actualLines,
            });
        } else {
            const lineLen = lineLens[srcLine]!;
            if (srcCol > lineLen) {
                boundsViolations.push({
                    sourceFile: normalized,
                    claimedLine: srcLine,
                    claimedCol: srcCol,
                    actualLines,
                });
            }
        }

        // --- Check 2: whitespace/comment sampling (every 10th mapping) ---
        if (sampleIndex % WHITESPACE_SAMPLE_INTERVAL === 0 && srcLine < actualLines) {
            whitespaceSampleCount++;
            const sourceText = sourceContents.get(normalized) ?? embeddedText.get(srcRaw) ?? null;
            if (sourceText != null && pointsToWhitespaceOrComment(sourceText, srcLine, srcCol)) {
                whitespaceOnlyMappings++;
            }
        }
        sampleIndex++;

        // --- Check 3: cross-file jump ratio (consecutive tokens on same dst line) ---
        if (prevDstLine !== null && dstLine === prevDstLine) {
            if (prevSource !== null) {
                consecutivePairs++;
                if (prevSource !== srcRaw) crossFileJumps++;
            }
        }
        prevSource = srcRaw;
        prevDstLine = dstLine;
    });

    const suspiciousJumpRatio = consecutivePairs > 0 ? crossFileJumps / consecutivePairs : 0;

    return {
        totalMappingsChecked,
        boundsViolations,
        whitespaceOnlyMappings,
        whitespaceSampleCount,
        suspiciousJumpRatio,
    };
}

export function pointsToWhitespaceOrComment(source: string, line0: number, col0: number): boolean {
    const lines = source.split("\n");
    if (line0 >= lines.length) return false;
    const lineText = lines[line0]!;
    if (col0 >= lineText.length) return true;

    const fromCol = lineText.slice(col0);
    const trimmed = fromCol.replace(/^[\s]+/, "");
    if (trimmed.length === 0) return true;
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return true;

    const lineTrimmed = lineText.trim();
    if (
        lineTrimmed.startsWith("//") ||
        lineTrimmed.startsWith("/*") ||
        lineTrimmed.startsWith("*") ||
        lineTrimmed.endsWith("*/")
    )
        return true;

    return false;
}

const INDEX_IGNORE_PREFIXES = ["node_modules", ".git", "dist"];

/**
 * Add `<sourcePathBase>/<rel>` aliases so `sources[]` entries like
 * `../src/foo.ts` (which normalize to `src/foo.ts`) find the file even
 * though the on-disk index is keyed by the path relative to `src/`.
 */
function expandIndexWithBase(index: Map<string, string>, base: string): Map<string, string> {
    const out = new Map(index);
    for (const [rel, content] of index) {
        out.set(`${base}/${rel}`, content);
    }
    return out;
}

async function indexSourceFiles(sourcePath: string): Promise<Map<string, string>> {
    const index = new Map<string, string>();
    await walk(sourcePath, async (abs) => {
        const rel = toPosixPath(path.relative(sourcePath, abs));
        if (INDEX_IGNORE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return;
        try {
            const content = await fs.readFile(abs, "utf8");
            index.set(rel, content);
        } catch {
            // binary or unreadable — skip
        }
    });
    return index;
}
