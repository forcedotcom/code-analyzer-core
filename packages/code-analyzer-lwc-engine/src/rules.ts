import { RuleDescription } from "@salesforce/code-analyzer-engine-api";
import { toSeverityLevel } from "./severity";

interface LWCErrorInfoLike {
    code: number;
    message: string;
    level: number;
    url?: string;
}

// Lazy-load all error registries from three sources:
//   1. @lwc/errors (open-source compiler, codes 1001-1213)
//   2. @lwc/sfdc-lwc-compiler (platform compiler, codes 1500-1538)
//   3. @lwc/metadata (metadata extraction, codes 1700-1720)
//
// Platform packages (2 & 3) are CJS but require() @lwc/errors which is ESM-only.
// CJS cannot require ESM — this is a broken dependency in the published packages.
// Workaround: read the .js file from disk and execute it in a VM with a fake require()
// that supplies the only constants the file actually needs (DiagnosticLevel enum values).
//
// RESOLUTION PATH (pending team decision): Node ships flagless require(esm) as of
// Node >= 20.19 / >= 22.12. On those versions the inner require("@lwc/errors") no longer
// throws ERR_REQUIRE_ESM, so this VM hack can be deleted and replaced with a plain
// `await import(`${packageName}/dist/errors/errors.js`)`. Doing so requires bumping this
// package's engines floor from ">=20.0.0" to ">=20.19.0" (Node 20.0–20.18 would still
// crash). Whether we can raise the Node floor — here only, or repo-wide (every package is
// currently ">=20.0.0") — is a decision for the team, not the POC.

async function loadPlatformErrors(packageName: string): Promise<Record<string, unknown>> {
    const resolvePath = require.resolve(`${packageName}/dist/errors/errors.js`);
    const fs = await import("node:fs");
    const vm = await import("node:vm");
    const code = fs.readFileSync(resolvePath, "utf-8").replace(/\/\/# sourceMappingURL=.*$/m, "");
    const mod = { exports: {} as Record<string, unknown> };
    const wrapped = `(function(exports, require, module) {\n${code}\n})`;
    const fn = vm.runInThisContext(wrapped);
    fn(mod.exports, () => ({ DiagnosticLevel: { Fatal: 0, Error: 1, Warning: 2, Log: 3 }, SITE_LOCAL_NAMESPACE: "Site" }), mod);
    return mod.exports;
}

async function loadRegistries(): Promise<LWCErrorInfoLike[]> {
    const lwcErrors = await import("@lwc/errors");
    const [sfdcErrors, metadataErrors] = await Promise.all([
        loadPlatformErrors("@lwc/sfdc-lwc-compiler"),
        loadPlatformErrors("@lwc/metadata"),
    ]);

    const collected: LWCErrorInfoLike[] = [];

    const pushFrom = (source: unknown) => {
        if (!source || typeof source !== "object") return;
        if (isLwcErrorInfo(source)) {
            collected.push(source);
            return;
        }
        for (const value of Object.values(source as Record<string, unknown>)) {
            if (isLwcErrorInfo(value)) {
                collected.push(value);
            }
        }
    };

    // @lwc/errors registries
    const e = lwcErrors as Record<string, unknown>;
    pushFrom(e.GENERIC_COMPILER_ERROR);
    pushFrom(e.CompilerValidationErrors);
    pushFrom(e.ModuleResolutionErrors);
    pushFrom(e.TransformerErrors);
    pushFrom(e.LWCClassErrors);
    pushFrom(e.DecoratorErrors);
    pushFrom(e.TemplateErrors);
    pushFrom(e.ParserDiagnostics);
    pushFrom(e.SsrCompilerErrors);

    // @lwc/sfdc-lwc-compiler platform errors (1500s)
    const s = sfdcErrors as Record<string, unknown>;
    pushFrom(s.Errors);
    pushFrom(s.JSDocErrors);

    // @lwc/metadata errors (1700s)
    const m = metadataErrors as Record<string, unknown>;
    pushFrom(m.Errors);

    return collected;
}

function isLwcErrorInfo(v: unknown): v is LWCErrorInfoLike {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return typeof o.code === "number"
        && typeof o.message === "string"
        && typeof o.level === "number";
}

export function ruleNameForCode(code: number): string {
    return `LWC${code}`;
}

export async function buildRuleCatalog(): Promise<RuleDescription[]> {
    const infos = await loadRegistries();

    // Dedupe by code — registries can repeat entries for shared codes.
    const byCode = new Map<number, LWCErrorInfoLike>();
    for (const info of infos) {
        if (!byCode.has(info.code)) byCode.set(info.code, info);
    }

    const rules: RuleDescription[] = [];
    for (const info of byCode.values()) {
        rules.push({
            name: ruleNameForCode(info.code),
            severityLevel: toSeverityLevel(info.level),
            tags: ["Recommended", "LWC"],
            description: info.message,
            resourceUrls: info.url ? [info.url] : []
        });
    }

    rules.sort((a, b) => a.name.localeCompare(b.name));
    return rules;
}
