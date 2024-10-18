/**
 * Message Catalog Object
 *   Each message in a message catalog may contain variables denoted by %s and %d.
 *   For example:
 *     const MESSAGE_CATALOG: MessageCatalog = {
 *         MyMessage1: `This has one variable: '%s'`,
 *         MyMessage2: `This has two variables, '%s' and %d, in its message.`
 *     }
 */
export type MessageCatalog = { [key: string]: string };

/**
 * getMessageFromCatalog - Utility function to get a message out of a MessageCatalog object.
 * @param messageCatalog - The message catalog
 * @param msgId - The message identifier
 * @param args - The variable arguments that will fill in the %s and %d markers.
 */
export function getMessageFromCatalog(messageCatalog: MessageCatalog, msgId: string, ...args: (string | number)[]): string {
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
        throw new Error(`Incorrect number of variables supplied to the message '${msgId}' in the message catalog.\n`
            + `Expected amount: ${replaceCount}. Actual amount: ${argsLength}.`);
    }
    return message;
}

export const SHARED_MESSAGE_CATALOG: MessageCatalog = {
    ConfigValueMustBeOfType:
        `The '%s' configuration value must be of type '%s' instead of type '%s'.`,

    ConfigValueMustMatchRegExp:
        `The '%s' configuration value is invalid. The string did not match the regular expression pattern: %s`,

    ConfigValueNotAValidSeverityLevel:
        `The '%s' configuration value must be one of the following: %s. Instead received: %s`,

    ConfigPathValueDoesNotExist:
        `The '%s' configuration value is invalid. The path '%s' does not exist.`,

    ConfigFileValueMustNotBeFolder:
        `The '%s' configuration value is invalid. The value '%s' must be a file instead of a folder`,

    ConfigFolderValueMustNotBeFile:
        `The '%s' configuration value is invalid. The value '%s' must be a folder instead of a file.`
}

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(SHARED_MESSAGE_CATALOG, msgId, ...args);
}