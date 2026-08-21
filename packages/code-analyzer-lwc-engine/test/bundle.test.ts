import path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { isLwcBundleFile, bundleIdentity } from "../src/bundle";

const j = (...p: string[]) => path.sep + path.join(...p);

describe("isLwcBundleFile", () => {
    it("accepts a JS file matching its parent directory name", () => {
        expect(isLwcBundleFile(j("project", "force-app", "lwc", "foo", "foo.js"))).toBe(true);
    });

    it("accepts an HTML template", () => {
        expect(isLwcBundleFile(j("project", "lwc", "foo", "foo.html"))).toBe(true);
    });

    it("rejects when stem doesn't match parent directory", () => {
        expect(isLwcBundleFile(j("project", "lwc", "foo", "helper.js"))).toBe(false);
    });

    it("rejects unsupported extensions", () => {
        expect(isLwcBundleFile(j("project", "lwc", "foo", "foo.json"))).toBe(false);
    });

    it("rejects files under __tests__", () => {
        expect(isLwcBundleFile(j("project", "lwc", "foo", "__tests__", "foo.js"))).toBe(false);
    });
});

describe("bundleIdentity", () => {
    it("derives name from file stem and namespace defaults to c when no manifest exists", () => {
        expect(bundleIdentity(j("project", "lwc", "foo", "foo.js"))).toEqual({ name: "foo", namespace: "c" });
    });

    describe("namespace resolution from sfdx-project.json", () => {
        let tmpRoot: string;

        beforeEach(() => {
            tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lwc-engine-ns-"));
        });

        afterEach(() => {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        });

        // Build a component file path under tmpRoot and ensure its bundle dir exists.
        const componentFile = (name = "foo") => {
            const dir = path.join(tmpRoot, "force-app", "main", "default", "lwc", name);
            fs.mkdirSync(dir, { recursive: true });
            return path.join(dir, `${name}.js`);
        };

        const writeManifest = (namespace: unknown) => {
            const body = namespace === undefined ? {} : { namespace };
            fs.writeFileSync(path.join(tmpRoot, "sfdx-project.json"), JSON.stringify(body));
        };

        it("reads the declared namespace from an ancestor sfdx-project.json", () => {
            writeManifest("myns");
            expect(bundleIdentity(componentFile())).toEqual({ name: "foo", namespace: "myns" });
        });

        it("falls back to c when the manifest declares no namespace", () => {
            writeManifest(undefined);
            expect(bundleIdentity(componentFile())).toEqual({ name: "foo", namespace: "c" });
        });

        it("falls back to c when the manifest namespace is blank", () => {
            writeManifest("   ");
            expect(bundleIdentity(componentFile())).toEqual({ name: "foo", namespace: "c" });
        });

        it("falls back to c when the manifest is malformed JSON", () => {
            fs.writeFileSync(path.join(tmpRoot, "sfdx-project.json"), "{ not valid json");
            expect(bundleIdentity(componentFile())).toEqual({ name: "foo", namespace: "c" });
        });
    });
});
