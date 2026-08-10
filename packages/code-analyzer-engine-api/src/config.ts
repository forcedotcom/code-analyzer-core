import {getMessage, getMessageFromCatalog, SHARED_MESSAGE_CATALOG} from "./messages";
import path from "node:path";
import fs from "node:fs";
import {SeverityLevel} from "./rules";

/**
 * Object containing the engine configuration values
 */
export type ConfigObject = {
    [key: string]: ConfigValue
}
export type ConfigValue =
    | string
    | number
    | boolean
    | null
    | ConfigValue[]
    | ConfigObject;

/**
 * Object containing an overview and top level field descriptions of the engine configuration
 */
export type ConfigDescription = {
    /** A brief overview of the configuration. It is recommended to include a link to documentation when possible. */
    overview?: string

    /** Description objects for the primary fields in the configuration */
    fieldDescriptions?: Record<string, ConfigFieldDescription>
}
export type ConfigFieldDescription = {
    /** Text that describes the field to be documented */
    descriptionText: string

    /**
     * The type for the value associated with this field (as a string).
     *   Note that this as a string instead of an enum in order to give flexibility to describe the type of the field as
     *   we want it to show up in our public docs, but it is recommended to return one of the following when possible:
     *   'string', 'number', 'boolean', 'object', 'array'
     */
    valueType: string

    /**
     * The default value that it is to be documented. Use null if you do not have a fixed default value.
     *  Note that this value may not necessarily be the same that could be auto calculated if the user doesn't provide
     *  the value in their configuration file. For example, we may want to report null as the default value for a
     *  java_command field whenever the user doesn't explicitly provide one even though it might automatically
     *  get calculated at runtime to be some java command found in their environment.
     */
    defaultValue: ConfigValue
}

/**
 * Utility that wraps a {@link ConfigObject} instance to help validate and robustly extract its values.
 *   This utility offers the ability to extract values based on case-insensitive keys and provides validation error
 *   messages that pinpoint exactly the exact location (i.e. the field path) of were validation fails.
 */
export class ConfigValueExtractor {
    private readonly configObj: ConfigObject;
    private readonly fieldPathRoot: string;
    private readonly configRoot: string;
    private keysThatBypassValidation: string[] = [];

    /**
     * Constructs a new {@link ConfigValueExtractor} instance
     * @param configObject the {@link ConfigObject} to extract values from
     * @param fieldPathRoot the field path where the {@link ConfigObject} starts from relative the top level Code Analyzer config
     * @param configRoot the root folder for all file path values within the {@link ConfigObject} are relative to
     */
    constructor(configObject: ConfigObject, fieldPathRoot: string = '', configRoot: string = process.cwd()) {
        this.configObj = configObject;
        this.fieldPathRoot = fieldPathRoot;
        this.configRoot = configRoot;
    }

    /** Convenience method to simply return the same {@link ConfigObject} that was provided to the constructor */
    getObject(): ConfigObject {
        return this.configObj;
    }

    /** Returns the keys of the corresponding {@link ConfigObject} */
    getKeys(): string[] {
        return Object.keys(this.configObj);
    }

    /**
     * Returns the exact location (i.e. the field path) of the specified key, or the root path if no key is specified.
     * @param key (optional) the key for which to return the field path
     */
    getFieldPath(key?: string): string {
        if (!key) {
            return this.fieldPathRoot;
        }
        return this.fieldPathRoot.length > 0 ? `${this.fieldPathRoot}.${key}` : key;
    }

    /** Returns the root folder from which all file path values within the {@link ConfigObject} are relative to */
    getConfigRoot(): string {
        return this.configRoot;
    }

    /**
     * Validates (using case-insensitive keys) that the {@link ConfigObject} does not contain any keys except for those specified
     *     Note that any keys provided by the {@link ConfigValueExtractor.addKeysThatBypassValidation} that are found
     *     on the {@link ConfigObject} will also be ignored as to not produce a validation error.
     * @param keys the
     */
    validateContainsOnlySpecifiedKeys(keys: string[]) {
        const actualKeys: string[] = this.getKeys();
        const lowercasePublicKeys: string[] = keys.map(k => k.toLowerCase());
        for (const key of actualKeys) {
            if (!lowercasePublicKeys.includes(key.toLowerCase()) && !this.keysThatBypassValidation.includes(key)) {
                throw new Error(getMessage('ConfigObjectContainsInvalidKey',
                    this.fieldPathRoot || '<TopLevel>', key, JSON.stringify(keys.sort())))
            }
        }
    }

