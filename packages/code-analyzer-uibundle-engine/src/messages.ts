import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    UnsupportedEngineName:
        `The UIBundleEnginePlugin does not support an engine with name '%s'.`,

    NoBundleTargetsFound:
        `[%s] No UI Bundle dist/ directories found. Run 'npm run build' in each UI Bundle before code analysis.`,

    SkippedForTarget:
        `[%s] %s skipped for %s: %s`,

    SkippedNoSourceTree:
        `[%s] Skipping %s for %s: could not locate a source directory sibling to dist/.`,

    // --- Rule descriptions ---
    MissingSourcemapRuleDescription:
        `Every compiled .js file in the build output must have a corresponding sourcemap (co-located .js.map or //# sourceMappingURL). Missing sourcemaps prevent source-to-compiled verification during security review.`,

    PathLeakageRuleDescription:
        `Sourcemap sources[] entries must be relative paths. Absolute paths leak developer environment details (usernames, filesystem layout) into shipped artifacts.`,

    InvalidSourceReferencesRuleDescription:
        `Every file referenced by a sourcemap sources[] entry (that does not have inline sourcesContent) must exist on disk. Missing files indicate tampering or an incomplete submission.`,

    VlqIntegrityRuleDescription:
        `Sourcemap "mappings" field must be valid Base64 VLQ and reference in-range source/name indices. Malformed mappings signal a fabricated or corrupted sourcemap.`,

    SourceContentVerificationRuleDescription:
        `AST-based verification that the compiled JS actually traces back to the submitted source. Parses compiled output with @babel/parser, collects significant AST nodes, and checks each has a sourcemap mapping into a source file present on disk. Also enforces byte-equal sourcesContent, a virtual-source ratio cap, an AST type-mismatch threshold, and flags dangerous API patterns in unmapped regions.`,

    CoverageAnalysisRuleDescription:
        `Character-level coverage analysis (informational). Flags per-line unmapped regions of 50+ chars and raises a cumulative finding when more than 2% of the compiled file (line-1 preamble discounted up to 150 chars) has no sourcemap coverage.`,

    StructuralCoherenceRuleDescription:
        `Structural coherence checks on sourcemap tokens (informational). Flags out-of-bounds mappings, sample-based whitespace/comment-only mappings above 80%, and cross-file jump ratios above 50% on consecutive same-line tokens.`,

    TokenConsistencyRuleDescription:
        `Token-type consistency checks on sampled sourcemap tokens (informational). Every 20th mapping is compared between compiled and source positions; verifies names[] entries exist near the claimed source position (±3 col tolerance); flags scores below 85% (warning) and below 70% (suspicious).`,

    // --- Missing sourcemap ---
    MissingSourcemapForFile:
        `No sourcemap found for %s. Expected a co-located .js.map or a //# sourceMappingURL comment.`,

    OrphanJsWithDangerousApi:
        `Orphan JS file (no sourcemap) contains dangerous API pattern(s): %s. This looks like unmapped/injected code rather than a bundler runtime.`,

    // --- Path leakage ---
    PathLeakageFinding:
        `Sourcemap references an absolute local path: "%s". Sources should be relative to protect developer environment details.`,

    // --- Invalid source references ---
    SourceFileDoesNotExist:
        `Sourcemap references a source file that does not exist on disk: "%s" (resolved to %s).`,

    // --- VLQ integrity ---
    SourcemapNotValidJson:
        `Sourcemap is not valid JSON: %s`,

    SourcemapMissingMappings:
        `Sourcemap is missing a string "mappings" field.`,

    SourcemapMissingSourcesArray:
        `Sourcemap is missing a "sources" array.`,

    VlqDecodingFailed:
        `Sourcemap "mappings" field failed VLQ decoding: %s`,

    SegmentSourceIndexOutOfRange:
        `Sourcemap segment at line %d, segment %d references source index %d but sources length is %d.`,

    SegmentNameIndexOutOfRange:
        `Sourcemap segment at line %d, segment %d references name index %d but names length is %d.`,

    // --- Source content verification ---
    SourceContentSourcemapNotJson:
        `Sourcemap is not valid JSON: %s`,

    SourceContentSourcemapUnloadable:
        `Sourcemap could not be loaded for AST verification: %s`,

    SourceContentReferencesUnknownSource:
        `Sourcemap references source "%s" (normalized "%s") which is not present in the submitted source tree.`,

    SourceContentMissingInline:
        `Sourcemap source "%s" is missing inline sourcesContent — required for byte-equal verification against the submitted source.`,

    SourceContentBytewiseMismatch:
        `Sourcemap sourcesContent for "%s" differs from the submitted source file (byte-equal check).`,

    SourceContentExcessiveVirtualSources:
        `Excessive virtual sources: %s%% of %d sources are virtual (webpack/vite/unknown). Threshold is %d%%; potential Layer-1 bypass attempt.`,

    SourceContentCompiledParseFailed:
        `Compiled JS failed to parse for AST verification: %s`,

    SourceContentCoverageBelowThreshold:
        `Sourcemap coverage %s%% is below threshold %d%% (%d/%d significant AST nodes mapped). Compiled JS may include code not present in submitted source.`,

    SourceContentUnmappedNode:
        `Unmapped %s at %d:%d — "%s"`,

    SourceContentTypeMismatchRatio:
        `AST type-mismatch ratio %s%% meets or exceeds %s%% threshold (%d/%d mapped nodes have incompatible source AST types). Mappings may be fabricated.`,

    SourceContentTypeMismatchDetail:
        `Type mismatch: %s`,

    SourceContentDangerousUnmapped:
        `Unmapped %s at %d:%d contains a dangerous API pattern: "%s"`,

    SourceContentOrphanSources:
        `%d mapped AST node source(s) not present in the submitted source tree: %s`,

    // --- Coverage analysis ---
    CoverageUnmappedRegion:
        `Unmapped region on line %d cols %d..%d (%d chars) — no sourcemap coverage.`,

    CoverageExcessiveCumulative:
        `Excessive cumulative unmapped content: %s%% of %d chars are unmapped (line-1 preamble discounted). Threshold is %s%%.`,

    // --- Structural coherence ---
    CoherenceBoundsSummary:
        `%d sourcemap mapping(s) point out of bounds of the referenced source file.`,

    CoherenceBoundsDetail:
        `Out-of-bounds: "%s" claimed line %d:%d but file has %d line(s).`,

    CoherenceWhitespaceSuspicious:
        `%s%% of sampled mappings point to whitespace or comments (%d/%d). Threshold is %s%%; sourcemap tokens may be fabricated to satisfy coverage without pointing at real code.`,

    CoherenceCrossFileJumpsSuspicious:
        `Cross-file jump ratio %s exceeds %s: majority of consecutive tokens on the same generated line jump between source files, which is unusual for real bundler output.`,

    // --- Token consistency ---
    TokenConsistencySuspicious:
        `Token type consistency %s%% is below suspicious threshold %s%% (%d/%d sampled tokens agree between compiled and source positions). Sourcemap tokens appear fabricated.`,

    TokenConsistencyBelowWarning:
        `Token type consistency %s%% is below expected threshold %s%% (%d/%d sampled tokens agree between compiled and source positions).`,

    TokenNameMismatchSummary:
        `%d sourcemap name(s) do not exist at the claimed source position (±%d col tolerance).`,

    TokenNameMismatchDetail:
        `Name mismatch: expected "%s" at %s:%d:%d, found "%s".`
};

/**
 * getMessage - Convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}
