import { promises as fs } from "node:fs";
import { parse, type ParserOptions } from "@babel/parser";
import _traverse, { type NodePath } from "@babel/traverse";
import type { Node } from "@babel/types";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import {
    containsDangerousPattern,
    isAsset,
    isCompiledJs,
    isDependency,
    isVirtualSource,
    normalizeLineEndings,
    normalizeSourcePath,
} from "./classification";
import { buildSourceIndex, walk, type SourceIndex } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

// ESM/CJS interop for @babel/traverse
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

export const SOURCE_CONTENT_VERIFICATION_RULE = "source-content-verification";

const COVERAGE_THRESHOLD_LARGE = 95;
const COVERAGE_THRESHOLD_SMALL = 70;
const SMALL_FILE_NODE_COUNT = 500;
const TYPE_MISMATCH_THRESHOLD = 0.2;
const AST_MATCH_TOLERANCE_BYTES = 5;

const VIRTUAL_SOURCE_RATIO_THRESHOLD_PCT = 20;
// Vite/webpack minified bundles put everything on line 1; a small preamble at the start
// of that line is bundler runtime with no mapping. Beyond this column, unmapped
// dangerous-pattern nodes on line 1 are treated the same as line-2+. Aligned with
// coverage-analysis's LINE1_EXEMPT_CHARS so a stealth injection cannot hide in the
// gap between the two rules' exemption windows.
const LINE1_BANNER_EXEMPT_CHARS = 2000;

const PARSER_OPTIONS: ParserOptions = {
    sourceType: "unambiguous",
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    errorRecovery: true,
    plugins: ["jsx", "typescript", "decorators-legacy"],
};

const SIGNIFICANT_NODE_TYPES = new Set<string>([
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "ClassDeclaration",
    "ClassExpression",
    "ClassMethod",
    "ClassProperty",
    "JSXElement",
    "JSXFragment",
    "CallExpression",
    "NewExpression",
    "MemberExpression",
    "OptionalMemberExpression",
    "AssignmentExpression",
    "VariableDeclaration",
    "ImportDeclaration",
    "ExportNamedDeclaration",
    "ExportDefaultDeclaration",
    "ExportAllDeclaration",
    "ReturnStatement",
    "ThrowStatement",
    "AwaitExpression",
    "YieldExpression",
]);

export function normalizeNodeType(t: string): string {
    if (
        t === "ExportNamedDeclaration" ||
        t === "ExportDefaultDeclaration" ||
        t === "ExportAllDeclaration"
    ) {
        return "ExportDeclaration";
    }
    return t;
}

interface SignificantNode {
    type: string;
    line: number;
    column: number;
    byteOffset: number;
    snippet: string;
}

export interface SourceContentOptions {
    sourcePath: string;
    distPath: string;
    sourceIndex?: SourceIndex;
}

export async function validateSourceContent(
    options: SourceContentOptions,
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
        if (!isCompiledJs(jsPath)) return;
        const mapPath = `${jsPath}.map`;
        let mapRaw: string;
        try {
            mapRaw = await fs.readFile(mapPath, "utf8");
        } catch {
            return;
        }

        let rawMap: RawSourceMap;
        try {
            rawMap = JSON.parse(mapRaw);
        } catch (err) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentSourcemapNotJson', (err as Error).message),
                file: mapPath,
            });
            return;
        }

        let tracer: TraceMap;
        try {
            tracer = new TraceMap(mapRaw);
        } catch (err) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentSourcemapUnloadable', (err as Error).message),
                file: mapPath,
            });
            return;
        }

        await runByteEqualAndRatioChecks(rawMap, mapPath, sourceIndex, findings);

        let compiledJs: string;
        try {
            compiledJs = await fs.readFile(jsPath, "utf8");
        } catch {
            return;
        }
        await runAstChecks(jsPath, mapPath, compiledJs, tracer, sourceIndex, findings);
    });

    return { findings };
}

interface RawSourceMap {
    version?: number;
    sources?: (string | null)[];
    sourcesContent?: (string | null)[];
    sourceRoot?: string;
}

