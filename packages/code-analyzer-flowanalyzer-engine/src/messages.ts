import { getMessageFromCatalog } from '@salesforce/code-analyzer-engine-api';

const MESSAGE_CATALOG: { [key: string]: string } = {
    UnsupportedEngineName:
        `The FlowAnalyzerEnginePlugin does not support an engine with name '%s'.`,

    ConfigOverview:
        `Configuration for the Flow Analyzer engine. Authentication uses the Salesforce CLI session for the required --target-org value.`,

    ConfigFieldDescription_target_org:
        `Target Salesforce org alias or username. Required. Typically set by the CLI --target-org flag. Flow Analyzer never falls back to the default org.`,

    ConfigFieldDescription_api_timeout_ms:
        `Maximum time to wait for Flow Analyzer API responses, in milliseconds. Default: 300000 (5 minutes).`,

    ConfigFieldDescription_api_version:
        `Salesforce REST API version used for Connect calls. Default: 68.0.`,

    ConfigFieldDescription_rules_path:
        `Connect path for the rules catalog endpoint. Default: /flowbuilder/flow-analyzer/rules.`,

    ConfigFieldDescription_analyze_path:
        `Connect path for the analyze endpoint. Default: /flowbuilder/flow-analyzer/analysis/metadata-archive.`,

    ConfigFieldDescription_max_file_count:
        `Maximum number of Flow files that may be submitted in one analyze request.`,

    ConfigFieldDescription_max_file_bytes:
        `Maximum size in bytes of a single Flow file.`,

    ConfigFieldDescription_max_payload_bytes:
        `Maximum total decoded payload size in bytes for one analyze request.`,

    MissingTargetOrg:
        `Flow Analyzer requires an explicit target org. Set '%s' or pass --target-org <org-alias>.`,

    ConfigValueMustBePositive:
        `The value of '%s' must be greater than 0.`,

    OrgNotFound:
        `We couldn't find the org '%s', or it isn't authenticated.\n\nRun sf org list to see available orgs.\nRun sf org login web --alias %s to authenticate a new org.`,

    AuthNotInitialized:
        `Auth service not initialized. Call initialize() first.`,

    AccessTokenUnavailable:
        `Access token not available for the selected org.`,

    NoFlowFiles:
        `No Flow files have been targeted in the workspace.`,

    CatalogUnavailable:
        `Code Analyzer skipped Flow Analyzer because the rule catalog could not be retrieved from the target org: %s`,

    CatalogUnavailableRemediation:
        `Confirm the org is on API 266+ with GET /flowbuilder/flow-analyzer/rules, the session is valid, and gate com.salesforce.interaction.enableflowanalyzerapi is enabled.`,

    AnalyzeFailedRemediation:
        `Confirm POST /flowbuilder/flow-analyzer/analysis/metadata-archive is available on the target org and retry.`,

    CatalogMalformed:
        `Flow Analyzer received a malformed rule catalog from the target org.`,

    AnalyzeFailed:
        `Flow Analyzer analyze request failed: %s`,

    AnalyzeMalformed:
        `Flow Analyzer received a malformed analyze response from the target org.`,

    UnknownRuleInFindings:
        `Flow Analyzer returned finding for unknown rule '%s'. The engine will not silently drop unknown rules.`,

    PathNotSubmitted:
        `Flow Analyzer returned finding for path '%s', which was not submitted.`,

    AbsolutePathRejected:
        `Flow Analyzer rejected absolute path '%s'. Submit workspace-relative Flow paths only.`,

    TraversalPathRejected:
        `Flow Analyzer rejected path '%s' because it contains a parent-directory segment.`,

    SymlinkRejected:
        `Flow Analyzer rejected '%s' because symbolic links are not allowed.`,

    DuplicatePathRejected:
        `Flow Analyzer rejected duplicate or case-colliding path '%s'.`,

    UnsupportedFileType:
        `Flow Analyzer rejected unsupported file '%s'. Only .flow and .flow-meta.xml files are allowed.`,

    ExcessiveFileCount:
        `Flow Analyzer rejected the workspace because it contains %d Flow files, which exceeds the limit of %d.`,

    OversizedFile:
        `Flow Analyzer rejected '%s' because it is %d bytes, which exceeds the per-file limit of %d.`,

    OversizedPayload:
        `Flow Analyzer rejected the request because the total payload is %d bytes, which exceeds the limit of %d.`,

    HttpError:
        `Flow Analyzer request to '%s' failed with HTTP %d: %s`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}
