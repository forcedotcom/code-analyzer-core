const messageCatalog : { [key: string]: string } = {
    EngineFromFutureApiDetected:
        'The following engines use the engine api version %d: %s.\n' +
        'This version of Code Analyzer only has knowledge of the %d engine api.\n' +
        'Therefore some capabilities from these engines may not fully work with this version of Code Analyzer.',

    DuplicateEngine:
        'Failed to add engine with name "%s" because an engine with this name has already been added to Code Analyzer.',

    EngineNameContradiction:
        'Failed to add engine with name "%s" because its getName() method returns a different name of "%s".',

    UnexpectedEngineErrorRuleDescription:
        'This rule reports a violation when an unexpected error occurs from engine "%s".',

    UnexpectedEngineErrorViolationMessage:
        'The engine with name "%s" threw an unexpected error: %s',

    PluginErrorFromGetAvailableEngineNames:
        `Failed to add engine plugin. The plugin's getAvailableNames method threw an error:\n%s`,

    PluginErrorFromCreateEngine:
        `Failed to create engine with name "%s". The plugin's createEngine method threw an error:\n%s`,

    FailedToDynamicallyLoadModule:
        'Failed to dynamically load module "%s". Error: %s',

    FailedToDynamicallyAddEnginePlugin:
        'Failed to dynamically add engine plugin from module "%s" because the module does not seem to export a "createEnginePlugin" function.',

    EngineAdded:
        'Engine with name "%s" was added to Code Analyzer.',

    ConfigFileDoesNotExist:
        'The specified configuration file "%s" does not exist.',

    ConfigFileExtensionUnsupported:
        'The specified configuration file "%s" has an unsupported file extension. Supported extensions are: %s',

    ConfigContentFailedToParse:
        'Failed to parse the configuration content. Error:\n%s',

    ConfigContentNotAnObject:
        'The configuration content is invalid since it is of type %s instead of type object.',

    ConfigValueMustBeOfType:
        'The %s configuration value must be of type %s instead of type %s.',

    ConfigValueNotAValidSeverityLevel:
        'The %s configuration value must be one of the following: %s. Instead received: %s',

    ConfigValueNotAValidStringArray:
        'The %s configuration value must an array of strings. Instead received: %s',

    ConfigValueFolderMustExist:
        'The folder specified by the %s configuration value does not exist: %s',

    ConfigValueMustBeFolder:
        'The %s configuration value is not a folder: %s',

    ConfigValueMustBeAbsolutePath:
        'The %s configuration value must be provided as an absolute path location. Please change the value to: %s',

    RulePropertyOverridden:
        'The %s value of rule "%s" of engine "%s" was overridden according to the specified configuration. The old value of %s was replaced with the new value of %s.',

    FileOrFolderDoesNotExist:
        'The file or folder "%s" does not exist.',

    AtLeastOneFileOrFolderMustBeIncluded:
        'At least one file or folder must be included.',

    PathStartPointFileDoesNotExist:
        'The value "%s" is not a valid path starting point since the file "%s" does not exist.',

    PathStartPointWithMethodMustNotBeFolder:
        'The value "%s" is not a valid path starting point since "%s" is a folder instead of a file.',

    InvalidPathStartPoint:
        `The value "%s" is not a valid path starting point. Expected value to be of the format "<fileOrFolder>", "<file>#<methodName>", or "<file>#<methodName1>;<methodName2>;...".`,

    PathStartPointMustBeInsideWorkspace:
        'The specified path starting point of "%s" does not that exists underneath any of the specified paths: %s',

    RunningWithRunOptions:
        'Running with the following run options: %s',

    RunningEngineWithRules:
        'Running engine "%s" with the following rules: %s',

    RuleDoesNotExistInSelection:
        'No rule with name "%s" and engine "%s" exists among the selected rules.',

    EngineRunResultsMissing:
        'Could to get results for engine "%s" since they are missing from the overall run results. Most likely the engine did not run.',

    EngineReturnedMultipleRulesWithSameName:
        'Engine failure. The engine "%s" returned more than one rule with the name "%s".',

    EngineReturnedViolationForUnselectedRule:
        'Engine failure. The engine "%s" returned a violation for rule "%s" which was not selected.',

    EngineReturnedViolationWithInvalidPrimaryLocationIndex:
        'Engine failure. The engine "%s" returned a violation for rule "%s" that contains an out of bounds primary location index value of %d. Expected a non-negative integer that is less than %d.',

    EngineReturnedViolationWithCodeLocationFileThatDoesNotExist:
        'Engine failure. The engine "%s" returned a violation for rule "%s" that contains a code location with a file that does not exist: %s',

    EngineReturnedViolationWithCodeLocationFileAsFolder:
        'Engine failure. The engine "%s" returned a violation for rule "%s" that contains a code location with a folder instead of a file: %s',

    EngineReturnedViolationWithCodeLocationWithInvalidLineOrColumn:
        'Engine failure. The engine "%s" returned a violation for rule "%s" that contains a code location with an invalid %s value: %d',

    EngineReturnedViolationWithCodeLocationWithEndLineBeforeStartLine:
        'Engine failure. The engine "%s" returned a violation for rule "%s" that contains a code location with the endLine %d before the startLine %d.',

    EngineReturnedViolationWithCodeLocationWithEndColumnBeforeStartColumnOnSameLine:
        'Engine failure. The engine "%s" returned a violation for rule "%s" that contains a code location with the endLine equal to the startLine and the endColumn %d before the startColumn %d.',

}

/**
 * getMessage - This is the main function to get a message out of the message catalog.
 * @param msgId - The message identifier
 * @param args - The arguments that will fill in the %s and %d markers.
 */
export function getMessage(msgId: string, ...args: (string | number)[]): string {
    const messageTemplate = messageCatalog[msgId];
    if (messageTemplate === undefined) {
        throw new Error(`Message with id "${msgId}" does not exist in the message catalog.`);
    }
    const argsLength = args.length; // Capturing length here because once we shift, it'll change.
    let replaceCount = 0;
    const message: string = messageTemplate.replace(/%[sd]/g, (match) => {
        replaceCount++;
        return String(args.shift() ?? match)
    });
    if (replaceCount != argsLength) {
        throw new Error(`Incorrect length of args for the call to getMessage('${msgId}',...args).\n`
            + `Expected length: ${replaceCount}. Actual length: ${argsLength}.`);
    }
    return message;
}