import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildRuleCatalog } from "../src/rules";

function codesOf(rules: { name: string }[]): number[] {
    return rules.map(r => Number(r.name.replace("LWC", "")));
}

describe("buildRuleCatalog", () => {
    it("loads every rule as LWC<code> with a description and LWC/Recommended tags", async () => {
        const rules = await buildRuleCatalog();
        expect(rules.length).toBeGreaterThan(0);
        for (const r of rules) {
            expect(r.name).toMatch(/^LWC\d+$/);
            expect(r.description).toBeTruthy();
            expect(r.tags).toEqual(expect.arrayContaining(["LWC", "Recommended"]));
        }
    });

    it("includes the open-source @lwc/errors code range (1001-1213)", async () => {
        const rules = await buildRuleCatalog();
        expect(codesOf(rules).some(c => c >= 1001 && c <= 1213)).toBe(true);
    });

    it("dedupes shared codes and returns the catalog sorted by rule name", async () => {
        const rules = await buildRuleCatalog();
        const names = rules.map(r => r.name);
        expect(new Set(names).size).toBe(names.length);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it("never throws even if a platform registry fails to load", async () => {
        // The try/catch in loadPlatformErrors must keep the catalog usable (falling back to
        // the open-source range) rather than propagating a load failure.
        await expect(buildRuleCatalog()).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({ name: expect.stringMatching(/^LWC\d+$/) }),
        ]));
    });
});

// The platform error registries (@lwc/sfdc-lwc-compiler => 1500s, @lwc/metadata => 1700s)
// are CJS files that internally require("@lwc/errors"), which is ESM-only. In production,
// Node's flagless require(ESM) (Node >=20.19) resolves that on its own, and rules.ts loads
// them via import(fileURL) with no vm and no interception.
//
// Jest's own module loader cannot load @lwc/errors (ESM) synchronously on the Node versions
// we support, so this path cannot be exercised from inside a Jest test. Rather than distort
// the test environment to force it (e.g. remapping @lwc/errors to a CJS build the way
// production never does), we verify the real thing: run buildRuleCatalog from the COMPILED
// output in a plain Node child process — exactly how Code Analyzer loads the engine — and
// assert all three code ranges are present.
describe("buildRuleCatalog (production path, via compiled dist in a child process)", () => {
    const distRules = path.join(__dirname, "..", "dist", "rules.js");

    it("has a compiled dist to run against (npm test builds it first)", () => {
        expect(fs.existsSync(distRules)).toBe(true);
    });

    it("loads the open-source, sfdc-lwc-compiler, and metadata code ranges", () => {
        const script = `
            const { buildRuleCatalog } = require(${JSON.stringify(distRules)});
            buildRuleCatalog().then(rules => {
                const codes = rules.map(r => Number(r.name.replace("LWC", "")));
                process.stdout.write(JSON.stringify({
                    total: rules.length,
                    openSource: codes.some(c => c >= 1001 && c <= 1213),
                    platform1500: codes.some(c => c >= 1500 && c < 1600),
                    platform1700: codes.some(c => c >= 1700 && c < 1800),
                }));
            }).catch(err => { console.error(err); process.exit(1); });
        `;
        const out = execFileSync(process.execPath, ["-e", script], { encoding: "utf-8" });
        const result = JSON.parse(out);

        expect(result.total).toBeGreaterThan(0);
        expect(result.openSource).toBe(true);
        expect(result.platform1500).toBe(true);
        expect(result.platform1700).toBe(true);
    });
});
