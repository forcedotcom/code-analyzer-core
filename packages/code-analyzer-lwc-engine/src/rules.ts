import { RuleDescription } from "@salesforce/code-analyzer-engine-api";
import { pathToFileURL } from "node:url";
import { toSeverityLevel } from "./severity";
import { DebugLogger } from "./compile";
import { getMessage } from "./messages";

interface LWCErrorInfoLike {
    code: number;
    message: string;
    level: number;
    url?: string;
}

// Load a platform package's error registry (@lwc/sfdc-lwc-compiler, @lwc/metadata).
//
// These packages are CJS but internally require("@lwc/errors"), which is ESM-only. We load
// each package's own, unmodified errors module through Node's standard loader via a dynamic
// import() of its file URL. Node's flagless require(ESM) support (Node >=20.19 / >=22.12)
// resolves the inner require("@lwc/errors") on its own, so no interception is needed.
//
// We deliberately do NOT read the file off disk and execute its text in a vm: that is
// arbitrary code execution with no integrity guarantees, and it forced us to hand-fake the
// @lwc/errors constants the file expects. import() runs the real code through the real
// module machinery instead — no vm, no disk reads, no faked constants.
//
// Needs Node >=20.19 (flagless require(ESM)). On Node 20.0-20.18 this throws, which is fine:
// the catch below falls back to the open-source registry (codes 1001-1213 only, no 1500/1700
// ranges) and logs why at debug. We keep engines at ">=20.0.0" and document this in the README
// rather than raise the floor.
async function loadPlatformErrors(
    packageName: string,
    logDebug?: DebugLogger
): Promise<Record<string, unknown>> {
    try {
        const resolvedPath = require.resolve(`${packageName}/dist/errors/errors.js`);
        const mod = await import(pathToFileURL(resolvedPath).href);
        // A CJS module imported by URL exposes its module.exports as the default binding.
        return ((mod as { default?: unknown }).default ?? mod) as Record<string, unknown>;
    } catch (err) {
        logDebug?.(getMessage("PlatformErrorRegistryUnavailable", packageName, (err as Error).message));
        return {};
    }
}

async function loadRegistries(logDebug?: DebugLogger): Promise<LWCErrorInfoLike[]> {
    const lwcErrors = await import("@lwc/errors");
    const [sfdcErrors, metadataErrors] = await Promise.all([
        loadPlatformErrors("@lwc/sfdc-lwc-compiler", logDebug),
        loadPlatformErrors("@lwc/metadata", logDebug),
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

export async function buildRuleCatalog(logDebug?: DebugLogger): Promise<RuleDescription[]> {
    const infos = await loadRegistries(logDebug);

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
