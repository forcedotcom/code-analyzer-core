import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    ConfigOverview:
        `SFGE ENGINE CONFIGURATION\n` +
        `This engine is in Developer Preview and is subject to change.\n` +
        `To learn more about this configuration, visit:\n` +
        `  [PLACEHOLDER LINK]`,

    DeveloperPreviewRuleNotification:
        `This rule is in "Developer Preview" and is subject to change. %s`,

    UnsupportedEngineName:
        `The SfgeEnginePlugin does not support an engine with the name '%s'.`,

    WorkspaceAppearsIncomplete:
        `Specified workspace is missing %d possibly-relevant file(s) from the folder %s. Salesforce Graph Engine may be unable to create a complete graph of your project without all apex files included in your workspace. This may result in incomplete or incorrect results.`,

    LoggingToFile:
        `SFGE execution logs being written to %s.`,

    debug_sfgeInfoLog:
        `%s`,

    info_sfgeMetaInfoCollected:
        `Loaded %s: [ %s ]`,

    progress_sfgeFinishedCompilingFiles:
        `Compiled %s files.`,

    progress_sfgeStartedBuildingGraph:
        `Building graph.`,

    progress_sfgeFinishedBuildingGraph:
        `Added all compilation units to graph.`,

    progress_sfgePathEntryPointsIdentified:
        `Identified %s path entry point(s).`,

    progress_sfgeViolationsInPathProgress:
        `Detected %s violation(s) from %s path(s) on %s/%s entry point(s).`,

    progress_sfgeCompletedPathAnalysis:
        `Overall, analyzed %s path(s) from %s entry point(s). Detected %s violation(s).`,

    warning_sfgeWarnLog:
        `%s`,

    warning_multipleMethodTargetMatches:
        `Total of %s methods in file %s matched name #%s`,

    warning_noMethodTargetMatches:
        `No methods in file %s matched name #%s()`,

    error_external_sfgeErrorLog:
        `%s`,

    error_external_sfgeIncompleteAnalysis:
        `Salesforce Graph Engine encountered an error and couldn't complete analysis: %s`
}

/**
 * getMessage - This is the convenience function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}