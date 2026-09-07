import path from "node:path";
import * as fsp from "node:fs/promises";

const BUNDLE_EXTENSIONS = new Set([".js", ".ts", ".mjs", ".html", ".css"]);
// The default LWC namespace, used when no sfdx-project.json declares one.
const DEFAULT_NAMESPACE = "c";
const SFDX_PROJECT_FILE = "sfdx-project.json";

// Cache resolved namespaces per directory so we don't re-walk/re-read for every
// file in the same project during a single run.
const namespaceCache = new Map<string, string>();

export interface BundleIdentity {
    name: string;
    namespace: string;
}

// Spike doc §10.1. A file qualifies as an LWC bundle file when its extension
// is supported AND its parent directory's basename matches the file's stem
// AND the file is not under a __tests__/ directory.
export function isLwcBundleFile(absPath: string): boolean {
    const ext = path.extname(absPath).toLowerCase();
    if (!BUNDLE_EXTENSIONS.has(ext)) return false;

    const stem = path.basename(absPath, ext);
    const parentDir = path.basename(path.dirname(absPath));
    if (parentDir !== stem) return false;

    const segments = absPath.split(path.sep);
    if (segments.includes("__tests__")) return false;

    return true;
}

// Spike doc §10.2. The namespace is read from the nearest ancestor
// sfdx-project.json's top-level "namespace" field, falling back to "c" when the
// manifest is absent, unreadable, or declares no (non-empty) namespace.
export async function bundleIdentity(absPath: string): Promise<BundleIdentity> {
    const ext = path.extname(absPath);
    const stem = path.basename(absPath, ext);
    return { name: stem, namespace: await resolveNamespace(path.dirname(absPath)) };
}

// Walk up from startDir looking for an sfdx-project.json and return its declared
// namespace. Results are cached per directory. A missing/blank namespace, a
// missing manifest, or malformed JSON all resolve to DEFAULT_NAMESPACE.
async function resolveNamespace(startDir: string): Promise<string> {
    const cached = namespaceCache.get(startDir);
    if (cached !== undefined) return cached;

    const visited: string[] = [];
    let dir = startDir;
    // Stop when path.dirname stops changing (filesystem root).
    while (true) {
        visited.push(dir);
        const cachedForDir = namespaceCache.get(dir);
        if (cachedForDir !== undefined) {
            return cacheFor(visited, cachedForDir);
        }
        const ns = await readNamespace(path.join(dir, SFDX_PROJECT_FILE));
        if (ns !== undefined) {
            // A manifest exists here — its namespace (or the default, if blank/malformed)
            // wins and we stop walking.
            return cacheFor(visited, ns);
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return cacheFor(visited, DEFAULT_NAMESPACE);
}

// Read the namespace from a manifest. Returns undefined when the manifest does not
// exist (so the caller keeps walking up), the trimmed namespace when one is declared,
// or DEFAULT_NAMESPACE when the manifest exists but is blank/malformed.
async function readNamespace(manifestPath: string): Promise<string | undefined> {
    let raw: string;
    try {
        raw = await fsp.readFile(manifestPath, "utf-8");
    } catch {
        return undefined; // no manifest at this level
    }
    try {
        const parsed = JSON.parse(raw) as { namespace?: unknown };
        const ns = parsed.namespace;
        if (typeof ns === "string" && ns.trim().length > 0) {
            return ns.trim();
        }
    } catch {
        // Manifest exists but is malformed — fall back to the default namespace.
    }
    return DEFAULT_NAMESPACE;
}

// Cache the resolved namespace against every directory visited on the walk so
// sibling files short-circuit on the next lookup.
function cacheFor(dirs: string[], namespace: string): string {
    for (const d of dirs) {
        namespaceCache.set(d, namespace);
    }
    return namespace;
}
