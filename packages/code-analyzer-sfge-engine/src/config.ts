import {
    ConfigDescription,
    ConfigValueExtractor,
} from "@salesforce/code-analyzer-engine-api";
import {indent} from '@salesforce/code-analyzer-engine-api/utils';
import {getMessage} from "./messages";
import {JavaVersionIdentifier} from "./java-version-identifier";
import path from "node:path";
import {SemVer} from "semver";

const DEFAULT_JAVA_COMMAND: string = 'java';
const MINIMUM_JAVA_VERSION: string = '11.0.0';

export type SfgeEngineConfig = {
    // Indicates the specific "java" command to use for the 'sfge' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/path/to/jdk/openjdk_11.0.17.0.1_11.60.54_x64/bin/java'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a 'java' command from your environment.
    java_command: string;
    disable_limit_reached_violations: boolean;
    java_max_heap_size?: string;
    java_thread_count: number;
    java_thread_timeout: number;
}

export const DEFAULT_SFGE_ENGINE_CONFIG: SfgeEngineConfig = {
    java_command: DEFAULT_JAVA_COMMAND,
    disable_limit_reached_violations: false,
    java_max_heap_size: undefined,
    java_thread_count: 4,
    java_thread_timeout: 900000
};

export const SFGE_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        // Whether to prevent 'sfge' from throwing LimitReached violations for complex paths.
        // By default, Salesforce Graph Engine attempts to detect complex paths that might cause OutOfMemory errors,
        // and throws LimitReached violations for these paths to continue evaluating other paths safely. The allowed
        // complexity is dynamically calculated based on the max Java heap size available, but in some cases you may
        // desire to disable this check in addition to increasing java_max_heap_size.
        disable_limit_reached_violations: {
            descriptionText: getMessage('ConfigFieldDescription_disable_limit_reached_violations'),
            valueType: "boolean",
            defaultValue: DEFAULT_SFGE_ENGINE_CONFIG.disable_limit_reached_violations
        },
        // Indicates the specific 'java' command associated with the JRE or JDK to use for the 'sfge' engine.
        // May be provided as the name of a command that exists on the path, or an absolute file path location.
        // If unspecified, or specified as null, then an attempt will be made to automatically discover a 'java' command from your environment.
        java_command: {
            descriptionText: getMessage('ConfigFieldDescription_java_command'),
            valueType: "string",
            defaultValue: null // Using null for doc and since it indicates that the value is calculated based on the environment
        },
        // Specifies the maximum size (in bytes) of the Java heap. The specified value is appended to the '-Xmx' Java
        // command option. The value must be a multiple of 1024, and greater than 2MB. Append the letters 'k', 'K', 'kb',
        // or 'KB' to indicate kilobytes, 'm', 'M', 'mb', or 'MB' to indicate megabytes, and 'g', 'G', 'gb', or 'GB' to
        // indicate gigabytes. If unspecified, or specified as null, then the JVM will dynamically choose a default value
        // at runtime based on system configuration.
        java_max_heap_size: {
            descriptionText: getMessage('ConfigFieldDescription_java_max_heap_size'),
            valueType: "string",
            defaultValue: null
        },
        // Specifies the number of Java threads available for parallel execution. Increasing the thread count allows for
        // Salesforce Graph Engine to evaluate more paths at the same time.
        java_thread_count: {
            descriptionText: getMessage('ConfigFieldDescription_java_thread_count'),
            valueType: "number",
            defaultValue: DEFAULT_SFGE_ENGINE_CONFIG.java_thread_count
        },
        // Specifies the maximum time (in milliseconds) a specific Java thread may execute before Salesforce Graph Engine
        // issues a Timeout violation.
        java_thread_timeout: {
            descriptionText: getMessage('ConfigFieldDescription_java_thread_timeout'),
            valueType: "number",
            defaultValue: DEFAULT_SFGE_ENGINE_CONFIG.java_thread_timeout
        }
    }
}

const JAVA_HEAP_SIZE_REGEX: RegExp = /^\d+[kmg]?b?$/i;

export async function validateAndNormalizeConfig(cve: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier): Promise<SfgeEngineConfig> {
    cve.validateContainsOnlySpecifiedKeys(['disable_limit_reached_violations', 'java_command', 'java_max_heap_size', 'java_thread_count', 'java_thread_timeout']);
    const sfgeConfigValueExtractor: SfgeConfigValueExtractor = new SfgeConfigValueExtractor(cve, javaVersionIdentifier);
    return {
        java_command: await sfgeConfigValueExtractor.extractJavaCommand(),
        disable_limit_reached_violations: sfgeConfigValueExtractor.extractBooleanValue('disable_limit_reached_violations'),
        java_max_heap_size: sfgeConfigValueExtractor.extractJavaMaxHeapSize(),
        java_thread_count: sfgeConfigValueExtractor.extractNumericValue('java_thread_count'),
        java_thread_timeout: sfgeConfigValueExtractor.extractNumericValue('java_thread_timeout')
    };
}

class SfgeConfigValueExtractor {
    private readonly delegateExtractor: ConfigValueExtractor;
    private readonly javaVersionIdentifier: JavaVersionIdentifier;

