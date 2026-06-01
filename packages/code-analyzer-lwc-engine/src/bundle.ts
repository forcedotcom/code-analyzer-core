import path from "node:path";

const BUNDLE_EXTENSIONS = new Set([".js", ".ts", ".mjs", ".html", ".css"]);
// TODO: Parse namespace from sfdx-project.json instead of hard-coding "c"
const DEFAULT_NAMESPACE = "c";

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

// Spike doc §10.2. v1: namespace is hard-coded to "c". sfdx-project.json
// parsing is a known limitation (§16).
export function bundleIdentity(absPath: string): BundleIdentity {
    const ext = path.extname(absPath);
    const stem = path.basename(absPath, ext);
    return { name: stem, namespace: DEFAULT_NAMESPACE };
}
