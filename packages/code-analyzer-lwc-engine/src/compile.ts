import * as fsp from "node:fs/promises";
import path from "node:path";
import { BundleIdentity } from "./bundle";
import { getMessage } from "./messages";

export interface CollectedDiagnostic {
    code: number;
    message: string;
    filename?: string;
    location?: { line: number; column: number; start?: number; length?: number };
    level: number;
    url?: string;
}

// Callback used to surface non-fatal issues (e.g. the platform compiler being unavailable)
// back to the engine, which owns the event emitter. compile.ts stays free of any Engine
// dependency so it remains a plain, testable module.
export type DebugLogger = (message: string) => void;

// Compile a single LWC file using both open-source and platform compilers.
// Returns a merged, deduplicated list of diagnostics from both paths.
//
// Path 1: @lwc/compiler transformSync — throws CompilerError/CompilerAggregateError (codes 1001-1213)
// Path 2: @lwc/sfdc-lwc-compiler compile() — returns diagnostics on output (codes 1500-1538)
export async function compileAndCollect(
    file: string,
    bundle: BundleIdentity,
    logDebug?: DebugLogger
): Promise<CollectedDiagnostic[]> {
    const source = await fsp.readFile(file, "utf-8");
    const bundleFiles = await readBundleFiles(file, bundle.name);

    // Run the two compiler paths sequentially, not via Promise.all. The open-source
    // path (transformSync) is a synchronous, CPU-bound call, so overlapping it with the
    // platform path yields no throughput win on Node's single thread. Both paths also
    // drive the same @lwc/compiler internals; serializing avoids depending on that shared
    // machinery being safe to re-enter concurrently.
    const openSourceDiags = await collectFromTransformSync(source, file, bundle);
    const platformDiags = await collectFromPlatformCompile(bundleFiles, bundle, file, logDebug);

    return deduplicateDiagnostics([...openSourceDiags, ...platformDiags]);
}

// Read all sibling files in the bundle directory that belong to this component.
async function readBundleFiles(file: string, name: string): Promise<Record<string, string>> {
    const dir = path.dirname(file);
    const files: Record<string, string> = {};
    try {
        const entries = await fsp.readdir(dir);
        for (const entry of entries) {
            const stem = path.basename(entry, path.extname(entry));
            if (stem === name) {
                const content = await fsp.readFile(path.join(dir, entry), "utf-8");
                files[entry] = content;
            }
        }
    } catch {
        // If we can't read the directory, just use the single file
        files[path.basename(file)] = await fsp.readFile(file, "utf-8");
    }
    return files;
}

// Path 1: open-source @lwc/compiler (throws on error)
async function collectFromTransformSync(
    source: string,
    file: string,
    bundle: BundleIdentity
): Promise<CollectedDiagnostic[]> {
    const lwcCompiler = await import("@lwc/compiler");
    const lwcErrors = await import("@lwc/errors");
    const { transformSync } = lwcCompiler as { transformSync: (src: string, filename: string, opts: { name: string; namespace: string }) => unknown };
    const { CompilerError, CompilerAggregateError } = lwcErrors as {
        CompilerError: new (...args: unknown[]) => Error & CollectedDiagnostic;
        CompilerAggregateError: new (...args: unknown[]) => Error & { errors: (Error & CollectedDiagnostic)[] };
    };

    try {
        transformSync(source, file, { name: bundle.name, namespace: bundle.namespace });
        return [];
    } catch (e) {
        if (e instanceof CompilerError) {
            return [unwrap(e)];
        }
        if (e instanceof CompilerAggregateError) {
            return e.errors.map(unwrap);
        }
        const err = e as Error;
        return [{
            code: 1001,
            message: `Unexpected compilation error: ${err.message}`,
            filename: file,
            level: 1,
        }];
    }
}

// Path 2: @lwc/sfdc-lwc-compiler platform compile (returns diagnostics, doesn't throw)
async function collectFromPlatformCompile(
    bundleFiles: Record<string, string>,
    bundle: BundleIdentity,
    file: string,
    logDebug?: DebugLogger
): Promise<CollectedDiagnostic[]> {
    try {
        const sfdcCompiler = await import("@lwc/sfdc-lwc-compiler");
        const compile = (sfdcCompiler as { compile: (config: unknown) => Promise<PlatformOutput> }).compile;

        const output = await compile({
            bundle: {
                type: "platform" as const,
                name: bundle.name,
                namespace: bundle.namespace,
                files: bundleFiles,
            },
        });

        const diagnostics: CollectedDiagnostic[] = [];

        // Top-level diagnostics
        if (output.diagnostics) {
            for (const d of output.diagnostics) {
                if (isPlatformDiagnostic(d)) diagnostics.push(toDiag(d));
            }
        }

        // Per-bundle result diagnostics
        if (output.results) {
            for (const result of output.results) {
                if (result.diagnostics) {
                    for (const d of result.diagnostics) {
                        if (isPlatformDiagnostic(d)) diagnostics.push(toDiag(d));
                    }
                }
            }
        }

        return diagnostics;
    } catch (err) {
        // If platform compile fails entirely (missing deps, version mismatch), fall back to the
        // open-source path (codes 1001-1213). This is non-fatal, but we surface it at debug level
        // so the absence of platform-range diagnostics (1500+) is explainable rather than silent.
        logDebug?.(getMessage("PlatformCompilerUnavailable", file, (err as Error).message));
        return [];
    }
}

// Only keep diagnostics in the platform range (1500+) to avoid double-counting
// open-source errors that both compilers might emit.
function isPlatformDiagnostic(d: unknown): d is RawDiagnostic {
    if (!d || typeof d !== "object") return false;
    const obj = d as Record<string, unknown>;
    return typeof obj.code === "number" && obj.code >= 1500;
}

function toDiag(d: RawDiagnostic): CollectedDiagnostic {
    return {
        code: d.code,
        message: d.message ?? "",
        filename: d.filename,
        location: d.location,
        level: d.level ?? 1,
        url: d.url,
    };
}

function unwrap(e: Error & CollectedDiagnostic): CollectedDiagnostic {
    return {
        code: e.code,
        message: e.message,
        filename: e.filename,
        location: e.location,
        level: e.level,
        url: e.url,
    };
}

function deduplicateDiagnostics(diags: CollectedDiagnostic[]): CollectedDiagnostic[] {
    const seen = new Set<string>();
    const result: CollectedDiagnostic[] = [];
    for (const d of diags) {
        const key = `${d.code}|${d.message}|${d.filename ?? ""}|${d.location?.line ?? ""}|${d.location?.column ?? ""}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(d);
        }
    }
    return result;
}

interface RawDiagnostic {
    code: number;
    message?: string;
    filename?: string;
    location?: { line: number; column: number; start?: number; length?: number };
    level?: number;
    url?: string;
}

interface PlatformOutput {
    diagnostics?: unknown[];
    results?: Array<{ diagnostics?: unknown[] }>;
}
