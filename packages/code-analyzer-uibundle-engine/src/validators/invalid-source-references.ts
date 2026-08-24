import { promises as fs } from "node:fs";
import * as path from "node:path";
import { collectSourceMaps } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const INVALID_SOURCE_REFERENCES_RULE = "invalid-source-references";

const VIRTUAL_SCHEMES = /^(?:webpack|rollup|vite|esbuild|node):/;
const DATA_URL = /^data:/i;
const HTTP_URL = /^https?:\/\//i;

export async function validateInvalidSourceReferences(distPath: string): Promise<ValidatorResult> {
    const { maps, parseErrors } = await collectSourceMaps(distPath);
    const findings: ValidatorFinding[] = [];

    for (const { path: mapPath, message } of parseErrors) {
        findings.push({
            ruleName: INVALID_SOURCE_REFERENCES_RULE,
            message: getMessage('SourcemapNotValidJson', message),
            file: mapPath,
        });
    }

    for (const { path: mapPath, map } of maps) {
        const mapDir = path.dirname(mapPath);
        const contents = map.sourcesContent ?? [];

        for (let i = 0; i < map.sources.length; i++) {
            const source = map.sources[i];
            if (!source) continue;
            if (isVirtualOrRemote(source)) continue;
            if (contents[i] != null) continue;

            const resolved = resolveSourcePath(source, map.sourceRoot ?? "", mapDir);
            try {
                await fs.access(resolved);
            } catch {
                findings.push({
                    ruleName: INVALID_SOURCE_REFERENCES_RULE,
                    message: getMessage('SourceFileDoesNotExist', source, resolved),
                    file: mapPath,
                    startLine: 1,
                    startColumn: 1,
                });
            }
        }
    }
    return { findings };
}

function isVirtualOrRemote(source: string): boolean {
    return VIRTUAL_SCHEMES.test(source) || DATA_URL.test(source) || HTTP_URL.test(source);
}

function resolveSourcePath(source: string, sourceRoot: string, mapDir: string): string {
    if (path.isAbsolute(source)) return source;
    const withRoot = sourceRoot ? path.join(sourceRoot, source) : source;
    if (path.isAbsolute(withRoot)) return withRoot;
    return path.resolve(mapDir, withRoot);
}
