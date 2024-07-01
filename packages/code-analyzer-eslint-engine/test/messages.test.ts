import {getMessage} from "../src/messages";

describe('Message Catalog Tests', () => {
    it('When arguments are correctly passed in then it they get filled as they should', () => {
        expect(getMessage('CantCreateEngineWithUnknownEngineName', 'abc')).toEqual(
            `The ESLintEnginePlugin does not support creating an engine with name 'abc'.`
        );
    });

    it('When too few arguments are passed in then throw error', () => {
        expect(() => getMessage('CantCreateEngineWithUnknownEngineName')).toThrow(
            `Incorrect length of args for the call to getMessage('CantCreateEngineWithUnknownEngineName',...args).\n` +
            `Expected length: 1. Actual length: 0.`
        );
    });

    it('When too many arguments are passed in then throw error', () => {
        expect(() => getMessage('CantCreateEngineWithUnknownEngineName', 'low', 2)).toThrow(
            `Incorrect length of args for the call to getMessage('CantCreateEngineWithUnknownEngineName',...args).\n` +
            `Expected length: 1. Actual length: 2.`
        );
    });

    it('When message id does not exist in the catalog then throw error', () => {
        expect(() => getMessage('doesNotExist')).toThrow(
            `Message with id "doesNotExist" does not exist in the message catalog.`
        );
    });
});