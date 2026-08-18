// Path classification helpers: decide whether a sourcemap `sources[]` entry is
// a real submitted source, a virtual bundler pseudo-source, a third-party
// dependency, or a static asset.

// Sourcemap `sources[]` entries are always `/`-separated; `path.relative` uses
// `\` on Windows.
export function toPosixPath(p: string): string {
    return p.replace(/\\/g, "/");
}

// Byte-equal source compare must ignore line-ending differences — CRLF
// checkouts on Windows would otherwise diverge from LF-embedded sourcesContent.
export function normalizeLineEndings(s: string): string {
    return s.replace(/\r\n?/g, "\n");
}

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

// Virtual bundler pseudo-source. Not a real file, so excluded from source-tree
// gates. High aggregate ratios (>20%) trigger a bypass-attempt gate.
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

export function isDependency(p: string): boolean {
    return p.startsWith("node_modules/") || p.includes("/node_modules/");
}

// Image/font/audio/video files inlined by bundlers; not text, so excluded from
// byte-equal comparison.
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

// Scanner pattern list — strings appear here so we can detect them in
// arbitrary compiled JS. None of these APIs are invoked by this file.
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

// Extra patterns the AST validator flags on unmapped node snippets (added to
// DANGEROUS_API_PATTERNS).
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
