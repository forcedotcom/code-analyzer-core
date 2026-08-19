import { promises as fs } from "node:fs";
import * as path from "node:path";
import { toPosixPath } from "./classification";

export type SourceIndex = Map<string, string>;

const INDEX_IGNORE_PREFIXES = ["node_modules", ".git", "dist"];

export async function buildSourceIndex(sourcePath: string): Promise<SourceIndex> {
    const raw: SourceIndex = new Map();
    await walk(sourcePath, async (abs) => {
        const rel = toPosixPath(path.relative(sourcePath, abs));
        if (INDEX_IGNORE_PREFIXES.some((prefix) => rel.startsWith(prefix))) return;
        try {
            const content = await fs.readFile(abs, "utf8");
            raw.set(rel, content);
        } catch {
            // skip
        }
    });
    const base = path.basename(sourcePath);
    const expanded: SourceIndex = new Map(raw);
    for (const [rel, content] of raw) {
        expanded.set(`${base}/${rel}`, content);
    }
    return expanded;
}

export interface RawSourceMap {
    version: number;
    file?: string;
    sourceRoot?: string;
    sources: (string | null)[];
    sourcesContent?: (string | null)[];
    names?: string[];
    mappings: string;
}

export interface LoadedSourceMap {
    path: string;
    map: RawSourceMap;
}

export interface SourceMapParseError {
    path: string;
    message: string;
}

export interface CollectedSourceMaps {
    maps: LoadedSourceMap[];
    parseErrors: SourceMapParseError[];
}

export async function collectSourceMaps(root: string): Promise<CollectedSourceMaps> {
    const maps: LoadedSourceMap[] = [];
    const parseErrors: SourceMapParseError[] = [];
    await walk(root, async (file) => {
        if (!file.endsWith(".js.map")) return;
        let raw: string;
        try {
            raw = await fs.readFile(file, "utf8");
        } catch {
            return;
        }
        let map: RawSourceMap;
        try {
            map = JSON.parse(raw) as RawSourceMap;
        } catch (err) {
            parseErrors.push({ path: file, message: (err as Error).message });
            return;
        }
        if (typeof map?.mappings === "string" && Array.isArray(map?.sources)) {
            maps.push({ path: file, map });
        }
    });
    return { maps, parseErrors };
}

export async function walk(root: string, visit: (file: string) => Promise<void>): Promise<void> {
    let entries;
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) {
            await walk(full, visit);
        } else if (entry.isFile()) {
            await visit(full);
        }
    }
}
