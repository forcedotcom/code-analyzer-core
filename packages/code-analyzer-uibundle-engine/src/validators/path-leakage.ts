import { collectSourceMaps } from "./sourcemap-io";
import { getMessage } from "../messages";
import type { ValidatorFinding, ValidatorResult } from "./types";

export const PATH_LEAKAGE_RULE = "path-leakage";

const ABSOLUTE_UNIX_HOME = /^\/(?:Users|home|root)\//;
const ABSOLUTE_WIN_DRIVE = /^[A-Za-z]:[\\/]/;
const WIN_UNC = /^\\\\/;
const FILE_URL = /^file:\/\//i;

export async function validatePathLeakage(distPath: string): Promise<ValidatorResult> {
    const maps = await collectSourceMaps(distPath);
    const findings: ValidatorFinding[] = [];

    for (const { path: mapPath, map } of maps) {
        for (const source of map.sources) {
            if (!source) continue;
            if (isLeaking(source)) {
                findings.push({
                    ruleName: PATH_LEAKAGE_RULE,
                    message: getMessage('PathLeakageFinding', source),
                    file: mapPath,
                    startLine: 1,
                    startColumn: 1,
                });
            }
        }
    }
    return { findings };
}

function isLeaking(source: string): boolean {
    return (
        ABSOLUTE_UNIX_HOME.test(source) ||
        ABSOLUTE_WIN_DRIVE.test(source) ||
        WIN_UNC.test(source) ||
        FILE_URL.test(source)
    );
}
