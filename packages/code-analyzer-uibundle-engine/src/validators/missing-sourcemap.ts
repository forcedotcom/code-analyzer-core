import { promises as fs } from "node:fs";
import * as path from "node:path";
import { containsDangerousApi, DANGEROUS_API_PATTERNS, isCompiledJs, isSourcemap } from "./classification";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const MISSING_SOURCEMAP_RULE = "missing-sourcemap";

export async function validateMissingSourcemaps(distPath: string): Promise<ValidatorResult> {
    let distStat: Awaited<ReturnType<typeof fs.stat>>;
    try {
        distStat = await fs.stat(distPath);
    } catch {
        return { findings: [], skipped: { reason: `dist path not found: ${distPath}` } };
    }
    if (!distStat.isDirectory()) {
        return { findings: [], skipped: { reason: `dist path is not a directory: ${distPath}` } };
    }

    const jsFiles = await collectJsFiles(distPath);
    const findings: ValidatorFinding[] = [];

    for (const jsFile of jsFiles) {
        if (await hasSourcemap(jsFile, distPath)) continue;

        findings.push({
            ruleName: MISSING_SOURCEMAP_RULE,
            message: getMessage('MissingSourcemapForFile', path.relative(distPath, jsFile)),
            file: jsFile,
            startLine: 1,
            startColumn: 1,
        });

        let content: string;
        try {
            content = await fs.readFile(jsFile, "utf8");
        } catch {
            continue;
        }
        if (containsDangerousApi(content)) {
            const hits = DANGEROUS_API_PATTERNS.filter((p) => content.includes(p));
            findings.push({
                ruleName: MISSING_SOURCEMAP_RULE,
                message: getMessage('OrphanJsWithDangerousApi', hits.join(", ")),
                file: jsFile,
                startLine: 1,
                startColumn: 1,
            });
        }
    }

    return { findings };
}

async function collectJsFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.isFile() && isCompiledJs(entry.name)) {
                out.push(full);
            }
        }
    }
    await walk(root);
    return out;
}

async function hasSourcemap(jsFile: string, distPath: string): Promise<boolean> {
    // Downstream validators skip non-files and anything outside distPath, so accepting
    // those here would silently bypass all 8 rules.
    const colocated = `${jsFile}.map`;
    try {
        const st = await fs.stat(colocated);
        if (st.isFile()) return true;
    } catch {
        // fall through
    }

    let contents: string;
    try {
        contents = await fs.readFile(jsFile, "utf8");
    } catch {
        return false;
    }
    const match = /^[/\s]*[#@]\s*sourceMappingURL\s*=\s*(\S+)/m.exec(contents);
    if (!match) return false;
    const url = match[1]!.replace(/[?#].*$/, "");
    if (url.startsWith("data:")) return false;
    if (/^[a-z]+:\/\//i.test(url)) return false;
    const resolved = path.resolve(path.dirname(jsFile), url);
    const relToDist = path.relative(distPath, resolved);
    if (relToDist.startsWith("..") || path.isAbsolute(relToDist)) return false;
    if (!isSourcemap(resolved)) return false;
    try {
        const st = await fs.stat(resolved);
        return st.isFile();
    } catch {
        return false;
    }
}
