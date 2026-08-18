import {makeUnique} from "../src/utils";
import {isExecutableConfigFile} from "../src/config";
import {getMessage} from "../src/messages";

describe('Tests for the makeUnique utility function', () => {
    it('When an empty array is given, then return it', () => {
        expect(makeUnique([])).toEqual([]);
    });

    it('When an array with one value is given, then return it', () => {
        expect(makeUnique(['hello'])).toEqual(['hello']);
    });

    it('When an array with duplicate values is given, then remove duplicate entries maintaining the original order', () => {
        expect(makeUnique(['hello','1','z','z','hello','world'])).toEqual(['hello','1','z','world']);
    });
});

describe('Tests for the isExecutableConfigFile utility function', () => {
    it.each([
        '.eslintrc.js',
        '.eslintrc.cjs',
        '/some/absolute/path/.eslintrc.js',
        'relative/path/.eslintrc.cjs'
    ])('When given an executable legacy config file (%s), then return true', (filePath: string) => {
        expect(isExecutableConfigFile(filePath)).toEqual(true);
    });

    it.each([
        '.eslintrc.json',
        '.eslintrc.yaml',
        '.eslintrc.yml',
        '/some/absolute/path/.eslintrc.json',
        '.eslintignore'
    ])('When given a declarative (non-executable) legacy config file (%s), then return false', (filePath: string) => {
        expect(isExecutableConfigFile(filePath)).toEqual(false);
    });

    it('When the file extension is uppercase, then it is matched case-insensitively', () => {
        expect(isExecutableConfigFile('.eslintrc.JS')).toEqual(true);
        expect(isExecutableConfigFile('.eslintrc.CJS')).toEqual(true);
        expect(isExecutableConfigFile('.eslintrc.JSON')).toEqual(false);
    });
});

describe('Tests for the new security-related messages', () => {
    it('When getting the SkippedAutoDiscoveredExecutableConfigFile message, then it resolves with the file path filled in', () => {
        const msg: string = getMessage('SkippedAutoDiscoveredExecutableConfigFile', '/some/.eslintrc.js');
        expect(msg).toContain(`'/some/.eslintrc.js'`);
        expect(msg).toContain('was NOT applied');
        expect(msg).toContain('eslint_config_file');
    });

    it('When getting the ExplicitExecutableConfigFileWillExecute message, then it resolves with the file path filled in', () => {
        const msg: string = getMessage('ExplicitExecutableConfigFileWillExecute', '/some/.eslintrc.js');
        expect(msg).toContain(`'/some/.eslintrc.js'`);
        expect(msg).toContain('will run during analysis');
    });
});
