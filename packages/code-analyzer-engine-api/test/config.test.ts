import {
    ConfigObject,
    ConfigValueExtractor,
    getMessageFromCatalog,
    SeverityLevel,
    SHARED_MESSAGE_CATALOG,
    ValueValidator
} from "../src";
import {getMessage} from "../src/messages";
import path from "node:path";

describe("Tests for ValueValidator", () => {
    it("When a boolean value is given to validateBoolean, then the value is returned", () => {
        expect(ValueValidator.validateBoolean(true, 'someFieldName')).toEqual(true);
    });

    it("When a non-boolean value is given to validateBoolean, then error", () => {
        expect(() =>  ValueValidator.validateBoolean(null, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'boolean', 'null'));
    });

    it("When a number value is given to validateNumber, then the value is returned", () => {
        expect(ValueValidator.validateNumber(21.5, 'someFieldName')).toEqual(21.5);
    });

    it("When a non-number value is given to validateNumber, then error", () => {
        expect(() =>  ValueValidator.validateNumber('3', 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'number', 'string'));
    });

    it("When a string value is given to validateString, then the value is returned", () => {
        expect(ValueValidator.validateString('hello', 'someFieldName')).toEqual('hello');
    });

    it("When a non-string value is given to validateString, then error", () => {
        expect(() =>  ValueValidator.validateString(['hello'], 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'array'));
    });

    it("When a good number value is given to validateSeverityLevel, then the severity level is returned", () => {
        expect(ValueValidator.validateSeverityLevel(3, 'someFieldName')).toEqual(SeverityLevel.Moderate);
    });

    it("When a good string value is given to validateSeverityLevel, then the severity level is returned", () => {
        expect(ValueValidator.validateSeverityLevel('high', 'someFieldName')).toEqual(SeverityLevel.High);
    });

    it.each([[3],0,'Medium',undefined])("When an invalid value is given to validateSeverityLevel, then error", (value) => {
        expect(() =>  ValueValidator.validateSeverityLevel(value, 'someFieldName')).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel', 'someFieldName',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', JSON.stringify(value) || 'undefined'));
    });

    it("When a value matches the regular expression provided to validateString, then the value is returned", () => {
        expect(ValueValidator.validateString('Hello', 'someFieldName', /^he.*/i)).toEqual('Hello');
    });

    it("When a value does not match the regular expression provided to validateString, then error", () => {
        expect(() => ValueValidator.validateString('oops', 'someFieldName', /^he.*/i)).toThrow(
            getMessage('ConfigValueMustMatchRegExp', 'someFieldName', '/^he.*/i'));
    });

    it("When a bare command name is given to validateJavaCommand, then the value is returned", () => {
        expect(ValueValidator.validateJavaCommand('java', 'engines.pmd.java_command')).toEqual('java');
    });

    it("When an absolute path is given to validateJavaCommand, then the value is returned unchanged", () => {
        const absPath: string = path.resolve('/usr/bin/java');
        expect(ValueValidator.validateJavaCommand(absPath, 'engines.pmd.java_command')).toEqual(absPath);
        // A raw absolute path should also be returned unchanged regardless of platform
        expect(ValueValidator.validateJavaCommand('/usr/bin/java', 'engines.pmd.java_command')).toEqual('/usr/bin/java');
    });

    it.each(['./scripts/afv-pmd-java', 'scripts/foo', '../x/java', 'a/b'])(
        "When a relative path '%s' is given to validateJavaCommand, then error", (relPath) => {
        expect(() => ValueValidator.validateJavaCommand(relPath, 'engines.pmd.java_command')).toThrow(
            getMessage('ConfigValueMustBeCommandNameOrAbsolutePath', 'engines.pmd.java_command'));
    });

    it("When a non-string value is given to validateJavaCommand, then the validateString type error is thrown", () => {
        expect(() => ValueValidator.validateJavaCommand(3, 'engines.pmd.java_command')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.pmd.java_command', 'string', 'number'));
    });

    it("When an object value is given to validateObject, then the value is returned", () => {
        expect(ValueValidator.validateObject({a:1}, 'someFieldName')).toEqual({a:1});
    });

    it("When a non-object value is given to validateObject, then error", () => {
        expect(() =>  ValueValidator.validateObject([true], 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'object', 'array'));
    });

    it("When a non-array is given to validateArray, then error", () => {
        expect(() => ValueValidator.validateArray(3, 'someFieldName', ValueValidator.validateString)).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'array', 'number'));
    });

    it("When a string array is given to validateArray with a string element validator, then the value is returned", () => {
        expect(ValueValidator.validateArray(['a','b'], 'someFieldName', ValueValidator.validateString)).toEqual(['a','b']);
    });

    it("When a value that is not a string array is given to validateArray with a string element validator, then error", () => {
        expect(() =>  ValueValidator.validateArray(['a',2], 'someFieldName', ValueValidator.validateString)).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName[1]', 'string', 'number'));
    });

    it("When a custom element validator is given to validateArray, then the resolved elements are returned in the array", () => {
        expect(ValueValidator.validateArray(['a',2], 'someFieldName', (_e: unknown, _p: string) => 'resolved')).toEqual(
            ['resolved', 'resolved']);
    });

    it("When an absolute file is given to validatePath, then it is returned", () => {
        const inputFile: string = path.resolve(__dirname, 'config.test.ts');
        expect(ValueValidator.validatePath(inputFile, 'someFieldName')).toEqual(inputFile);
    });

    it("When an relative file is given to validatePath with a correct root, then it is returned", () => {
        const inputFile: string = 'test-data/sampleWorkspace';
        const inputRoot: string = __dirname;
        expect(ValueValidator.validatePath(inputFile, 'someFieldName', [
            path.resolve(__dirname, '..'), // Not correct (so it should try the next one)
            inputRoot // Correct
        ])).toEqual(
            path.resolve(__dirname, 'test-data', 'sampleWorkspace'));
    });

    it("When an non-string value is given to validatePath, then error", () => {
        expect(() => ValueValidator.validatePath(3, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'number'));
    });

    it("When an absolute file that does not exist is given to validatePath, then error", () => {
        const inputFile: string = path.resolve(__dirname, 'does.not.exist');
        expect(() => ValueValidator.validatePath(inputFile, 'someFieldName')).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', inputFile));
    });

    it("When an relative file that does not exist is given to validatePath, then error", () => {
        const inputFile: string = 'test-data/does.not.exist';
        const inputRoot: string = __dirname;
        expect(() => ValueValidator.validatePath(inputFile, 'someFieldName', [inputRoot])).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', path.resolve(__dirname, 'test-data', 'does.not.exist')));
    });

    it("When an absolute file is given to validateFile, then it is returned", () => {
        const inputFile: string = path.resolve(__dirname, 'config.test.ts');
        expect(ValueValidator.validateFile(inputFile, 'someFieldName')).toEqual(inputFile);
    });

    it("When an relative file is given to validateFile with a correct root, then it is returned", () => {
        const inputFile: string = 'test-data/sampleWorkspace/someFile.cls';
        const inputRoot: string = __dirname;
        expect(ValueValidator.validateFile(inputFile, 'someFieldName', [inputRoot])).toEqual(
            path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.cls'));
    });

    it("When an non-string value is given to validateFile, then error", () => {
        expect(() => ValueValidator.validateFile(3, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'number'));
    });

    it("When an absolute file that does not exist is given to validateFile, then error", () => {
        const inputFile: string = path.resolve(__dirname, 'does.not.exist');
        expect(() => ValueValidator.validateFile(inputFile, 'someFieldName')).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', inputFile));
    });

    it("When an relative file that does not exist is given to validateFile, then error", () => {
        const inputFile: string = 'test-data/does.not.exist';
        const inputRoot: string = __dirname;
        expect(() => ValueValidator.validateFile(inputFile, 'someFieldName', [inputRoot])).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', path.resolve(__dirname, 'test-data', 'does.not.exist')));
    });

    it("When a folder is given to validateFile, then error", () => {
        expect(() => ValueValidator.validateFile(__dirname, 'someFieldName')).toThrow(
            getMessage('ConfigFileValueMustNotBeFolder', 'someFieldName', __dirname));
    });

    it("When an absolute folder is given to validateFolder, then it is returned", () => {
        expect(ValueValidator.validateFolder(__dirname, 'someFieldName')).toEqual(__dirname);
    });

    it("When an relative folder is given to validateFolder with a correct root, then it is returned", () => {
        const inputFile: string = 'test-data/sampleWorkspace';
        const inputRoot: string = __dirname;
        expect(ValueValidator.validateFolder(inputFile, 'someFieldName', [inputRoot])).toEqual(
            path.resolve(__dirname, 'test-data', 'sampleWorkspace'));
    });

    it("When an non-string value is given to validateFolder, then error", () => {
        expect(() => ValueValidator.validateFolder({}, 'someFieldName')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'someFieldName', 'string', 'object'));
    });

    it("When an absolute folder that does not exist is given to validateFolder, then error", () => {
        const inputFile: string = path.resolve(__dirname, 'doesNotExist');
        expect(() => ValueValidator.validateFolder(inputFile, 'someFieldName')).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', inputFile));
    });

    it("When an relative folder that does not exist is given to validateFolder, then error", () => {
        const inputFile: string = 'doesNotExist';
        const inputRoot: string = __dirname;
        expect(() => ValueValidator.validateFile(inputFile, 'someFieldName', [inputRoot])).toThrow(
            getMessage('ConfigPathValueDoesNotExist', 'someFieldName', path.resolve(__dirname, 'doesNotExist')));
    });

    it("When a file is given to validateFolder, then error", () => {
        const input: string = path.resolve(__dirname, 'config.test.ts');
        expect(() => ValueValidator.validateFolder(input, 'someFieldName')).toThrow(
            getMessage('ConfigFolderValueMustNotBeFile', 'someFieldName', input));
    });
});

