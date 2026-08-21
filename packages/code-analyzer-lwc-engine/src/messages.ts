import { getMessageFromCatalog } from "@salesforce/code-analyzer-engine-api";

const MESSAGE_CATALOG: { [key: string]: string } = {
    UnsupportedEngineName:
        `The LwcEnginePlugin does not support an engine with name '%s'.`,

    CompileFailed:
        `Failed to compile %s: %s`,

    UnexpectedThrowDuringCompile:
        `Unexpected error while compiling %s: %s`,

    PlatformCompilerUnavailable:
        `Platform compiler unavailable for %s (open-source path still covers codes 1001-1213): %s`,
};

export function getMessage(msgId: string, ...args: (string | number)[]): string {
    return getMessageFromCatalog(MESSAGE_CATALOG, msgId, ...args);
}
