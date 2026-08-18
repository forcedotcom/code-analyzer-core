export function toPosixPath(p: string): string {
    return p.replace(/\\/g, "/");
}

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
