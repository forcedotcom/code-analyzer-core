import * as semver from "semver";
import {pathToFileURL} from 'url';
import {ESLintEngineConfig} from "./config";
import {ESLint, Linter} from "eslint";
import {BaseConfigFactory} from "./base-config";
import {getMessage} from "./messages";
import {makeStringifiable} from "./utils";
import {indent} from "@salesforce/code-analyzer-engine-api/utils";
import {EngineEventEmitter, LogLevel} from "@salesforce/code-analyzer-engine-api";


export class ESLintOptionsFactory extends EngineEventEmitter {
    async createESLintOptions(engineConfig: ESLintEngineConfig, baseDirectory: string, userConfigFile?: string): Promise<ESLint.Options> {
        const baseConfigFactory: BaseConfigFactory = new BaseConfigFactory(engineConfig);
        const baseConfigArray: Linter.Config[] = baseConfigFactory.createBaseConfigArray();

        let userConfigArray: Linter.Config[] | undefined;
        if (userConfigFile) {
            userConfigArray = await loadUserConfigFile(userConfigFile);
            const resolvedPluginsMap: Map<string, ESLint.Plugin> = this.createResolvedPluginsMap([...baseConfigArray, ...userConfigArray]);
            const baseConfigLabel: string = getMessage('BaseConfigLabel');
            const userConfigLabel: string = getMessage('ConfigFileLabel', userConfigFile);
            this.resolvePluginsFor(baseConfigArray, resolvedPluginsMap, baseConfigLabel, userConfigLabel);
            this.resolvePluginsFor(userConfigArray, resolvedPluginsMap, userConfigLabel, baseConfigLabel);
        }

        return {
            // The base working directory. This must be an absolute path.
            cwd: baseDirectory,

            // Unless set to false, the eslint.lintFiles() method will throw an error when no target files are found.
            errorOnUnmatchedPattern: false,

            // Set our base configuration array
            baseConfig: baseConfigArray,

            // Set the user's configuration array
            overrideConfig: userConfigArray,

            // "true" actually tells ESLint to not auto-detect config files (which we set since we manually process config files)
            overrideConfigFile: true,
        };
    }

    private createResolvedPluginsMap(configArray: Linter.Config[]): Map<string, ESLint.Plugin> {
        const resolvedPluginsMap: Map<string, ESLint.Plugin> = new Map();
        for (const conf of configArray) {
            for (const [pluginRef, plugin] of Object.entries(conf.plugins ?? {})) {
                if (!resolvedPluginsMap.has(pluginRef)) {
                    resolvedPluginsMap.set(pluginRef, plugin);
                } else /* istanbul ignore if */ if (semver.gt(getPluginVersion(plugin), getPluginVersion(resolvedPluginsMap.get(pluginRef)!))) {
                    resolvedPluginsMap.set(pluginRef, plugin);
                }
            }
        }
        return resolvedPluginsMap;
    }

    private resolvePluginsFor(configArray: Linter.Config[], resolvedPluginsMap: Map<string, ESLint.Plugin>, configLabel1: string, configLabel2: string): void {
        for (const conf of configArray) {
            for (const [pluginRef, plugin] of Object.entries(conf.plugins ?? {})) {
                const resolvedPlugin: ESLint.Plugin = resolvedPluginsMap.get(pluginRef)!;
                if (plugin !== resolvedPlugin) {
                    conf.plugins![pluginRef] = resolvedPlugin;
                    this.emitLogEvent(LogLevel.Debug, getMessage('ConfigResolutionReplacedPlugin',
                        pluginRef, toLabel(plugin, pluginRef), configLabel1, toLabel(resolvedPlugin, pluginRef),
                        configLabel2, configLabel1, toLabel(resolvedPlugin, pluginRef)));
                }
            }
        }
    }
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

    override async lintFiles(patterns: string | string[]): Promise<ESLint.LintResult[]> {
        try {
            return await super.lintFiles(patterns);
        } catch (error) { /* istanbul ignore next */
            throw await wrapESLintError(error, `ESLint.lintFiles`, this._options);
        }
    }
}

class WrappedError extends Error {}

async function wrapESLintError(rawError: unknown, fcnCallStr: string, options: ESLint.Options): Promise<Error> {
    if (rawError instanceof WrappedError) {
        return rawError; // Prevent wrapping multiple times
    }

    // Before throwing the actual error message, we first want to validate the user's config in an isolated
    // environment see if it is even valid when run by itself without any other configurations.
    // If not, then we display the simpler error and options.
    if (options.overrideConfig) {
        const simpleOptions: ESLint.Options = {overrideConfig: options.overrideConfig, overrideConfigFile: true};
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
    const rawErrMsg: string = indent(rawError instanceof Error ? rawError.stack ?? rawError.message : String(rawError), '  | ');
    const eslintOptionsStr: string = indent(stringifyESLintOptions(options));
    const wrappedErrMsg: string = getMessage('ESLintThrewExceptionWithUnknownMessage', fcnCallStr, rawErrMsg, eslintOptionsStr);
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

async function loadUserConfigFile(userConfigFile: string): Promise<Linter.Config[]> {
    const userConfigArray = await dynamicallyImport(userConfigFile);
    return Array.isArray(userConfigArray) ? userConfigArray : [userConfigArray];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dynamicallyImport(absJavaScriptFilePath: string): Promise<any> {
    // To avoid issues with dynamically importing absolute paths on Windows, we need to convert to url with pathToFileURL.
    const moduleUrl: string = pathToFileURL(absJavaScriptFilePath).href;
    const pluginModule = await import(moduleUrl);
    /* istanbul ignore next */
    return pluginModule.default ?? pluginModule; // Return the default export if it exists, otherwise the module itself
}

function getPluginName(plugin: ESLint.Plugin, pluginRef: string): string {
    /* istanbul ignore next */
    return plugin.meta?.name ?? plugin.name ?? pluginRef;
}

function getPluginVersion(plugin: ESLint.Plugin): string {
    /* istanbul ignore next */
    return plugin.meta?.version ?? plugin.version ?? '0.0.0';
}

function toLabel(plugin: ESLint.Plugin, pluginRef: string): string {
    return `${getPluginName(plugin, pluginRef)}@${getPluginVersion(plugin)}`;
}