async function runByteEqualAndRatioChecks(
    map: RawSourceMap,
    mapPath: string,
    sourceIndex: SourceIndex,
    findings: ValidatorFinding[],
): Promise<void> {
    const sources = map.sources ?? [];
    if (sources.length === 0) return;

    let virtualCount = 0;
    let total = 0;

    for (let i = 0; i < sources.length; i++) {
        const raw = sources[i];
        if (raw == null) continue;
        total++;
        const normalized = normalizeSourcePath(raw);

        if (isVirtualSource(normalized)) {
            virtualCount++;
            continue;
        }
        if (isDependency(normalized) || isAsset(normalized)) {
            continue;
        }

        const submitted = sourceIndex.get(normalized);
        const embedded = map.sourcesContent?.[i] ?? null;

        if (submitted == null) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentReferencesUnknownSource', raw, normalized),
                file: mapPath,
            });
            continue;
        }

        if (embedded == null) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentMissingInline', normalized),
                file: mapPath,
            });
            continue;
        }

        if (normalizeLineEndings(embedded).trim() !== normalizeLineEndings(submitted).trim()) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentBytewiseMismatch', normalized),
                file: mapPath,
            });
        }
    }

    if (total > 0) {
        const virtualPct = (virtualCount / total) * 100;
        if (virtualPct > VIRTUAL_SOURCE_RATIO_THRESHOLD_PCT) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentExcessiveVirtualSources', virtualPct.toFixed(0), total, VIRTUAL_SOURCE_RATIO_THRESHOLD_PCT),
                file: mapPath,
            });
        }
    }
}

async function runAstChecks(
    jsPath: string,
    _mapPath: string,
    compiledJs: string,
    tracer: TraceMap,
    sourceIndex: SourceIndex,
    findings: ValidatorFinding[],
): Promise<void> {
    let significantNodes: SignificantNode[];
    try {
        significantNodes = collectSignificantNodes(compiledJs);
    } catch (err) {
        findings.push({
            ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
            message: getMessage('SourceContentCompiledParseFailed', (err as Error).message),
            file: jsPath,
        });
        return;
    }
    if (significantNodes.length === 0) return;

    const sourceAstCache = new Map<string, SourceAst | null>();

    let mappedCount = 0;
    let typeMismatchCount = 0;
    const unmapped: SignificantNode[] = [];
    const typeMismatches: string[] = [];
    const orphanSources = new Set<string>();

    for (const node of significantNodes) {
        const orig = originalPositionFor(tracer, { line: node.line, column: node.column });
        if (orig.source == null || orig.line == null) {
            unmapped.push(node);
            continue;
        }
        mappedCount++;

        const normalized = normalizeSourcePath(orig.source);

        if (isVirtualSource(normalized) || isDependency(normalized) || isAsset(normalized)) continue;

        const submittedContent = sourceIndex.get(normalized);
        if (submittedContent == null) {
            orphanSources.add(normalized);
            continue;
        }

        const sourceAst = getSourceAst(normalized, submittedContent, sourceAstCache);
        if (!sourceAst) continue;
        const srcByteOffset = lineColToByteOffset(sourceAst.lineOffsets, orig.line, orig.column ?? 0);
        const srcNode = findNodeAtOffset(sourceAst.nodes, srcByteOffset);
        if (srcNode && !nodeTypesCompatible(node.type, srcNode.type)) {
            typeMismatchCount++;
            if (typeMismatches.length < 5) {
                typeMismatches.push(
                    `${node.type} at ${node.line}:${node.column} → ${srcNode.type} at ${normalized}:${orig.line}:${orig.column ?? 0}`,
                );
            }
        }
    }

    const total = significantNodes.length;
    const coverage = (mappedCount / total) * 100;
    const threshold =
        total >= SMALL_FILE_NODE_COUNT ? COVERAGE_THRESHOLD_LARGE : COVERAGE_THRESHOLD_SMALL;
    const typeMismatchRatio = mappedCount > 0 ? typeMismatchCount / mappedCount : 0;

    if (coverage < threshold) {
        findings.push({
            ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
            message: getMessage('SourceContentCoverageBelowThreshold', coverage.toFixed(1), threshold, mappedCount, total),
            file: jsPath,
        });
        for (const node of unmapped.slice(0, 5)) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentUnmappedNode', node.type, node.line, node.column, truncate(node.snippet, 80)),
                file: jsPath,
                startLine: node.line,
                startColumn: node.column + 1,
            });
        }
    }

    if (typeMismatchRatio >= TYPE_MISMATCH_THRESHOLD) {
        findings.push({
            ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
            message: getMessage('SourceContentTypeMismatchRatio', (typeMismatchRatio * 100).toFixed(1), (TYPE_MISMATCH_THRESHOLD * 100).toString(), typeMismatchCount, mappedCount),
            file: jsPath,
        });
        for (const mm of typeMismatches) {
            findings.push({
                ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
                message: getMessage('SourceContentTypeMismatchDetail', mm),
                file: jsPath,
            });
        }
    }

    const dangerousUnmapped = unmapped.filter(
        (n) => (n.line > 1 || n.column >= LINE1_BANNER_EXEMPT_CHARS) && containsDangerousPattern(n.snippet),
    );
    for (const n of dangerousUnmapped.slice(0, 10)) {
        findings.push({
            ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
            message: getMessage('SourceContentDangerousUnmapped', n.type, n.line, n.column, truncate(n.snippet, 100)),
            file: jsPath,
            startLine: n.line,
            startColumn: n.column + 1,
        });
    }

    if (orphanSources.size > 0) {
        const listed = [...orphanSources].slice(0, 5).join(", ") + (orphanSources.size > 5 ? ", …" : "");
        findings.push({
            ruleName: SOURCE_CONTENT_VERIFICATION_RULE,
            message: getMessage('SourceContentOrphanSources', orphanSources.size, listed),
            file: jsPath,
        });
    }
}

