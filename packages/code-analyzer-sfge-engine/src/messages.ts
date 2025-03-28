import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG : { [key: string]: string } = {
    ConfigOverview:
        `SFGE ENGINE CONFIGURATION\n` +
        `This engine is in Developer Preview and is subject to change.\n` +
        `To learn more about this configuration, visit:\n` +
        `  [PLACEHOLDER LINK]`,

    ConfigFieldDescription_disable_limit_reached_violations:
        `Whether to prevent 'sfge' from throwing LimitReached violations for complex paths.\n` +
        `By default, Salesforce Graph Engine attempts to detect complex paths that might cause OutOfMemory errors,\n` +
        `and throws LimitReached violations for these paths to continue evaluating other paths safely. The allowed\n` +
        `complexity is dynamically calculated based on the max Java heap size available, but in some cases you may\n` +
        `desire to disable this check in addition to increasing java_max_heap_size.`,

    ConfigFieldDescription_java_max_heap_size:
        `Specifies the maximum size (in bytes) of the Java heap. The specified value is appended to the '-Xmx' Java\n` +
        `command option. The value must be a multiple of 1024, and greater than 2MB. Append the letter 'k' or 'K' to\n` +
        `indicate kilobytes, m or M to indicate megabytes, and g or G to indicate gigabytes. If unspecified, or specified\n` +
        `as null, then the JVM will dynamically choose a default value at runtime based on system configuration.`,

    ConfigFieldDescription_java_thread_count:
        `Specifies the number of Java threads available for parallel execution. Increasing the thread count allows for\n` +
        `Salesforce Graph Engine to evaluate more paths at the same time.`,

    ConfigFieldDescription_java_thread_timeout:
        `Specifies the maximum time (in milliseconds) a specific Java thread may execute before Salesforce Graph Engine\n` +
        `issues a Timeout violation.`,

    DeveloperPreviewRuleNotification:
        `This rule is in "Developer Preview" and is subject to change. %s`,

    UnsupportedEngineName:
        `The SfgeEnginePlugin does not support an engine with the name '%s'.`,

    InvalidConfigValue:
        `The '%s' configuration value is invalid. %s`,

    InsufficientMemorySpecified:
        `It must specify >=2MB`,

    InvalidMemoryMultiple:
        `It must be divisible by 1024`,

    WorkspaceAppearsIncomplete:
        `Specified workspace is missing %d possibly-relevant file(s) from the folder %s. Salesforce Graph Engine may be unable to create a complete graph of your project without all apex files included in your workspace. This may result in incomplete or incorrect results.`,

    LoggingToFile:
        `Invoking SFGE's %s command. Logs being written to %s.`,

    ViolationLocationFudged:
        `Fudged a violation's location for compatibility.\n` +
        `  Before: %s\n` +
        `  After: %s\n`,

    debug_sfgeInfoLog:
        `%s`,

    debug_sfgeMetaInfoCollected:
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