    public constructor(delegateExtractor: ConfigValueExtractor, javaVersionIdentifier: JavaVersionIdentifier) {
        this.delegateExtractor = delegateExtractor;
        this.javaVersionIdentifier = javaVersionIdentifier;
    }

    public async extractJavaCommand(): Promise<string> {
        const javaCommand: string | undefined = this.delegateExtractor.extractString('java_command');
        if (!javaCommand) {
            return await this.attemptToAutoDetectJavaCommand();
        }

        try {
            await this.validateJavaCommandContainsValidVersion(javaCommand);
        } catch (err) {
            throw new Error(getMessage('InvalidConfigValue',
                this.delegateExtractor.getFieldPath('java_command'), (err as Error).message));
        }
        return javaCommand;
    }

    private async attemptToAutoDetectJavaCommand(): Promise<string> {
        const commandsToAttempt: string[] = [
            // Environment variables specifying JAVA HOME take precedence (if they exist)
            ...['JAVA_HOME', 'JRE_HOME', 'JDK_HOME'].filter(v => process.env[v]) // only keep vars that have a non-empty defined value
                .map(/* istanbul ignore next */ v => path.join(process.env[v]!, 'bin', 'java')),

            // Attempt to just use the default java command that might be already on the path as a last attempt
            DEFAULT_JAVA_COMMAND
        ];

        const errorMessages: string[] = [];
        for (const possibleJavaCommand of commandsToAttempt) {
            try {
                // Yes we want to have an await statement in a loop in this case since we want to try one at a time
                await this.validateJavaCommandContainsValidVersion(possibleJavaCommand);
                return possibleJavaCommand;
            } catch (err) {
                errorMessages.push((err as Error).message);
            }
        }
        const consolidatedErrorMessages: string = errorMessages.map((msg: string, idx: number) =>
            indent(`Attempt ${idx + 1}:\n${indent(msg)}`, '  | ')).join('\n');
        throw new Error(getMessage('CouldNotLocateJava',
            MINIMUM_JAVA_VERSION,
            consolidatedErrorMessages,
            this.delegateExtractor.getFieldPath('java_command'),
            this.delegateExtractor.getFieldPath('disable_engine')));
    }

    private async validateJavaCommandContainsValidVersion(javaCommand: string): Promise<void> {
        let version: SemVer | null;
        try {
            version = await this.javaVersionIdentifier.identifyJavaVersion(javaCommand);
        } catch (err) {
            /* istanbul ignore next */
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('JavaVersionCheckProducedError', javaCommand, indent(errMsg, '  | ')));
        }
        if (!version) {
            throw new Error(getMessage('UnrecognizableJavaVersion', javaCommand));
        } else if (version.compare(MINIMUM_JAVA_VERSION) < 0) {
            throw new Error(getMessage('JavaBelowMinimumVersion', javaCommand, version.toString(), MINIMUM_JAVA_VERSION));
        }
    }

    public extractJavaMaxHeapSize(): string | undefined {
        const javaMaxHeapSize: string | undefined = this.delegateExtractor.extractString('java_max_heap_size', undefined, JAVA_HEAP_SIZE_REGEX);

        if (!javaMaxHeapSize) {
            return undefined;
        }

        if (javaMaxHeapSize.toLowerCase().endsWith('g') || javaMaxHeapSize.toLowerCase().endsWith('gb')) {
            // A value expressed in gigabytes is always fine.
            return javaMaxHeapSize;
        }
        const numericPortion: number = parseInt(javaMaxHeapSize);
        if (numericPortion < expressTwoMegabytesInRelevantUnit(javaMaxHeapSize)) {
            throw new Error(getMessage(
                'InvalidConfigValue',
                this.delegateExtractor.getFieldPath('java_max_heap_size'),
                getMessage('InsufficientMemorySpecified')
            ));
        }

        const isStrictlyNumeric: boolean = /^\d+b?$/i.test(javaMaxHeapSize);
        if (isStrictlyNumeric && numericPortion % 1024 !== 0) {
            throw new Error(getMessage(
                'InvalidConfigValue',
                this.delegateExtractor.getFieldPath('java_max_heap_size'),
                getMessage('InvalidMemoryMultiple')
            ));
        }
        return javaMaxHeapSize;
    }

    public extractBooleanValue(fieldName: string): boolean {
        return this.delegateExtractor.extractBoolean(fieldName, DEFAULT_SFGE_ENGINE_CONFIG[fieldName as keyof SfgeEngineConfig] as boolean)!;
    }

    public extractNumericValue(fieldName: string): number {
        return this.delegateExtractor.extractNumber(fieldName, DEFAULT_SFGE_ENGINE_CONFIG[fieldName as keyof SfgeEngineConfig] as number)!;
    }
}

function expressTwoMegabytesInRelevantUnit(val: string): number {
    const lowerCaseVal: string = val.toLowerCase();
    if (lowerCaseVal.endsWith('m') || lowerCaseVal.endsWith('mb')) {
        return 2;
    } else if (lowerCaseVal.endsWith('k') || lowerCaseVal.endsWith('kb')) {
        return 2048; // 2MB === 2048KB
    } else {
        return 2 ** 21; // 2MB === 2^21 bytes
    }
}
