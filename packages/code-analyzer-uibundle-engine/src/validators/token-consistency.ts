import { promises as fs } from "node:fs";
import * as path from "node:path";
import { TraceMap, eachMapping, sourceContentFor } from "@jridgewell/trace-mapping";
import { isAsset, isDependency, isVirtualSource, normalizeSourcePath, toPosixPath } from "./classification";
import { walk } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const TOKEN_CONSISTENCY_RULE = "token-consistency";

const SAMPLE_INTERVAL = 20;
const NAME_WINDOW_TOLERANCE = 3;
const VERDICT_SUSPICIOUS = 0.7;
const VERDICT_WARNING = 0.85;
const MAX_LISTED_MISMATCHES = 10;

export type TokenCategory =
    | "StringLiteral"
    | "NumericLiteral"
    | "Identifier"
    | "Punctuation"
    | "Other";

interface NameMismatch {
    expectedName: string;
    sourceFile: string;
    line: number; // 0-based
    col: number; // 0-based
    foundText: string;
}

export interface TokenConsistencyOptions {
    sourcePath: string;
    distPath: string;
}

export async function validateTokenConsistency(
    options: TokenConsistencyOptions,
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
        let compiledJs: string;
        try {
            compiledJs = await fs.readFile(jsPath, "utf8");
        } catch {
            return;
        }

        const report = analyzeTokenConsistency(tracer, compiledJs, sourceIndex);
        if (report.totalSampled === 0) return;

        if (report.consistencyScore < VERDICT_SUSPICIOUS) {
            findings.push({
                ruleName: TOKEN_CONSISTENCY_RULE,
                message: getMessage('TokenConsistencySuspicious', (report.consistencyScore * 100).toFixed(1), (VERDICT_SUSPICIOUS * 100).toString(), report.consistent, report.totalSampled),
                file: mapPath,
            });
        } else if (report.consistencyScore < VERDICT_WARNING) {
            findings.push({
                ruleName: TOKEN_CONSISTENCY_RULE,
                message: getMessage('TokenConsistencyBelowWarning', (report.consistencyScore * 100).toFixed(1), (VERDICT_WARNING * 100).toString(), report.consistent, report.totalSampled),
                file: mapPath,
            });
        }

        if (report.nameMismatches.length > 0) {
            findings.push({
                ruleName: TOKEN_CONSISTENCY_RULE,
                message: getMessage('TokenNameMismatchSummary', report.nameMismatches.length, NAME_WINDOW_TOLERANCE),
                file: mapPath,
            });
            for (const m of report.nameMismatches.slice(0, MAX_LISTED_MISMATCHES)) {
                findings.push({
                    ruleName: TOKEN_CONSISTENCY_RULE,
                    message: getMessage('TokenNameMismatchDetail', m.expectedName, m.sourceFile, m.line + 1, m.col + 1, m.foundText),
                    file: mapPath,
                });
            }
        }
    });

    return { findings };
}

export function analyzeTokenConsistency(
    tracer: TraceMap,
    compiledJs: string,
    sourceContents: Map<string, string>,
): {
    totalSampled: number;
    consistent: number;
    inconsistent: number;
    nameMismatches: NameMismatch[];
    consistencyScore: number;
} {
    const embeddedCache = new Map<string, string | null>();
    let totalSampled = 0;
    let consistent = 0;
    let inconsistent = 0;
    const nameMismatches: NameMismatch[] = [];

    let idx = -1;
    eachMapping(tracer, (m) => {
        idx++;
        if (idx % SAMPLE_INTERVAL !== 0) return;
        if (m.source == null || m.originalLine == null || m.originalColumn == null) return;

        const srcRaw = m.source;
        const normalized = normalizeSourcePath(srcRaw);

        // Skip third-party deps, static assets, and virtual bundler pseudo-sources.
        if (isDependency(normalized) || isAsset(normalized) || isVirtualSource(normalized)) return;

        let sourceText = sourceContents.get(normalized) ?? null;
        if (sourceText == null) {
            if (embeddedCache.has(srcRaw)) {
                sourceText = embeddedCache.get(srcRaw) ?? null;
            } else {
                try {
                    const c = sourceContentFor(tracer, srcRaw);
                    embeddedCache.set(srcRaw, c);
                    sourceText = c;
                } catch {
                    embeddedCache.set(srcRaw, null);
                }
            }
        }
        if (sourceText == null) return;

        totalSampled++;

        const srcLine = m.originalLine - 1;
        const srcCol = m.originalColumn;
        const dstLine = m.generatedLine - 1;
        const dstCol = m.generatedColumn;

        if (m.name != null) {
            const [found, foundText] = nameExistsNear(sourceText, srcLine, srcCol, m.name);
            if (!found) {
                nameMismatches.push({
                    expectedName: m.name,
                    sourceFile: normalized,
                    line: srcLine,
                    col: srcCol,
                    foundText,
                });
            }
        }

        const genCat = classifyTokenAt(compiledJs, dstLine, dstCol);
        const srcCat = classifyTokenAt(sourceText, srcLine, srcCol);
        if (categoriesAreConsistent(genCat, srcCat)) {
            consistent++;
        } else {
            inconsistent++;
        }
    });

    const consistencyScore = totalSampled > 0 ? consistent / totalSampled : 1.0;

    return { totalSampled, consistent, inconsistent, nameMismatches, consistencyScore };
}

export function classifyTokenAt(text: string, line0: number, col0: number): TokenCategory {
    const lines = text.split("\n");
    if (line0 >= lines.length) return "Other";
    const lineText = lines[line0]!;
    if (col0 >= lineText.length) return "Other";
    const ch = lineText.charAt(col0);
    if (ch === '"' || ch === "'" || ch === "`") return "StringLiteral";
    if (ch >= "0" && ch <= "9") return "NumericLiteral";
    if (/[A-Za-z_$]/.test(ch)) return "Identifier";
    if (/\s/.test(ch)) return "Other";
    return "Punctuation";
}

function categoriesAreConsistent(gen: TokenCategory, src: TokenCategory): boolean {
    if (gen === src) return true;
    if (gen === "Other" || src === "Other") return true;
    if (
        (gen === "NumericLiteral" && src === "Identifier") ||
        (gen === "Identifier" && src === "NumericLiteral")
    )
        return true;
    return false;
}

function nameExistsNear(
    source: string,
    line0: number,
    col0: number,
    expected: string,
): [boolean, string] {
    const lines = source.split("\n");
    if (line0 >= lines.length) return [false, ""];
    const lineText = lines[line0]!;

    for (let offset = 0; offset <= NAME_WINDOW_TOLERANCE; offset++) {
        for (const dir of [1, -1]) {
            const checkCol = offset === 0 ? col0 : col0 + offset * dir;
            if (checkCol < 0) continue;
            const word = extractWordAt(lineText, checkCol, expected.length + 5);
            if (word === expected) return [true, word];
            if (offset === 0) break; // Only check offset=0 once
        }
    }

    const found = extractWordAt(lineText, col0, expected.length + 10);
    return [false, found];
}

function extractWordAt(line: string, col: number, maxLen: number): string {
    if (col >= line.length) return "";
    let out = "";
    const end = Math.min(line.length, col + maxLen);
    for (let i = col; i < end; i++) {
        const c = line.charAt(i);
        if (/[A-Za-z0-9_$]/.test(c)) out += c;
        else break;
    }
    return out;
}

const INDEX_IGNORE_PREFIXES = ["node_modules", ".git", "dist"];

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
