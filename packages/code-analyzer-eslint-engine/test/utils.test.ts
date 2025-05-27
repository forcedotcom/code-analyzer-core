import {makeStringifiable, makeUnique} from "../src/utils";

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

describe('Tests for the makeStringifiable utility function', () => {
    it('handles null', () => {
        expect(makeStringifiable(null)).toBeNull();
    });

    it('handles primitive types (string, number, boolean)', () => {
        expect(makeStringifiable("hello")).toEqual("hello");
        expect(makeStringifiable(42)).toEqual(42);
        expect(makeStringifiable(true)).toEqual(true);
    });

    it('handles functions', () => {
        const fn = () => {};
        expect(makeStringifiable(fn)).toEqual("[Function]");
    });

    it('handles symbols', () => {
        const sym = Symbol("test");
        expect(makeStringifiable(sym)).toEqual(String(sym));
    });

    it('handles bigints', () => {
        const big = BigInt(9007199254740991);
        expect(makeStringifiable(big)).toEqual(big.toString());
    });

    it('handles arrays with primitives', () => {
        const arr = [1, "two", true, null];
        expect(makeStringifiable(arr)).toEqual([1, "two", true, null]);
    });

    it('handles nested arrays', () => {
        const arr = [1, [2, [3]]];
        expect(makeStringifiable(arr)).toEqual([1, [2, [3]]]);
    });

    it('handles cyclic arrays', () => {
        const arr: unknown[] = [1];
        arr.push(arr);
        expect(makeStringifiable(arr)).toEqual([1, '[Exact same array as: <val>]']);
    });

    it('handles plain objects', () => {
        const obj = { a: 1, b: "test" };
        expect(makeStringifiable(obj)).toEqual({ a: 1, b: "test" });
    });

    it('handles nested objects', () => {
        const obj = { a: { b: { c: 3 } } };
        expect(makeStringifiable(obj)).toEqual({ a: { b: { c: 3 } } });
    });

    it('handles cyclic objects', () => {
        const obj = { a: { b: {} } };
        obj.a.b = obj;
        expect(makeStringifiable(obj)).toEqual({ a: { b: '[Exact same object as: <val>]' } });
    });

    it('handles arrays with cyclic object references', () => {
        const obj: unknown[] = [];
        const arr: unknown[] = [obj, 3];
        arr[0] = arr;
        expect(makeStringifiable(arr)).toEqual(['[Exact same array as: <val>]', 3]);
    });

    it('handles object with cyclic array references', () => {
        const arr: unknown[] = [];
        const obj = { arr, self: arr };
        arr.push(obj);
        expect(makeStringifiable(obj)).toEqual(
            {"arr": ["[Exact same object as: <val>]"], "self": "[Exact same array as: <val>.arr]"});
    });

    it('uses the replacer function', () => {
        const replacer =
            (value: unknown, path: string) => path.endsWith('.secret') ? 'REDACTED' : value;
        const input = { visible: "yes", secret: "should hide" };
        expect(makeStringifiable(input, replacer)).toEqual({
            visible: "yes",
            secret: "REDACTED",
        });
    });

    it('handles exceptions thrown during property access', () => {
        const throwingObj = {
            get bad() {
                throw new Error("Cannot access property");
            }
        };
        expect(makeStringifiable(throwingObj)).toEqual({'bad': '[Unserializable]'});
    });

    it('converts unknown object types like Date or RegExp safely', () => {
        const obj = {
            date: new Date("2020-01-01"),
            regex: /test/i
        };
        expect(makeStringifiable(obj)).toEqual({"date": {}, "regex": {}});
    });
});