function collectSignificantNodes(code: string): SignificantNode[] {
    const ast = parse(code, PARSER_OPTIONS);
    const out: SignificantNode[] = [];
    traverse(ast, {
        enter(nodePath: NodePath<Node>) {
            const node = nodePath.node;
            if (!SIGNIFICANT_NODE_TYPES.has(node.type)) return;
            if (!node.loc) return;
            const start = node.loc.start;
            const byteOffset = node.start ?? 0;
            const snippet = extractSnippet(code, byteOffset, 60);
            out.push({
                type: normalizeNodeType(node.type),
                line: start.line,
                column: start.column,
                byteOffset,
                snippet,
            });
        },
    });
    return out;
}

interface SourceAst {
    nodes: SignificantNode[];
    lineOffsets: number[];
}

function getSourceAst(
    normalized: string,
    content: string,
    cache: Map<string, SourceAst | null>,
): SourceAst | null {
    if (cache.has(normalized)) return cache.get(normalized) ?? null;
    try {
        const nodes = collectSignificantNodes(content);
        const lineOffsets = buildLineOffsets(content);
        const val: SourceAst = { nodes, lineOffsets };
        cache.set(normalized, val);
        return val;
    } catch {
        cache.set(normalized, null);
        return null;
    }
}

function buildLineOffsets(text: string): number[] {
    const offsets: number[] = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10 /* \n */) offsets.push(i + 1);
    }
    return offsets;
}

function lineColToByteOffset(lineOffsets: number[], line1: number, col0: number): number {
    const line = Math.max(0, line1 - 1);
    if (line < lineOffsets.length) return lineOffsets[line]! + col0;
    return (lineOffsets[lineOffsets.length - 1] ?? 0) + col0;
}

function findNodeAtOffset(nodes: SignificantNode[], byteOffset: number): SignificantNode | null {
    const tol = AST_MATCH_TOLERANCE_BYTES;
    // Nodes are produced by babel traversal in document order — byteOffset is non-decreasing.
    // Binary-search the first node with byteOffset >= (target - tol), then linearly scan the
    // tolerance window (at most a few nodes wide).
    const lowerTarget = byteOffset - tol;
    let lo = 0;
    let hi = nodes.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (nodes[mid]!.byteOffset < lowerTarget) lo = mid + 1;
        else hi = mid;
    }
    let best: SignificantNode | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = lo; i < nodes.length; i++) {
        const n = nodes[i]!;
        if (n.byteOffset > byteOffset + tol) break;
        const dist = Math.abs(n.byteOffset - byteOffset);
        if (dist < bestDist) {
            bestDist = dist;
            best = n;
        }
    }
    return best;
}

export function nodeTypesCompatible(generated: string, source: string): boolean {
    if (generated === source) return true;
    const funcs = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
    if (funcs.has(generated) && funcs.has(source)) return true;
    if (
        (generated === "CallExpression" || generated === "NewExpression") &&
        (source === "CallExpression" || source === "NewExpression")
    )
        return true;
    if (
        (generated === "AssignmentExpression" && source === "VariableDeclaration") ||
        (generated === "VariableDeclaration" && source === "AssignmentExpression")
    )
        return true;
    if (
        (generated === "MemberExpression" && source === "CallExpression") ||
        (generated === "CallExpression" && source === "MemberExpression")
    )
        return true;
    const declarations = new Set([
        "FunctionDeclaration",
        "ClassDeclaration",
        "VariableDeclaration",
        "FunctionExpression",
        "ArrowFunctionExpression",
    ]);
    if (generated === "ExportDeclaration" && declarations.has(source)) return true;
    if (source === "ExportDeclaration" && declarations.has(generated)) return true;
    return false;
}

function extractSnippet(text: string, byteOffset: number, maxLen: number): string {
    const start = byteOffset;
    if (start >= text.length) return "";
    const end = Math.min(text.length, start + maxLen);
    return text.slice(start, end).replace(/\n/g, " ").replace(/\r/g, "");
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "…";
}

