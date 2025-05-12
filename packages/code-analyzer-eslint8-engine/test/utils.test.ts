import {makeUnique} from "../src/utils";

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