describe("Tests for ConfigValueExtractor", () => {
    it("When constructing extractor with no field root, then getFieldPath with no args returns empty string", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.getFieldPath()).toEqual('');
    });

    it("When constructing extractor with no field root, then getFieldPath with a field name returns the field name", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.getFieldPath('abc')).toEqual('abc');
    });

    it("When constructing extractor with a field root, then getFieldPath with no args returns the field root", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'some.field');
        expect(extractor.getFieldPath()).toEqual('some.field');
    });

    it("When constructing extractor with a field root, then getFieldPath with a field name returns the full field path", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'some.field');
        expect(extractor.getFieldPath('abc')).toEqual('some.field.abc');
    });

    it("When an extractor contains an object with no keys, then getKeys returns an empty array", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.getKeys()).toEqual([]);
    });

    it("When an extractor contains an object with keys, then getKeys returns them", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({a: 1, b: {c: 3}});
        expect(extractor.getKeys()).toEqual(['a', 'b']);
    });

    it("When config root is not supplied, then getConfigRoot returns cwd", () => {
        const config: ConfigObject = {};
        const extractor: ConfigValueExtractor = new ConfigValueExtractor(config);
        expect(extractor.getConfigRoot()).toEqual(process.cwd());
    });

    it("When config root is supplied with valid folder, then getConfigRoot returns it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, '', __dirname);
        expect(extractor.getConfigRoot()).toEqual(__dirname);
    });

    it("When validateContainsOnlySpecifiedKeys is called on an object that has extra keys, then error", () => {
        const topLevelExtractor: ConfigValueExtractor = new ConfigValueExtractor({a: 3, b: 2, c: 3}, '', __dirname);
        expect(() => topLevelExtractor.validateContainsOnlySpecifiedKeys(['a','C'])).toThrow(
            Error(getMessage('ConfigObjectContainsInvalidKey','<TopLevel>', 'b', '["C","a"]')));
        const subExtractor: ConfigValueExtractor = new ConfigValueExtractor({d: 5, E: 6}, 'some.other[3]', __dirname);
        subExtractor.addKeysThatBypassValidation(['hidden_keys']); // Sanity check that these don't show up in the error messages
        expect(() => subExtractor.validateContainsOnlySpecifiedKeys(['d'])).toThrow(
            Error(getMessage('ConfigObjectContainsInvalidKey','some.other[3]', 'E', '["d"]')));
    });

    it("When validateContainsOnlySpecifiedKeys is called on an object that has exact or less keys, then do not error", () => {
        // Also sanity check that the keys are case-insensitive
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({a: 3, b: 2, C: 3}, '', __dirname);
        extractor.validateContainsOnlySpecifiedKeys(['A','b', 'c']); // Should not error
        extractor.validateContainsOnlySpecifiedKeys(['A','b', 'c','d','E']); // Should not error
        extractor.addKeysThatBypassValidation(['C','d']);
        extractor.validateContainsOnlySpecifiedKeys(['a','b']); // Should not error (hidden keys are for internal use only and should also be accepted)
    });

    it("When calling extractRequiredBoolean on a field that contains a boolean, then return value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: false}, 'engines.dummy');
        expect(extractor.extractRequiredBoolean('some_field')).toEqual(false);
    });

    it("When calling extractRequiredBoolean on a field is missing, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredBoolean('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'boolean', 'null'));
    });

    it("When calling extractRequiredBoolean on a non-boolean field, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: [3]}, 'engines.dummy');
        expect(() => extractor.extractRequiredBoolean('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'boolean', 'array'));
    });

    it("When calling extractBoolean on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractBoolean('some_field')).toEqual(undefined);
        expect(extractor.extractBoolean('some_field', true)).toEqual(true);
    });

    it("When calling extractBoolean on a field that is a boolean, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: true});
        expect(extractor.extractBoolean('some_Field')).toEqual(true); // Sanity check key match is case-insensitive
        expect(extractor.extractBoolean('some_field', false)).toEqual(true);
    });

    it("When calling extractBoolean on a non-boolean field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1:{}});
        expect(() => extractor1.extractBoolean('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'boolean', 'object'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2:3}, 'engines.dummy');
        expect(() => extractor2.extractBoolean('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'boolean', 'number'));
    });

    it("When calling extractRequiredNumber on a field that contains a number, then return value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 3}, 'engines.dummy');
        expect(extractor.extractRequiredNumber('some_field')).toEqual(3);
    });

    it("When calling extractRequiredNumber on a field is missing, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredNumber('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'number', 'null'));
    });

    it("When calling extractRequiredNumber on a non-number field, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: false}, 'engines.dummy');
        expect(() => extractor.extractRequiredNumber('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'number', 'boolean'));
    });

    it("When calling extractNumber on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractNumber('some_field')).toEqual(undefined);
        expect(extractor.extractNumber('some_field', 3)).toEqual(3);
    });

    it("When calling extractNumber on a field that is a number, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 5});
        expect(extractor.extractNumber('some_field')).toEqual(5);
        expect(extractor.extractNumber('soME_field', 1)).toEqual(5); // Sanity check key match is case-insensitive
    });

    it("When calling extractNumber on a non-number field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1:true});
        expect(() => extractor1.extractNumber('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'number', 'boolean'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2:'hello'}, 'engines.dummy');
        expect(() => extractor2.extractNumber('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'number', 'string'));
    });

    it("When calling extractRequiredString on a field that contains a string, then return value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'great'}, 'engines.dummy');
        expect(extractor.extractRequiredString('some_fiEld')).toEqual('great'); // Sanity check key match is case-insensitive
    });

    it("When calling extractRequiredString on a field is missing, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredString('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'string', 'null'));
    });

    it("When calling extractRequiredString on a non-number field, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 3}, 'engines.dummy');
        expect(() => extractor.extractRequiredString('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'string', 'number'));
    });

    it("When the field matches the RegExp provided to extractRequiredString, then return it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'this_matches'}, 'engines.dummy');
        expect(extractor.extractRequiredString('some_field', /^[a-z]+_[a-z]+$/)).toEqual('this_matches');
    });

    it("When the field does not match the RegExp provided to extractRequiredString, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'thisDoesNotMatch'}, 'engines.dummy');
        expect(() => extractor.extractRequiredString('some_field', /^[a-z]+_[a-z]+$/)).toThrow(
            getMessage('ConfigValueMustMatchRegExp', 'engines.dummy.some_field', '/^[a-z]+_[a-z]+$/'));
    });

    it("When calling extractString on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractString('some_field')).toEqual(undefined);
        expect(extractor.extractString('some_field', 'abc')).toEqual('abc');
    });

    it("When calling extractString on a field that is a string, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'hello world'});
        expect(extractor.extractString('some_field')).toEqual('hello world');
        expect(extractor.extractString('some_field', 'abc')).toEqual('hello world');
    });

    it("When calling extractString on a non-string field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: {a:'hi'}});
        expect(() => extractor1.extractString('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'object'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 3}, 'engines.dummy');
        expect(() => extractor2.extractString('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'number'));
    });

    it("When the field matches the RegExp provided to extractString, then return it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'this_matches'}, 'engines.dummy');
        expect(extractor.extractString('some_field', 'some_default', /^[a-z]+_[a-z]+$/)).toEqual('this_matches');
    });

    it("When the field does not match the RegExp provided to extractString, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'thisDoesNotMatch'}, 'engines.dummy');
        expect(() => extractor.extractString('some_field', 'some_default', /^[a-z]+_[a-z]+$/)).toThrow(
            getMessage('ConfigValueMustMatchRegExp', 'engines.dummy.some_field', '/^[a-z]+_[a-z]+$/'));
    });

    it("When calling extractRequiredSeverityLevel on a field that contains a valid string, then return value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'INFO'}, 'engines.dummy');
        expect(extractor.extractRequiredSeverityLevel('some_fiEld')).toEqual(SeverityLevel.Info);
    });

    it("When calling extractRequiredSeverityLevel on a field is missing, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredSeverityLevel('some_field')).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel', 'engines.dummy.some_field',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', 'null'));
    });

    it("When calling extractRequiredSeverityLevel on a field that contains a invalid value, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 'oops'}, 'engines.dummy');
        expect(() => extractor.extractRequiredSeverityLevel('some_field')).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel', 'engines.dummy.some_field',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', '"oops"'));
    });

    it("When calling extractSeverityLevel on a field that contains a valid number, then return value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 4}, 'engines.dummy');
        expect(extractor.extractSeverityLevel('some_fielD')).toEqual(SeverityLevel.Low); // Sanity check key match is case-insensitive
    });

    it("When calling extractSeverityLevel on a non-string non-number, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: [3]}, 'engines.dummy');
        expect(() =>  extractor.extractSeverityLevel('some_field')).toThrow(
            getMessageFromCatalog(SHARED_MESSAGE_CATALOG, 'ConfigValueNotAValidSeverityLevel', 'engines.dummy.some_field',
                '["Critical","High","Moderate","Low","Info",1,2,3,4,5]', '[3]'));
    });

    it("When calling extractSeverityLevel on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractSeverityLevel('some_field')).toEqual(undefined);
        expect(extractor.extractSeverityLevel('some_field', SeverityLevel.Moderate)).toEqual(SeverityLevel.Moderate);
    });

    it("When calling extractRequiredObject on a field that contains an object, then return value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {abc: 3}}, 'engines.dummy');
        expect(extractor.extractRequiredObject('some_field')).toEqual({abc: 3});
    });

    it("When calling extractRequiredObject on a field is missing, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredObject('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'object', 'null'));
    });

    it("When calling extractRequiredObject on a non-object field, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 3}, 'engines.dummy');
        expect(() => extractor.extractRequiredObject('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'object', 'number'));
    });

    it("When calling extractObject on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractObject('some_field')).toEqual(undefined);
        expect(extractor.extractObject('some_field', {a:1})).toEqual({a:1});
    });

    it("When calling extractObject on a field that is an object, then return in", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {hello: 'world'}});
        expect(extractor.extractObject('some_field')).toEqual({hello: 'world'});
        expect(extractor.extractObject('Some_field', {})).toEqual({hello: 'world'}); // Sanity check key match is case-insensitive
    });

    it("When calling extractObject on a non-object field, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractObject('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'object', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: [true]}, 'engines.dummy');
        expect(() => extractor2.extractObject('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'object', 'array'));
    });

    it("When calling extractRequiredArray with a number element validator on field that is not defined, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredArray('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'array', 'null'));
        expect(() => extractor.extractRequiredArray('some_field', ValueValidator.validateNumber)).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'array', 'null'));
    });

    it("When calling extractRequiredArray with no validator on a heterogeneous array, then return it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: ['hello', 3]});
        expect(extractor.extractRequiredArray('some_fielD')).toEqual(['hello', 3]); // Sanity check key match is case-insensitive
    });

    it("When calling extractRequiredArray with a number element validator on a field that is an number array, then return it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: [3, 4]});
        expect(extractor.extractRequiredArray('some_field', ValueValidator.validateNumber)).toEqual([3, 4]);
    });

    it("When calling extractRequiredArray with a number element validator on a field that is not a string array, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractRequiredArray('some_field1', ValueValidator.validateString)).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'array', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractRequiredArray('some_field2', ValueValidator.validateString)).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2[1]', 'string', 'number'));
    });

    it("When calling extractRequiredArray with a custom validator, then the returned array contains resolved elements", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field: [1, 2, 3]});
        expect(extractor1.extractRequiredArray('some_field', (_e, _p) => 'resolved')).toEqual(
            ['resolved', 'resolved', 'resolved']);
    });

    it("When calling extractArray on field that is not defined, then return default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(extractor.extractArray('some_field')).toEqual(undefined);
        expect(extractor.extractArray('some_field', ValueValidator.validateString, [])).toEqual([]);
    });

    it("When calling extractArray with a string element validator on a field that is an string array, then return it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: ['hello', 'world']});
        expect(extractor.extractArray('sOme_field', ValueValidator.validateString)).toEqual(['hello', 'world']); // Sanity check key match is case-insensitive
        expect(extractor.extractArray('some_field', ValueValidator.validateString, [])).toEqual(['hello', 'world']);
    });

    it("When calling extractArray with a string element validator on a field that is not a string array, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractArray('some_field1', ValueValidator.validateString)).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'array', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractArray('some_field2', ValueValidator.validateString)).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2[1]', 'string', 'number'));
    });

    it("When calling extractArray with a custom validator, then the returned array contains resolved elements", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field: [1, 2, 3]});
        expect(extractor1.extractArray('some_field', (_e, _p) => 'resolved')).toEqual(
            ['resolved', 'resolved', 'resolved']);
    });

    it("When calling extractRequiredFile on a field that does not exist, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(() => extractor.extractRequiredFile('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'some_field', 'string', 'null'));
    });

    it("When calling extractRequiredFile on valid file, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data\\sampleWorkspace\\someFile.cls'
        }, 'engines.dummy', __dirname);
        const expectedFile: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.cls');
        expect(extractor.extractRequiredFile('some_fieLd')).toEqual(expectedFile); // Sanity check key match is case-insensitive
    });

    it("When calling extractRequiredFile on a field that is not a string, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractRequiredFile('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'number'));
    });

    it("When calling extractRequiredFile on a field that is a path that does not exist, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 'does.not.exist'}, '', __dirname);
        expect(() => extractor1.extractRequiredFile('some_field1')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','some_field1', path.resolve(__dirname, 'does.not.exist')));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 'does.not.exist'}, 'engines.dummy');
        expect(() => extractor2.extractRequiredFile('some_field2')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','engines.dummy.some_field2', path.resolve(process.cwd(), 'does.not.exist')));
    });

    it("When calling extractFile on a field that does not exist, then return the default", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.extractFile('some_field')).toEqual(undefined);
        expect(extractor.extractFile('some_field', 'someDefault')).toEqual('someDefault');
    });

    it("When calling extractFile on valid file, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data\\sampleWorkspace\\someFile.cls'
        }, 'engines.dummy', __dirname);
        const expectedFile: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.cls');
        expect(extractor.extractFile('some_field')).toEqual(expectedFile);
        expect(extractor.extractFile('some_field', 'someDefault')).toEqual(expectedFile);
    });

    it("When calling extractFile on a field that is not a string, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractFile('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractFile('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'array'));
    });

    it("When calling extractFile on a field that is a path that does not exist, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 'does.not.exist'}, '', __dirname);
        expect(() => extractor1.extractFile('some_field1')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','some_field1', path.resolve(__dirname, 'does.not.exist')));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 'does.not.exist'}, 'engines.dummy');
        expect(() => extractor2.extractFile('some_field2')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','engines.dummy.some_field2', path.resolve(process.cwd(), 'does.not.exist')));
    });

    it("When calling extractFile on a field that is a folder, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data'
        }, 'engines.dummy', __dirname);
        expect(() => extractor.extractFile('some_field')).toThrow(
            getMessage('ConfigFileValueMustNotBeFolder','engines.dummy.some_field', path.resolve(__dirname, 'test-data')));
    });

    it("When calling extractRequiredFolder on a field that does not exist, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredFolder('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType', 'engines.dummy.some_field', 'string', 'null'));
    });

    it("When calling extractRequiredFolder on valid relative folder, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data/sampleWorkspace'
        }, 'engines.dummy', __dirname);
        const expectedFolder: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace');
        expect(extractor.extractRequiredFolder('some_field')).toEqual(expectedFolder);
    });

    it("When calling extractRequiredFolder on valid absolute folder, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: path.resolve(__dirname, 'test-data')
        }, 'engines.dummy', __dirname);
        const expectedFolder: string = path.resolve(__dirname, 'test-data');
        expect(extractor.extractRequiredFolder('some_field')).toEqual(expectedFolder);
    });

    it("When calling extractRequiredFolder on a field that is not a string, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractRequiredFolder('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractRequiredFolder('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'array'));
    });

    it("When calling extractRequiredFolder on a field that is a path that does not exist, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 'doesNotExist'}, '', __dirname);
        expect(() => extractor1.extractRequiredFolder('some_field1')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','some_field1', path.resolve(__dirname, 'doesNotExist')));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 'doesNotExist'}, 'engines.dummy');
        expect(() => extractor2.extractRequiredFolder('some_field2')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','engines.dummy.some_field2', path.resolve(process.cwd(), 'doesNotExist')));
    });

    it("When calling extractRequiredFolder on a field that is a file, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data/sampleWorkspace/someFile.cls'
        }, 'engines.dummy', __dirname);
        expect(() => extractor.extractRequiredFolder('some_field')).toThrow(
            getMessage('ConfigFolderValueMustNotBeFile','engines.dummy.some_field',
                path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.cls')));
    });

    it("When calling extractFolder on a field that does not exist, then return the default", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({});
        expect(extractor.extractFolder('some_field')).toEqual(undefined);
        expect(extractor.extractFolder('some_field', 'someDefault')).toEqual('someDefault');
    });

    it("When calling extractFolder on valid relative folder, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data/sampleWorkspace'
        }, 'engines.dummy', __dirname);
        const expectedFolder: string = path.resolve(__dirname, 'test-data', 'sampleWorkspace');
        expect(extractor.extractFolder('some_field')).toEqual(expectedFolder);
        expect(extractor.extractFolder('some_fiEld', 'someDefault')).toEqual(expectedFolder); // Sanity check key match is case-insensitive
    });

    it("When calling extractFolder on valid absolute folder, then return it as absolute", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: path.resolve(__dirname, 'test-data')
        }, 'engines.dummy', __dirname);
        const expectedFolder: string = path.resolve(__dirname, 'test-data');
        expect(extractor.extractFolder('some_field')).toEqual(expectedFolder);
        expect(extractor.extractFolder('some_field', 'someDefault')).toEqual(expectedFolder);
    });

    it("When calling extractFolder on a field that is not a string, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 4});
        expect(() => extractor1.extractFolder('some_field1')).toThrow(
            getMessage('ConfigValueMustBeOfType','some_field1', 'string', 'number'));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: ['a',3]}, 'engines.dummy');
        expect(() => extractor2.extractFolder('some_field2')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field2', 'string', 'array'));
    });

    it("When calling extractFolder on a field that is a path that does not exist, then error", () => {
        const extractor1: ConfigValueExtractor = new ConfigValueExtractor({some_field1: 'doesNotExist'}, '', __dirname);
        expect(() => extractor1.extractFolder('some_field1')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','some_field1', path.resolve(__dirname, 'doesNotExist')));
        const extractor2: ConfigValueExtractor = new ConfigValueExtractor({some_field2: 'doesNotExist'}, 'engines.dummy');
        expect(() => extractor2.extractFolder('some_field2')).toThrow(
            getMessage('ConfigPathValueDoesNotExist','engines.dummy.some_field2', path.resolve(process.cwd(), 'doesNotExist')));
    });

    it("When calling extractFolder on a field that is a file, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({
            some_field: 'test-data/sampleWorkspace/someFile.cls'
        }, 'engines.dummy', __dirname);
        expect(() => extractor.extractFolder('some_field')).toThrow(
            getMessage('ConfigFolderValueMustNotBeFile','engines.dummy.some_field',
                path.resolve(__dirname, 'test-data', 'sampleWorkspace', 'someFile.cls')));
    });

    it("When calling extractRequiredObjectAsExtractor on a field that does not exist, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredObjectAsExtractor('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'object', 'null'));
    });

    it("When calling extractRequiredObjectAsExtractor on a field that is not an object, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 3}, 'engines.dummy');
        expect(() => extractor.extractRequiredObjectAsExtractor('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'object', 'number'));
    });

    it("When calling extractRequiredObjectAsExtractor on a field that is an object, then return the extractor for it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {another_field: 3}}, 'engines.dummy');
        const subValueExtractor: ConfigValueExtractor = extractor.extractRequiredObjectAsExtractor('some_field');
        expect(subValueExtractor.getFieldPath()).toEqual('engines.dummy.some_field');
        expect(subValueExtractor.getObject()).toEqual({another_field: 3});
        expect(subValueExtractor.extractNumber('another_field')).toEqual(3); // sanity check
    });

    it("When calling extractObjectAsExtractor on a field that does not exist, then return extractor for default object", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        const subValueExtractor1: ConfigValueExtractor = extractor.extractObjectAsExtractor('some_field');
        expect(subValueExtractor1.getFieldPath()).toEqual('engines.dummy.some_field');
        expect(subValueExtractor1.getObject()).toEqual({});
        const subValueExtractor2: ConfigValueExtractor = extractor.extractObjectAsExtractor('some_field', {abc: 1});
        expect(subValueExtractor2.getFieldPath()).toEqual('engines.dummy.some_field');
        expect(subValueExtractor2.getObject()).toEqual({abc: 1});
    });

    it("When calling extractObjectAsExtractor on a field that is not an object, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: 3}, 'engines.dummy');
        expect(() => extractor.extractObjectAsExtractor('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'object', 'number'));
        expect(() => extractor.extractObjectAsExtractor('some_field', {abc: 1})).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'object', 'number'));
    });

    it("When calling extractObjectAsExtractor on a field that is an object, then return the extractor for it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {another_fielD: 3}}, 'engines.dummy');
        const subValueExtractor: ConfigValueExtractor = extractor.extractObjectAsExtractor('some_field', {}); // Sanity check key match is case-insensitive
        expect(subValueExtractor.getFieldPath()).toEqual('engines.dummy.some_field');
        expect(subValueExtractor.getObject()).toEqual({another_fielD: 3});
    });

    it("When calling extractRequiredObjectArrayAsExtractorArray on a field that does not exist, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        expect(() => extractor.extractRequiredObjectArrayAsExtractorArray('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'array', 'null'));
    });

    it("When calling extractRequiredObjectArrayAsExtractorArray on a field that is not an array, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {oops: 3}}, 'engines.dummy');
        expect(() => extractor.extractRequiredObjectArrayAsExtractorArray('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'array', 'object'));
    });

    it("When calling extractRequiredObjectArrayAsExtractorArray on an array that has a non-object element, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: [{oops: 3}, 2]}, 'engines.dummy');
        expect(() => extractor.extractRequiredObjectArrayAsExtractorArray('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field[1]', 'object', 'number'));
    });

    it("When calling extractRequiredObjectArrayAsExtractorArray on a field that is an array of objects, then return the extractor for it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: [{a: 1}, {a: 2}]}, 'engines.dummy');
        const subValueExtractors: ConfigValueExtractor[] = extractor.extractRequiredObjectArrayAsExtractorArray('some_field');
        expect(subValueExtractors).toHaveLength(2);
        expect(subValueExtractors[0].getFieldPath()).toEqual('engines.dummy.some_field[0]');
        expect(subValueExtractors[0].getObject()).toEqual({a: 1});
        expect(subValueExtractors[1].getFieldPath()).toEqual('engines.dummy.some_field[1]');
        expect(subValueExtractors[1].getObject()).toEqual({a: 2});
    });

    it("When calling extractObjectArrayAsExtractorArray on a field that does not exist, then return extractor for default value", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({}, 'engines.dummy');
        const subValueExtractors1: ConfigValueExtractor[] = extractor.extractObjectArrayAsExtractorArray('some_field');
        expect(subValueExtractors1).toHaveLength(0);

        const subValueExtractors2: ConfigValueExtractor[] = extractor.extractObjectArrayAsExtractorArray('some_field', [{a: 1}, {b: 2}]);
        expect(subValueExtractors2).toHaveLength(2);
        expect(subValueExtractors2[0].getFieldPath()).toEqual('engines.dummy.some_field[0]');
        expect(subValueExtractors2[0].getObject()).toEqual({a: 1});
        expect(subValueExtractors2[1].getFieldPath()).toEqual('engines.dummy.some_field[1]');
        expect(subValueExtractors2[1].getObject()).toEqual({b: 2});
    });

    it("When calling extractObjectArrayAsExtractorArray on a field that is not an array, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: {oops: 3}}, 'engines.dummy');
        expect(() => extractor.extractObjectArrayAsExtractorArray('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field', 'array', 'object'));
    });

    it("When calling extractObjectArrayAsExtractorArray on an array that has a non-object element, then error", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({some_field: [{oops: 3}, 2]}, 'engines.dummy');
        expect(() => extractor.extractObjectArrayAsExtractorArray('some_field')).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field[1]', 'object', 'number'));
        expect(() => extractor.extractObjectArrayAsExtractorArray('some_field', [{a: 3}])).toThrow(
            getMessage('ConfigValueMustBeOfType','engines.dummy.some_field[1]', 'object', 'number'));
    });

    it("When calling extractObjectArrayAsExtractorArray on a field that is an array of objects, then return the extractor for it", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({somE_field: [{a: 1}, {b: 2}, {c: 3}]}, 'engines.dummy1.dummy2[5]');
        const subValueExtractors: ConfigValueExtractor[] = extractor.extractObjectArrayAsExtractorArray('some_field'); // Sanity check key match is case-insensitive
        expect(subValueExtractors).toHaveLength(3);
        expect(subValueExtractors[0].getFieldPath()).toEqual('engines.dummy1.dummy2[5].some_field[0]');
        expect(subValueExtractors[0].getObject()).toEqual({a: 1});
        expect(subValueExtractors[1].getFieldPath()).toEqual('engines.dummy1.dummy2[5].some_field[1]');
        expect(subValueExtractors[1].getObject()).toEqual({b: 2});
        expect(subValueExtractors[2].getFieldPath()).toEqual('engines.dummy1.dummy2[5].some_field[2]');
        expect(subValueExtractors[2].getObject()).toEqual({c: 3});
    });

    it("The hasValueDefinedFor method returns true when a field is defined and not null and false otherwise", () => {
        const extractor: ConfigValueExtractor = new ConfigValueExtractor({a: 3, b: null, c: false, d: 0, e: ''});
        expect(extractor.hasValueDefinedFor('a')).toEqual(true);
        expect(extractor.hasValueDefinedFor('b')).toEqual(false);
        expect(extractor.hasValueDefinedFor('c')).toEqual(true);
        expect(extractor.hasValueDefinedFor('D')).toEqual(true); // Sanity check key match is case-insensitive
        expect(extractor.hasValueDefinedFor('e')).toEqual(true);
        expect(extractor.hasValueDefinedFor('f')).toEqual(false);
    });
});
