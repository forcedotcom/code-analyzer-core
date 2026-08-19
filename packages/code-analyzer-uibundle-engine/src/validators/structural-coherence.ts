import { promises as fs } from "node:fs";
import { TraceMap, eachMapping, sourceContentFor } from "@jridgewell/trace-mapping";
import { isAsset, isDependency, normalizeSourcePath } from "./classification";
import { buildSourceIndex, walk, type SourceIndex } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const STRUCTURAL_COHERENCE_RULE = "structural-coherence";

const WHITESPACE_SAMPLE_INTERVAL = 10;
const WHITESPACE_SUSPICION_THRESHOLD = 0.8;
const JUMP_RATIO_WARN = 0.5;
const MAX_LISTED_BOUNDS = 10;

interface BoundsViolation {
    sourceFile: string;
    claimedLine: number;
    claimedCol: number;
    actualLines: number;
}

export interface StructuralCoherenceOptions {
    sourcePath: string;
    distPath: string;
    sourceIndex?: SourceIndex;
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

    const sourceIndex = options.sourceIndex ?? await buildSourceIndex(options.sourcePath);
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
    const submittedLines = new Map<string, string[]>();
    for (const [key, content] of sourceContents) {
        submittedLines.set(key, content.split("\n"));
    }

    const embeddedLines = new Map<string, string[]>();

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

        let lines = submittedLines.get(normalized);
        if (!lines) {
            lines = embeddedLines.get(srcRaw);
            if (!lines) {
                try {
                    const contents = sourceContentFor(tracer, srcRaw);
                    if (contents != null) {
                        lines = contents.split("\n");
                        embeddedLines.set(srcRaw, lines);
                    }
                } catch {
                    // skip
                }
            }
            if (!lines) return;
        }

        totalMappingsChecked++;

        const actualLines = lines.length;
        if (srcLine >= actualLines) {
            boundsViolations.push({
                sourceFile: normalized,
                claimedLine: srcLine,
                claimedCol: srcCol,
                actualLines,
            });
        } else {
            const lineLen = lines[srcLine]!.length;
            if (srcCol > lineLen) {
                boundsViolations.push({
                    sourceFile: normalized,
                    claimedLine: srcLine,
                    claimedCol: srcCol,
                    actualLines,
                });
            }
        }

        if (sampleIndex % WHITESPACE_SAMPLE_INTERVAL === 0 && srcLine < actualLines) {
            whitespaceSampleCount++;
            if (pointsToWhitespaceOrCommentInLines(lines, srcLine, srcCol)) {
                whitespaceOnlyMappings++;
            }
        }
        sampleIndex++;

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
    return pointsToWhitespaceOrCommentInLines(source.split("\n"), line0, col0);
}

function pointsToWhitespaceOrCommentInLines(lines: string[], line0: number, col0: number): boolean {
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

