import { toViolation } from "../src/translate";

describe("toViolation", () => {
    it("maps a basic diagnostic to a violation", () => {
        const v = toViolation({
            code: 1121,
            message: "Bad import",
            level: 1,
            filename: "/p/lwc/foo/foo.js",
            location: { line: 3, column: 5, length: 4 },
            url: "https://lwc.dev/guide/error_codes#lwc1121",
        }, "/p/lwc/foo/foo.js");

        expect(v.ruleName).toBe("LWC1121");
        expect(v.message).toBe("Bad import");
        expect(v.codeLocations).toHaveLength(1);
        expect(v.codeLocations[0]).toEqual({
            file: "/p/lwc/foo/foo.js",
            startLine: 3,
            startColumn: 5,
        });
        expect(v.primaryLocationIndex).toBe(0);
        expect(v.resourceUrls).toEqual(["https://lwc.dev/guide/error_codes#lwc1121"]);
    });

    it("returns empty resourceUrls when d.url is missing (spike doc §9: no synthesis)", () => {
        const v = toViolation({
            code: 1099, message: "x", level: 2, filename: "/p/lwc/foo/foo.js",
        }, "/p/lwc/foo/foo.js");
        expect(v.resourceUrls).toEqual([]);
    });

    it("falls back to provided file when d.filename is absent", () => {
        const v = toViolation({ code: 1, message: "x", level: 1 }, "/fallback/path.js");
        expect(v.codeLocations[0].file).toBe("/fallback/path.js");
        expect(v.codeLocations[0].startLine).toBe(1);
        expect(v.codeLocations[0].startColumn).toBe(1);
    });
});
