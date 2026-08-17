import { promises as fs } from "node:fs";
import { decode } from "@jridgewell/sourcemap-codec";
import { walk } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const VLQ_INTEGRITY_RULE = "vlq-integrity";

interface RawMap {
    version?: number;
    sources?: unknown;
    mappings?: unknown;
    names?: unknown;
}

export async function validateVlqIntegrity(distPath: string): Promise<ValidatorResult> {
    const findings: ValidatorFinding[] = [];

    await walk(distPath, async (file) => {
        if (!file.endsWith(".js.map")) return;

        let raw: string;
        try {
            raw = await fs.readFile(file, "utf8");
        } catch {
            return;
        }

        let parsed: RawMap;
        try {
            parsed = JSON.parse(raw) as RawMap;
        } catch (err) {
            findings.push({
                ruleName: VLQ_INTEGRITY_RULE,
                message: getMessage('SourcemapNotValidJson', (err as Error).message),
                file,
            });
            return;
        }

        if (typeof parsed.mappings !== "string") {
            findings.push({
                ruleName: VLQ_INTEGRITY_RULE,
                message: getMessage('SourcemapMissingMappings'),
                file,
            });
            return;
        }
        if (!Array.isArray(parsed.sources)) {
            findings.push({
                ruleName: VLQ_INTEGRITY_RULE,
                message: getMessage('SourcemapMissingSourcesArray'),
                file,
            });
            return;
        }

        let decoded: number[][][];
        try {
            decoded = decode(parsed.mappings);
        } catch (err) {
            findings.push({
                ruleName: VLQ_INTEGRITY_RULE,
                message: getMessage('VlqDecodingFailed', (err as Error).message),
                file,
            });
            return;
        }

        const sourcesLen = (parsed.sources as unknown[]).length;
        const namesLen = Array.isArray(parsed.names) ? (parsed.names as unknown[]).length : 0;

        for (let lineIdx = 0; lineIdx < decoded.length; lineIdx++) {
            const segments = decoded[lineIdx]!;
            for (let segIdx = 0; segIdx < segments.length; segIdx++) {
                const seg = segments[segIdx]!;
                if (seg.length >= 4) {
                    const srcIdx = seg[1]!;
                    if (srcIdx < 0 || srcIdx >= sourcesLen) {
                        findings.push({
                            ruleName: VLQ_INTEGRITY_RULE,
                            message: getMessage('SegmentSourceIndexOutOfRange', lineIdx + 1, segIdx + 1, srcIdx, sourcesLen),
                            file,
                        });
                    }
                }
                if (seg.length === 5) {
                    const nameIdx = seg[4]!;
                    if (nameIdx < 0 || nameIdx >= namesLen) {
                        findings.push({
                            ruleName: VLQ_INTEGRITY_RULE,
                            message: getMessage('SegmentNameIndexOutOfRange', lineIdx + 1, segIdx + 1, nameIdx, namesLen),
                            file,
                        });
                    }
                }
            }
        }
    });

    return { findings };
}
