import {getMessageFromCatalog} from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG: {[key: string]: string} = {
    ConfigOverview:
        `FLOW SCANNER ENGINE CONFIGURATION\n` +
        `To learn more about this configuration, visit:\n` +
        `  https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/engine-flow.html#flow-scanner-configuration-reference`,

    ConfigFieldDescription_python_command:
        `Indicates the specific Python command to use for the 'Flow Scanner' engine.\n` +
        `May be provided as the name of a command that exists on the path, or an absolute file path location.\n` +
        `If unspecified, or specified as null, then an attempt will be made to automatically discover a Python command from your environment.`,

    UnsupportedEngineName:
        `The FlowScannerEnginePlugin does not support an engine with name '%s'.`,

    CouldNotParseRuleDescriptions:
        `Unexpected error: Could not parse rule descriptions from Flow Scanner output: %s`,

    ResultsFileNotValidJson:
        `Unexpected error: Results file contents are not a valid JSON: %s`,

    CouldNotParseExecutionResults:
        `Unexpected error: Could not parse results from %s`,

    UserSpecifiedPythonCommandProducedUnrecognizableVersion:
        `The '%s' configuration value is invalid. The command '%s' does not seem to be a recognizable version of Python.`,

    UserSpecifiedPythonCommandProducedError:
        `The '%s' configuration value is invalid. When attempting to find the version of command '%s', an error was thrown: %s`,

    UserSpecifiedPythonBelowMinimumVersion:
        `The '%s' configuration value is invalid. The command '%s' specifies Python v%s, which is below minimum supported version v%s.`,

    CouldNotLocatePython:
        `Could not locate a Python v%s+ install using any of the following: %s.\n` +
        `If you have python installed, specify the command in your Code Analyzer configuration as the value of property '%s'.\n` +
        `If you choose not to install python, you may disable the '%s' engine in your Code Analyzer configuration by setting 'engines.%s.disable_engine' to true.`,

    FirstNodeComment:
        `%s: %s`,

    ConsolidatedRuleDescription:
        `Avoid passing user data into Flow Scanner elements in run mode: %s`,

    SubsequentNodeComment:
        `%s influences %s: %s`,

    WritingFlowLogToFile:
        `The separate Flow Scanner log file, used for debugging purposes only, will be written to: %s`,

    PythonCommandError:
        `The following call to python exited with non-zero exit code.\n` +
        `  Command: %s\n` +
        `  Exit Code: %d\n` +
        `  StdErr:\n%s`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}