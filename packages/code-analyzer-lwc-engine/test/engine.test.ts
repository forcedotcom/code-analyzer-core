import { Workspace } from "@salesforce/code-analyzer-engine-api";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LwcEngine } from "../src/engine";
import { LwcEnginePlugin } from "../src/plugin";

const TEST_DATA = path.join(__dirname, "test-data");

function mkRunOpts(workspace: Workspace) {
    return {
        logFolder: os.tmpdir(),
        workspace,
        workingFolder: fs.mkdtempSync(path.join(os.tmpdir(), "lwc-engine-test-")),
    };
}

function mkDescribeOpts(workspace?: Workspace) {
    return {
        logFolder: os.tmpdir(),
        workspace,
        workingFolder: fs.mkdtempSync(path.join(os.tmpdir(), "lwc-engine-test-")),
    };
}

describe("LwcEnginePlugin", () => {
    it("advertises only the lwc engine name", () => {
        expect(new LwcEnginePlugin().getAvailableEngineNames()).toEqual(["lwc"]);
    });

    it("creates an LwcEngine instance for the right name", async () => {
        const engine = await new LwcEnginePlugin().createEngine("lwc", {});
        expect(engine).toBeInstanceOf(LwcEngine);
    });

    it("rejects unknown engine names", async () => {
        await expect(new LwcEnginePlugin().createEngine("nope", {})).rejects.toThrow();
    });
});

describe("LwcEngine", () => {
    it("getName returns 'lwc'", () => {
        expect(new LwcEngine().getName()).toBe("lwc");
    });

    it("getEngineVersion returns a semver-shaped string", async () => {
        const v = await new LwcEngine().getEngineVersion();
        expect(v).toMatch(/\d+\.\d+\.\d+/);
    });

    it("describeRules returns a non-empty rule catalog", async () => {
        const engine = new LwcEngine();
        const rules = await engine.describeRules(mkDescribeOpts());
        expect(rules.length).toBeGreaterThan(0);
        // Spike doc §7: every rule is named LWC<code>
        for (const r of rules) {
            expect(r.name).toMatch(/^LWC\d+$/);
            expect(r.tags).toContain("LWC");
            expect(r.tags).toContain("Recommended");
        }
    });

    it("runRules on a clean bundle produces zero violations", async () => {
        const engine = new LwcEngine();
        const ws = new Workspace("test-good", [path.join(TEST_DATA, "lwc", "good")]);
        const results = await engine.runRules([], mkRunOpts(ws));
        expect(results.violations).toEqual([]);
    });

    it("runRules on a bundle with bad decorators emits an LWC violation", async () => {
        const engine = new LwcEngine();
        const ws = new Workspace("test-bad", [path.join(TEST_DATA, "lwc", "bad")]);
        // Empty selector means "all rules" in this engine; if you want to scope,
        // pass an explicit list.
        const results = await engine.runRules([], mkRunOpts(ws));
        expect(results.violations.length).toBeGreaterThan(0);
        for (const v of results.violations) {
            expect(v.ruleName).toMatch(/^LWC\d+$/);
            expect(v.message).toBeTruthy();
            expect(v.codeLocations.length).toBe(1);
        }
    });
});
