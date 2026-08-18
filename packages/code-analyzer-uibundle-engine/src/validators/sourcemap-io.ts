import { promises as fs } from "node:fs";
import * as path from "node:path";

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

export async function collectSourceMaps(root: string): Promise<LoadedSourceMap[]> {
    const out: LoadedSourceMap[] = [];
    await walk(root, async (file) => {
        if (!file.endsWith(".js.map")) return;
        try {
            const raw = await fs.readFile(file, "utf8");
            const map = JSON.parse(raw) as RawSourceMap;
            if (typeof map?.mappings === "string" && Array.isArray(map?.sources)) {
                out.push({ path: file, map });
            }
        } catch {
            // vlq-integrity surfaces malformed JSON
        }
    });
    return out;
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