    /**
     * Adds keys that can be ignored even if they are not provided as inputs to the {@link ConfigValueExtractor.validateContainsOnlySpecifiedKeys} method
     *    Note that this method is primary useful so that certain keys will not even show up in the
     *    error message describing the list of available keys that the user has available to them.
     * @param keysThatBypassValidation the keys that can be safely ignored on objects
     */
    addKeysThatBypassValidation(keysThatBypassValidation: string[]) {
        this.keysThatBypassValidation = this.keysThatBypassValidation.concat(keysThatBypassValidation);
    }

    /**
     * Validates that the {@link ConfigObject} has a non-null value defined for the specified key.
     * @param key the key associated with the value to be validated
     */
    hasValueDefinedFor(key: string): boolean {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return value !== null;
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as a boolean.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredBoolean(key: string): boolean {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateBoolean(value, this.getFieldPath(key));
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is a boolean if it is defined.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     */
    extractBoolean(key: string, defaultValue?: boolean): boolean | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredBoolean(key);
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as a number.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredNumber(key: string): number {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateNumber(value, this.getFieldPath(key));
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is a number if it is defined.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     */
    extractNumber(key: string, defaultValue?: number): number | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredNumber(key);
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as a string.
     * @param key the key associated with the value to be extracted
     * @param regexpToMatch an optional regular expression that the extracted string must validate against
     */
    extractRequiredString(key: string, regexpToMatch?: RegExp): string {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateString(value, this.getFieldPath(key), regexpToMatch);
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is a string if it is defined.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     * @param regexpToMatch an optional regular expression that the extracted string must validate against
     */
    extractString(key: string, defaultValue?: string, regexpToMatch?: RegExp): string | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredString(key, regexpToMatch);
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as a {@link SeverityLevel}.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredSeverityLevel(key: string): SeverityLevel {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateSeverityLevel(value, this.getFieldPath(key));
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is a {@link SeverityLevel} if it is defined.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     */
    extractSeverityLevel(key: string, defaultValue?: SeverityLevel): SeverityLevel | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredSeverityLevel(key);
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as an object.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredObject(key: string): ConfigObject {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateObject(value, this.getFieldPath(key)) as ConfigObject;
    }

    /**
     * Convenience method that is essentially the same as {@link ConfigValueExtractor.extractRequiredObject} except that
     * it returns the extracted {@link ConfigObject} inside of a new {@link ConfigValueExtractor} instance.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredObjectAsExtractor(key: string): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractRequiredObject(key);
        return new ConfigValueExtractor(subObject, this.getFieldPath(key));
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is an object if it is defined.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     */
    extractObject(key: string, defaultValue?: ConfigObject): ConfigObject | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredObject(key);
    }

    /**
     * Convenience method that is essentially the same as {@link ConfigValueExtractor.extractObject} except that
     * it returns the extracted {@link ConfigObject} inside of a new {@link ConfigValueExtractor} instance.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default {@link ConfigObject} that should be used if no value is defined at key
     */
    extractObjectAsExtractor(key: string, defaultValue?: ConfigObject): ConfigValueExtractor {
        const subObject: ConfigObject = this.extractObject(key, defaultValue) || {};
        return new ConfigValueExtractor(subObject, this.getFieldPath(key));
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as an array.
     * A validation function may be provided to validate each of the elements in the array. For example:
     *     const value = extractor.extractRequiredArray(someKey, ValueValidator.validateString);
     * @param key the key associated with the value to be extracted
     * @param elementValidator an optional validation function to be used on each element that takes in the element and the element's field path
     */
    extractRequiredArray<T>(key: string, elementValidator?: (element: unknown, elementFieldPath: string) => T): T[] {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateArray<T>(value, this.getFieldPath(key), elementValidator);
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is an array if it is defined.
     * If the value is null or not defined, then the specified default value is returned.
     * A validation function may be provided to validate each of the elements in the array. For example:
     *     const value = extractor.extractArray(someKey, ValueValidator.validateString, []);
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     * @param elementValidator an optional validation function to be used on each element that takes in the element and the element's field path
     */
    extractArray<T>(key: string, elementValidator?: (element: unknown, elementFieldPath: string) => T, defaultValue?: T[]): T[] | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredArray(key, elementValidator);
    }

    /**
     * Convenience method to that basically calls {@link ConfigValueExtractor.extractRequiredArray}(key, ValueValidator.validateObject)
     * and returns a corresponding array of ConfigValueExtractor instances.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredObjectArrayAsExtractorArray(key: string): ConfigValueExtractor[] {
        const subObjects: ConfigObject[] = this.extractRequiredArray(key, ValueValidator.validateObject);
        return subObjects.map((elem, index) => new ConfigValueExtractor(elem, `${this.getFieldPath(key)}[${index}]`));
    }

    /**
     * Convenience method to that basically calls {@link ConfigValueExtractor.extractArray}(key, ValueValidator.validateObject)
     * and returns a corresponding array of ConfigValueExtractor instances.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default {@link ConfigObject} array that should be used if no value is defined at key
     */
    extractObjectArrayAsExtractorArray(key: string, defaultValue?: ConfigObject[]): ConfigValueExtractor[] {
        const subObjects: ConfigObject[] = this.extractArray(key, ValueValidator.validateObject, defaultValue) || [];
        return subObjects.map((elem, index) => new ConfigValueExtractor(elem, `${this.getFieldPath(key)}[${index}]`));
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as a file that exists on disk.
     * The file will be validated that it is either absolute path or relative to the configuration root. But in either
     * case the extracted file will be returned as an absolute path.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredFile(key: string): string {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateFile(value, this.getFieldPath(key), [this.getConfigRoot()]);
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is a file that exists disk if it is defined.
     * The file will be validated that it is either absolute path or relative to the configuration root. But in either
     * case the extracted file will be returned as an absolute path.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     */
    extractFile(key: string, defaultValue?: string): string | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredFile(key);
    }


    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is defined as a folder that exists on disk.
     * The folder will be validated that it is either absolute path or relative to the configuration root. But in either
     * case the extracted folder will be returned as an absolute path.
     * @param key the key associated with the value to be extracted
     */
    extractRequiredFolder(key: string): string {
        const value: ConfigValue = getValueUsingCaseInsensitiveKey(this.configObj, key);
        return ValueValidator.validateFolder(value, this.getFieldPath(key), [this.getConfigRoot()]);
    }

    /**
     * Extracts the value in the {@link ConfigObject} found at the specified key, validating that it is a folder that exists disk if it is defined.
     * The folder will be validated that it is either absolute path or relative to the configuration root. But in either
     * case the extracted folder will be returned as an absolute path.
     * If the value is null or not defined, then the specified default value is returned.
     * @param key the key associated with the value to be extracted
     * @param defaultValue the default value that should be returned if no value is defined at key
     */
    extractFolder(key: string, defaultValue?: string): string | undefined {
        return !this.hasValueDefinedFor(key) ? defaultValue : this.extractRequiredFolder(key);
    }
}

/**
 * Class containing a number of static validation functions that can be either used in isolation or as an input to help
 * validate the elements when extracting or validating an array with {@link ConfigValueExtractor.extractArray},
 * {@link ConfigValueExtractor.extractRequiredArray}, or {@link ValueValidator.validateArray}.
 */
export class ValueValidator {

    /**
     * Validates that the provided value is a boolean.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     */
    static validateBoolean(value: unknown, fieldPath: string): boolean {
        return validateType<boolean>("boolean", value, fieldPath);
    }

    /**
     * Validates that the provided value is a number.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     */
    static validateNumber(value: unknown, fieldPath: string): number {
        return validateType<number>("number", value, fieldPath);
    }

    /**
     * Validates that the provided value is a string.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     * @param regexpToMatch an optional regular expression that the string must validate against
     */
    static validateString(value: unknown, fieldPath: string, regexpToMatch?: RegExp): string {
        const strValue: string = validateType<string>("string", value, fieldPath);
        if (regexpToMatch && !regexpToMatch.test(strValue)) {
            throw new Error(getMessage('ConfigValueMustMatchRegExp', fieldPath, regexpToMatch.toString()));
        }
        return strValue;
    }

    /**
     * Validates that the provided value is a valid java command specifier: either the bare name of a command that is
     *   resolvable via the PATH (containing no file path separators) or an absolute file path. Relative file paths are
     *   rejected because they would resolve against the current working directory and could point to a
     *   repository-controlled executable.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     */
    static validateJavaCommand(value: unknown, fieldPath: string): string {
        const strValue: string = ValueValidator.validateString(value, fieldPath);
        if (path.isAbsolute(strValue)) {
            return strValue;
        }
        // A bare command name (no path separators) is resolved via the PATH environment variable and is allowed.
        if (!strValue.includes('/') && !strValue.includes('\\') && !strValue.includes(path.sep)) {
            return strValue;
        }
        throw new Error(getMessage('ConfigValueMustBeCommandNameOrAbsolutePath', fieldPath));
    }

    /**
     * Validates that the provided value is a {@link SeverityLevel}.
     * @param rawValue the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     */
    static validateSeverityLevel(rawValue: unknown, fieldPath: string): SeverityLevel {
        let value: unknown = typeof rawValue === 'string' && rawValue.length > 1 ?
            rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase() : rawValue;

        // Note that Object.values(SeverityLevel) returns [1,2,3,4,5,"Critical","High","Moderate","Low","Info"]
        if ((typeof value !== 'string' && typeof value !== 'number')
            || !Object.values(SeverityLevel).includes(value as string | number)) {
            throw new Error(getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel', fieldPath,
                JSON.stringify(Object.values(SeverityLevel)), JSON.stringify(rawValue) || 'undefined'));
        }
        if (typeof value === 'string') {
            // We can't type cast to enum from a string, so instead we choose the enum based on the string as a key.
            value = SeverityLevel[value as keyof typeof SeverityLevel];
        }
        // We can type cast to enum safely from a number
        return value as SeverityLevel;
    }

    /**
     * Validates that the provided value is an object.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     */
    static validateObject(value: unknown, fieldPath: string): ConfigObject {
        return validateType<ConfigObject>("object", value, fieldPath);
    }

    /**
     * Validates that the provided value is an array.
     *     A validation function may be provided to validate each of the elements in the array. For example:
     *       ValueValidator.validateArray(someArray, ValueValidator.validateString);
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     * @param elementValidator an optional validation function to be used on each element that takes in the element and the element's field path
     */
    static validateArray<T>(value: unknown, fieldPath: string, elementValidator?: (element: unknown, elementFieldPath: string) => T): T[] {
        if (!Array.isArray(value)) {
            throw new Error(getMessage('ConfigValueMustBeOfType', fieldPath, 'array', getDataType(value)));
        }
        if (elementValidator) {
            value = value.map((element, index) => elementValidator(element, `${fieldPath}[${index}]`));
        }
        return value as T[];
    }

    /**
     * Validates that the provided value is a file on disk.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     * @param possiblePathRoots a list of possible root paths where the file may be relative to
     */
    static validateFile(value: unknown, fieldPath: string, possiblePathRoots: string[] = []): string {
        const fileValue: string = ValueValidator.validatePath(value, fieldPath, possiblePathRoots);
        if (fs.statSync(fileValue).isDirectory()) {
            throw new Error(getMessage('ConfigFileValueMustNotBeFolder', fieldPath, fileValue));
        }
        return fileValue;
    }

    /**
     * Validates that the provided value is a folder on disk.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     * @param possiblePathRoots a list of possible root paths where the folder may be relative to
     */
    static validateFolder(value: unknown, fieldPath: string, possiblePathRoots: string[] = []): string {
        const folderValue: string = ValueValidator.validatePath(value, fieldPath, possiblePathRoots);
        if (!fs.statSync(folderValue).isDirectory()) {
            throw new Error(getMessage('ConfigFolderValueMustNotBeFile', fieldPath, folderValue));
        }
        return folderValue;
    }

    /**
     * Validates that the provided value is a file or folder on disk.
     * @param value the value that you wish to validate
     * @param fieldPath the field path of the value as you want it to appear in validation error messages
     * @param possiblePathRoots a list of possible root paths where the file or folder may be relative to
     */
    static validatePath(value: unknown, fieldPath: string, possiblePathRoots: string[] = []): string {
        const pathValue: string = ValueValidator.validateString(value, fieldPath);
        const pathsToTry: string[] = [];
        for (const possiblePathRoot of possiblePathRoots) {
            pathsToTry.push(toAbsolutePath(pathValue, possiblePathRoot));
        }
        // Otherwise we try to resolve it without a possible root
        pathsToTry.push(toAbsolutePath(pathValue));
        return validateAtLeastOnePathExists(pathsToTry, fieldPath);
    }
}

function validateType<T>(expectedType: string, value: unknown, fieldPath: string): T {
    const dataType: string = getDataType(value);
    if (dataType !== expectedType) {
        throw new Error(getMessage('ConfigValueMustBeOfType', fieldPath, expectedType, dataType));
    }
    return value as T;
}

function toAbsolutePath(pathValue: string, possiblePathRoot?: string): string {
    // Convert slashes to platform specific slashes and then convert to absolute path
    pathValue = pathValue.replace(/[\\/]/g, path.sep);
    if (!possiblePathRoot) {
        return path.resolve(pathValue);
    }
    return pathValue.startsWith(possiblePathRoot) ? pathValue : path.join(possiblePathRoot, pathValue);
}

function validateAtLeastOnePathExists(paths: string[], fieldPath: string): string {
    for (const currPath of paths) {
        if (fs.existsSync(currPath)) {
            return currPath;
        }
    }
    throw new Error(getMessage('ConfigPathValueDoesNotExist', fieldPath, paths[0]));
}

function getDataType(value: unknown): string {
    return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}

export function getValueUsingCaseInsensitiveKey(obj: ConfigObject, key: string): ConfigValue {
    if (key in obj) {
        return obj[key];
    }
    key = key.toLowerCase();
    for (const actualKey of Object.keys(obj)) {
        if (key == actualKey.toLowerCase()) {
            return obj[actualKey];
        }
    }
    return null;
}