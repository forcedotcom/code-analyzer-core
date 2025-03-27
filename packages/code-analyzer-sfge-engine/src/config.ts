import {
    ConfigDescription,
    ConfigValueExtractor,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";

export type SfgeEngineConfig = {
    disable_limit_reached_violations: boolean;
    java_max_heap_size?: string;
    java_thread_count: number;
    java_thread_timeout: number;
}

export const DEFAULT_SFGE_ENGINE_CONFIG: SfgeEngineConfig = {
    disable_limit_reached_violations: false,
    java_max_heap_size: undefined,
    java_thread_count: 4,
    java_thread_timeout: 900000
};

export const SFGE_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        disable_limit_reached_violations: {
            descriptionText: getMessage('ConfigFieldDescription_disable_limit_reached_violations'),
            valueType: "boolean",
            defaultValue: DEFAULT_SFGE_ENGINE_CONFIG.disable_limit_reached_violations
        },
        java_max_heap_size: {
            descriptionText: getMessage('ConfigFieldDescription_java_max_heap_size'),
            valueType: "string",
            defaultValue: null
        },
        java_thread_count: {
            descriptionText: getMessage('ConfigFieldDescription_java_thread_count'),
            valueType: "number",
            defaultValue: DEFAULT_SFGE_ENGINE_CONFIG.java_thread_count
        },
        java_thread_timeout: {
            descriptionText: getMessage('ConfigFieldDescription_java_thread_timeout'),
            valueType: "number",
            defaultValue: DEFAULT_SFGE_ENGINE_CONFIG.java_thread_timeout
        }
    }
}

const JAVA_HEAP_SIZE_REGEX: RegExp = /^\d+[kmg]?$/i;

export async function validateAndNormalizeConfig(cve: ConfigValueExtractor): Promise<SfgeEngineConfig> {
    cve.validateContainsOnlySpecifiedKeys(['disable_limit_reached_violations', 'java_max_heap_size', 'java_thread_count', 'java_thread_timeout']);
    const sfgeConfigValueExtractor: SfgeConfigValueExtractor = new SfgeConfigValueExtractor(cve);
    return {
        disable_limit_reached_violations: sfgeConfigValueExtractor.extractBooleanValue('disable_limit_reached_violations'),
        java_max_heap_size: sfgeConfigValueExtractor.extractJavaMaxHeapSize(),
        java_thread_count: sfgeConfigValueExtractor.extractNumericValue('java_thread_count'),
        java_thread_timeout: sfgeConfigValueExtractor.extractNumericValue('java_thread_timeout')
    };
}

class SfgeConfigValueExtractor {
    private readonly delegateExtractor: ConfigValueExtractor;

    public constructor(delegateExtractor: ConfigValueExtractor) {
        this.delegateExtractor = delegateExtractor;
    }

    public extractJavaMaxHeapSize(): string | undefined {
        const javaMaxHeapSize: string | undefined = this.delegateExtractor.extractString('java_max_heap_size', undefined, JAVA_HEAP_SIZE_REGEX);

        if (!javaMaxHeapSize) {
            return undefined;
        }

        if (javaMaxHeapSize.toLowerCase().endsWith('g')) {
            // A value expressed in gigabytes is always fine.
            return javaMaxHeapSize;
        } else {
            const numericPortion: number = parseInt(javaMaxHeapSize);
            if (numericPortion < expressTwoMegabytesInRelevantUnit(javaMaxHeapSize)) {
                throw new Error(getMessage(
                    'InvalidConfigValue',
                    this.delegateExtractor.getFieldPath('java_max_heap_size'),
                    getMessage('InsufficientMemorySpecified')
                ));
            }

            const isStrictlyNumeric: boolean = /^\d+$/.test(javaMaxHeapSize);
            if (isStrictlyNumeric && numericPortion % 1024 !== 0) {
                throw new Error(getMessage(
                    'InvalidConfigValue',
                    this.delegateExtractor.getFieldPath('java_max_heap_size'),
                    getMessage('InvalidMemoryMultiple')
                ));
            }
            return javaMaxHeapSize;
        }
    }

    public extractBooleanValue(fieldName: string): boolean {
        return this.delegateExtractor.extractBoolean(fieldName, DEFAULT_SFGE_ENGINE_CONFIG[fieldName as keyof SfgeEngineConfig] as boolean)!;
    }

    public extractNumericValue(fieldName: string): number {
        return this.delegateExtractor.extractNumber(fieldName, DEFAULT_SFGE_ENGINE_CONFIG[fieldName as keyof SfgeEngineConfig] as number)!;
    }
}

function expressTwoMegabytesInRelevantUnit(val: string): number {
    if (val.toLowerCase().endsWith('m')) {
        return 2;
    } else if (val.toLowerCase().endsWith('k')) {
        return 2048; // 2MB === 2048KB
    } else {
        return 2 ** 21; // 2MB === 2^21 bytes
    }
}
