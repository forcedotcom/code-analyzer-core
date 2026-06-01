import path from "node:path";
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
    it("derives name from file stem and namespace defaults to c", () => {
        expect(bundleIdentity(j("project", "lwc", "foo", "foo.js"))).toEqual({ name: "foo", namespace: "c" });
    });
});
