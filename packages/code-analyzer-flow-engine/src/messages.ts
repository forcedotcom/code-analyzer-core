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

    SubsequentNodeComment:
        `%s influences %s: %s`,

    WritingFlowLogToFile:
        `The separate Flow Scanner log file, used for debugging purposes only, will be written to: %s`,

    PythonCommandError:
        `The following call to python exited with non-zero exit code.\n` +
        `  Command: %s\n` +
        `  Exit Code: %d\n` +
        `  StdErr:\n%s`,

    // ==== RULE DESCRIPTIONS ====
    CyclicSubflowRuleDescription:
        `This rule detects when a subflow calls a parent flow, creating a cyclic flow. The rule will detect cycles of any depth.`,

    DbInLoopRuleDescription:
        `This rule detects when there are CRUD flow elements within a loop (RecordLookups, RecordCreates, RecordUpdates, RecordDeletes). This rule does not trigger if the CRUD element is in a fault handler. These DB operations should be bulkified by using collections and the "IN" condition. This rule does not follow subflows.`,

    DefaultCopyRuleDescription:
        `This rule detects default names and labels that were auto assigned to elements pasted elements in the flow builder UI. These labels and names should be changed to make the flow comprehensible to maintainers.`,

    HardcodedIdRuleDescription:
        `This rule detects hardcoded IDs within a flow. Hardcoded Ids are a bad practice, and such flows are not appropriate for distribution.`,

    MissingDescriptionRuleDescription:
        `This rule detects elements that contain labels but are missing descriptions. All elements with labels should have accompanying descriptions to make theflow comprehensible to future maintainers.`,

    MissingFaultHandlerRuleDescription:
        `This rule detects when elements that can fire fault events are missingfault handlers. The rule currently detects Create Records, Update Records, Delete Records, Action Calls, and Subflows.`,

    MissingNextValueConnectorRuleDescription:
        `This rule detects Loops without nextValue connectors. Loops should always have nextValue connectors, and lack of one usually signifies developer error when connecting the loop element to other elements.`,

    PreventPassingUserDataIntoElementRuleDescription:
        `Avoid passing user data into Flow Scanner elements in run mode: %s`,

    SameRecordUpdateRuleDescription:
        `This rule detects when an AfterSave record trigger modifies the same record. Record modifications should be done in BeforeSave triggers, not AfterSave triggers. This rule follows subflows, so it will detect if the RecordId is passed to a child flow which then modifies a record with that id.`,

    TriggerCalloutRuleDescription:
        `This rule detects when a trigger performs a callout on the synchronous path. Triggers must be performant and may only contain callouts on async scheduled paths. This rule follows subflows.`,

    TriggerEntryCriteriaRuleDescription:
        `This rule detects when record trigger flows are missing entry criteria. All record trigger flows should have entry criteria specified in the flow trigger definition rather than solely in the flow's own business logic.`,

    TriggerWaitEventRuleDescription:
        `This rule detects when a wait event is reached during trigger execution. Triggers must be performant and cannot contain wait events. For async processing, use scheduled paths within your trigger and async callouts, not wait events. This rule follows subflows.`,

    UnreachableElementRuleDescription:
        `This rule identifies elements that have not been connected to the start element of the flow. Unreachable elements are usually due to incomplete flows or developer error.`,

    UnusedResourceRuleDescription:
        `This rule detects redundant variables that are not used in the flow. This can be a sign of developer error.`
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}