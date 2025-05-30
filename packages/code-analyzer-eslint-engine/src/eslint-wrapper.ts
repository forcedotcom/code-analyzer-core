import {ESLintEngineConfig} from "./config";
import {ESLint} from "eslint";
import {BaseConfigFactory} from "./base-config";
import {getMessage} from "./messages";
import {makeStringifiable} from "./utils";
import { indent } from "@salesforce/code-analyzer-engine-api/utils";


export function createESLint(engineConfig: ESLintEngineConfig, baseDirectory: string, rulesToRun?: Set<string>): ESLintWrapper {
    const baseConfigFactory: BaseConfigFactory = new BaseConfigFactory(engineConfig);
    const eslintOptions: ESLint.Options = {
        cwd: baseDirectory,                      // The base working directory. This must be an absolute path.
        errorOnUnmatchedPattern: false,          // Unless set to false, the eslint.lintFiles() method will throw an error when no target files are found.
        baseConfig: baseConfigFactory.createBaseConfigArray(),
        overrideConfigFile: true,  //TODO: Will Add in Users Config File
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
        } catch (error) {
            throw wrapESLintError(error, 'ESLint', options);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    override async calculateConfigForFile(filePath: string): Promise<any> {
        try {
            return await super.calculateConfigForFile(filePath);
        } catch (error) {
            throw wrapESLintError(error, `ESLint.calculateConfigForFile(${filePath})`, this._options);
        }

    }

    override async isPathIgnored(filePath: string): Promise<boolean> {
        try {
            return await super.isPathIgnored(filePath);
        } catch (error) { /* istanbul ignore next */
            throw wrapESLintError(error, `ESLint.isPathIgnored(${filePath})`, this._options);
        }
    }
}


function wrapESLintError(rawError: unknown, fcnCallStr: string, options: ESLint.Options): Error {
    const rawErrMsg: string = rawError instanceof Error ? rawError.message : /* istanbul ignore next */
        String(rawError);
    const eslintOptionsStr: string = indent(stringifyESLintOptions(options), '    |');
    const wrappedErrMsg: string = rawErrMsg.includes('conflict') ? // TODO: See if this conflict case ever happens anymore
        getMessage('ESLintThrewExceptionWithPluginConflictMessage', fcnCallStr, rawErrMsg, eslintOptionsStr)
        : getMessage('ESLintThrewExceptionWithUnknownMessage', fcnCallStr, rawErrMsg, eslintOptionsStr);
    return new Error(wrappedErrMsg, {cause: rawError});
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
