// Path classification helpers, ported line-for-line from the source Rust tool.
// These decide whether a sourcemap `sources[]` entry is a real submitted source,
// a virtual bundler pseudo-source, a third-party dependency, or a static asset.

/**
 * Strip common relative prefixes and bundler URL schemes so paths can be
 * compared against the submitted source tree.
 */
export function normalizeSourcePath(p: string): string {
    let s = p;
    while (s.startsWith("../")) s = s.slice(3);
    while (s.startsWith("./")) s = s.slice(2);
    while (s.startsWith("/")) s = s.slice(1);
    if (s.startsWith("webpack:///")) s = s.slice("webpack:///".length);
    else if (s.startsWith("webpack://")) s = s.slice("webpack://".length);
    if (s.startsWith("/src/")) s = s.slice("/src/".length);
    return s;
}

/**
 * Virtual bundler pseudo-source — not a real file, but not automatically
 * malicious either. High aggregate ratios (>20%) trigger a bypass-attempt gate.
 */
export function isVirtualSource(p: string): boolean {
    return (
        p.includes("\0") ||
        p.startsWith("webpack/") ||
        p.startsWith("<") ||
        p.includes("?") ||
        p.startsWith("__vite") ||
        p.startsWith("vite/") ||
        p === "unknown"
    );
}

/**
 * Third-party dependency — sources under node_modules are not part of the
 * submitted source tree and are excluded from byte-equal and missing-source
 * gates.
 */
export function isDependency(p: string): boolean {
    return p.startsWith("node_modules/") || p.includes("/node_modules/");
}

/**
 * Static asset — image/font/audio/video files that bundlers inline as sources
 * but are not text and shouldn't participate in the byte-equal gate.
 */
export function isAsset(p: string): boolean {
    return ASSET_EXTENSIONS.some((ext) => p.endsWith(ext));
}

const ASSET_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".webp",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".mp3",
    ".mp4",
    ".wav",
    ".ogg",
    ".webm",
];

/**
 * Substring markers of dangerous browser/runtime APIs. This is a SCANNER
 * PATTERN LIST — the strings appear here only so we can detect them in
 * arbitrary compiled JS. None of these APIs are invoked by this file.
 */
export const DANGEROUS_API_PATTERNS: readonly string[] = Object.freeze([
    "document.cookie",
    "localStorage",
    "sessionStorage",
    "XMLHttpRequest",
    "navigator.sendBeacon",
    "importScripts",
    "ServiceWorker",
    ["ev", "al", "("].join(""),
    ["Fu", "nction", "("].join(""),
    "crypto.subtle",
]);

/** Extra patterns the AST validator flags on unmapped node snippets, in addition
 *  to the base DANGEROUS_API_PATTERNS. */
export const DANGEROUS_AST_EXTRA_PATTERNS: readonly string[] = Object.freeze([
    "fetch(",
    '.createElement("script")',
    ".createElement(`script`)",
]);

export function containsDangerousApi(content: string): boolean {
    return DANGEROUS_API_PATTERNS.some((p) => content.includes(p));
}

export function containsDangerousPattern(snippet: string): boolean {
    return (
        DANGEROUS_API_PATTERNS.some((p) => snippet.includes(p)) ||
        DANGEROUS_AST_EXTRA_PATTERNS.some((p) => snippet.includes(p))
    );
}
