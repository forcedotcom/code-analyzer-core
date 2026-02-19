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

describe('utils: makeUnique deduplication and makeStringifiable serialization', () => {
    describe('makeUnique removes duplicates and preserves order', () => {
        it('removes duplicates while preserving order', () => {
            expect(makeUnique(['a','b','a','c','b','d'])).toEqual(['a','b','c','d']);
            expect(makeUnique([])).toEqual([]);
        });
    });

    describe('makeStringifiable handles edge cases and tracks paths', () => {
        it('passes through primitives', () => {
            expect(makeStringifiable('str')).toBe('str');
            expect(makeStringifiable(42)).toBe(42);
            expect(makeStringifiable(true)).toBe(true);
            expect(makeStringifiable(null)).toBe(null);
        });

        it('stringifies functions and symbols/bigints safely', () => {
            expect(makeStringifiable(() => 1)).toBe('[Function]');
            // BigInt and Symbol should stringify to String(value)
            // Using toString form because equality to Symbol(...) is not supported
            expect(makeStringifiable(BigInt(10))).toBe('10');
            const s = Symbol('x');
            expect(makeStringifiable(s)).toBe(String(s));
        });

        it('handles arrays with self references', () => {
            const a: unknown[] = ['x'];
            a.push(a); // self reference
            const res = makeStringifiable(a) as unknown[];
            expect(res[0]).toBe('x');
            // second element becomes a marker with the first path where it was seen
            expect(typeof res[1]).toBe('string');
            expect((res[1] as string)).toContain('[Exact same array as: <val>'); // path marker
        });

        it('handles objects with self references', () => {
            const o: Record<string, unknown> = {a: 1};
            o.self = o; // cycle
            const res = makeStringifiable(o) as Record<string, unknown>;
            expect(res.a).toBe(1);
            expect(typeof res.self).toBe('string');
            expect((res.self as string)).toContain('[Exact same object as: <val>'); // path marker
        });

        it('marks unserializable property access with placeholder', () => {
            const o = Object.create(null) as { ok: number; bad: unknown };
            Object.defineProperty(o, 'ok', { value: 1, enumerable: true });
            Object.defineProperty(o, 'bad', {
                enumerable: true,
                get() { throw new Error('boom'); }
            });
            const res = makeStringifiable(o) as Record<string, unknown>;
            expect(res.ok).toBe(1);
            expect(res.bad).toBe('[Unserializable]');
        });

        it('applies replacer with correct path propagation', () => {
            const paths: string[] = [];
            const v = { foo: { bar: [1,2] } };
            const out = makeStringifiable(v, (_val, p) => { paths.push(p); return _val; });
            expect(paths).toEqual(expect.arrayContaining([
                '<val>', '<val>.foo', '<val>.foo.bar', '<val>.foo.bar[0]', '<val>.foo.bar[1]'
            ]));
            // structure preserved
            expect((out as any).foo.bar[0]).toBe(1);
        });
    });
});
