import {ESLintEngineConfig} from "./config";
import {ESLint} from "eslint";
import {BaseConfigFactory} from "./base-config";
import {getMessage} from "./messages";
import {makeStringifiable} from "./utils";
import { indent } from "@salesforce/code-analyzer-engine-api/utils";


export function createESLint(engineConfig: ESLintEngineConfig, baseDirectory: string, userConfigFile?: string, rulesToRun?: Set<string>): ESLintWrapper {
    const baseConfigFactory: BaseConfigFactory = new BaseConfigFactory(engineConfig);
    const eslintOptions: ESLint.Options = {
        cwd: baseDirectory,                      // The base working directory. This must be an absolute path.
        errorOnUnmatchedPattern: false,          // Unless set to false, the eslint.lintFiles() method will throw an error when no target files are found.
        baseConfig: baseConfigFactory.createBaseConfigArray(),
        overrideConfigFile: userConfigFile ?? true,  // Oddly enough ESLint documents that "true" means don't go auto looking for a config file (which we set if we didn't find one ourselves)
    };
    if (rulesToRun) {
        // Using a ruleFilter ensures that we only run the rules that the user has selected. This approach is much
        // cleaner than adding in another overrideConfig that turns off rules and saves us on some post-processing.
        eslintOptions.ruleFilter = (arg: {ruleId: string}) => rulesToRun.has(arg.ruleId);
    }
    return new ESLintWrapper(eslintOptions);
}


export class ESLintWrapper extends ESLint {
    // Exposed for testing and debugging purposes only
    readonly _options: ESLint.Options;

    constructor(options: ESLint.Options) {
        try {
            super(options);
            this._options = options;
        } catch (error) /* istanbul ignore next */ {
            throw wrapESLintError(error, 'ESLint', options);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    override async calculateConfigForFile(filePath: string): Promise<any> {
        try {
            return await super.calculateConfigForFile(filePath);
        } catch (error) {
            throw await wrapESLintError(error, `ESLint.calculateConfigForFile("${filePath}")`, this._options);
        }

    }

    override async isPathIgnored(filePath: string): Promise<boolean> {
        try {
            return await super.isPathIgnored(filePath);
        } catch (error) { /* istanbul ignore next */
            throw await wrapESLintError(error, `ESLint.isPathIgnored("${filePath}")`, this._options);
        }
    }
}

class WrappedError extends Error {}

async function wrapESLintError(rawError: unknown, fcnCallStr: string, options: ESLint.Options): Promise<Error> {
    if (rawError instanceof WrappedError) {
        return rawError; // Prevent wrapping multiple times
    }

    // Before throwing the actual error message, we first want to validate the user's config file in an isolated
    // environment see if it is even valid when run by itself without any other configurations.
    // If not, then we display the simpler error and options.
    if (typeof options.overrideConfigFile === "string") {
        const simpleOptions: ESLint.Options = {overrideConfigFile: options.overrideConfigFile};
        try {
            const rawESLint: ESLint = new ESLint(simpleOptions);
            await rawESLint.calculateConfigForFile('dummy.js');
        } catch (err) {
            rawError = err;
            fcnCallStr = 'ESLint.calculateConfigForFile';
            options = simpleOptions;
        }
    }

    /* istanbul ignore next */
    const rawErrMsg: string = indent(rawError instanceof Error ?
        rawError.stack ?? rawError.message : String(rawError), '  | ');
    const eslintOptionsStr: string = indent(stringifyESLintOptions(options), '    ');
    const wrappedErrMsg: string = rawErrMsg.includes('Cannot redefine plugin') ? // TODO: Maybe with W-18695515 we can manually resolve conflicts
        getMessage('ESLintThrewExceptionWithPluginConflictMessage', fcnCallStr, rawErrMsg, eslintOptionsStr)
        : getMessage('ESLintThrewExceptionWithUnknownMessage', fcnCallStr, rawErrMsg, eslintOptionsStr);
    return new WrappedError(wrappedErrMsg, {cause: rawError});
}


// Since flat configuration contain class instances and other data structures that can have properties that actually
// reference themselves we cannot simply use JSON.stringify. Also, there are a some properties that are noisy. So this
// custom function allows us to convert an ESLint.Options to a string safely.
export function stringifyESLintOptions(options: ESLint.Options): string {
    const replacer: (value: unknown, path: string) => unknown = (value, path) => {
        if (path.endsWith('.plugins') && typeof value === 'object' && value) {
            const plugins: Record<string, ESLint.Plugin> = value as Record<string, ESLint.Plugin>;
            const sanitizedPlugins: Record<string, ESLint.ObjectMetaProperties & {otherProperties: string}> = {};
            for (const key of Object.keys(plugins)) {
                sanitizedPlugins[key] = {
                    meta: {
                        name: plugins[key].meta?.name || plugins[key].name,
                        version: plugins[key].meta?.version || plugins[key].version
                    },
                    otherProperties: '[plugin properties are hidden to keep output brief]'
                }
            }
            return sanitizedPlugins;
        } else if (path.endsWith('.globals')) {
            return "[object is hidden to keep output brief]";
        } else if (path.endsWith('.adapters') && Array.isArray(value)) {
            return "[array is hidden to keep output brief]";
        }
        return value;
    };
    const serializableOptions: object = makeStringifiable(options, replacer) as object;
    return JSON.stringify(serializableOptions, null, 2);
}
