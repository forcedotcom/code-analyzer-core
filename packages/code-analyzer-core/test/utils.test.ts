import {deepEquals, RealFileSystem, TempFolder} from "../src/utils";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe('deepEquals function tests', () => {
    describe('primitive type comparison tests', () => {
        it('should return true for equal numbers', () => {
            expect(deepEquals(5, 5)).toBe(true);
        });

        it('should return false for different numbers', () => {
            expect(deepEquals(5, 10)).toBe(false);
        });

        it('should return true for equal strings', () => {
            expect(deepEquals('hello', 'hello')).toBe(true);
        });

        it('should return false for different strings', () => {
            expect(deepEquals('hello', 'world')).toBe(false);
        });

        it('should return true for equal booleans', () => {
            expect(deepEquals(true, true)).toBe(true);
        });

        it('should return false for different booleans', () => {
            expect(deepEquals(true, false)).toBe(false);
        });

        it('should return false for number vs string', () => {
            expect(deepEquals(5, '5')).toBe(false);
        });

        it('should return false for null vs undefined', () => {
            expect(deepEquals(null, undefined)).toBe(false);
        });

        it('should return true for null vs null', () => {
            expect(deepEquals(null, null)).toBe(true);
        });

        it('should return true for undefined vs undefined', () => {
            expect(deepEquals(undefined, undefined)).toBe(true);
        });

        it('should return false for NaN vs NaN since NaN is not supposed to equal itself', () => {
            expect(deepEquals(NaN, NaN)).toBe(false);
        });
    });

    describe('object comparison tests', () => {
        it('should return true for equal objects', () => {
            const obj1 = { a: 1, b: { c: 2 } };
            const obj2 = { a: 1, b: { c: 2 } };
            expect(deepEquals(obj1, obj2)).toBe(true);
        });

        it('should return false for objects with different properties', () => {
            const obj1 = { a: 1, b: { c: 2 } };
            const obj2 = { a: 1, b: { c: 3 } };
            expect(deepEquals(obj1, obj2)).toBe(false);
        });

        it('should return false for objects with different number of properties', () => {
            const obj1 = { a: 1, b: { c: 2 } };
            const obj2 = { a: 1 };
            expect(deepEquals(obj1, obj2)).toBe(false);
        });

        it('should return false for objects with different nested structures', () => {
            const obj1 = { a: { b: { c: 2 } } };
            const obj2 = { a: { b: { d: 3 } } };
            expect(deepEquals(obj1, obj2)).toBe(false);
        });

        // Arrays comparison
        it('should return true for equal arrays', () => {
            const arr1 = [1, 2, 3];
            const arr2 = [1, 2, 3];
            expect(deepEquals(arr1, arr2)).toBe(true);
        });

        it('should return false for arrays with different lengths', () => {
            const arr1 = [1, 2, 3];
            const arr2 = [1, 2];
            expect(deepEquals(arr1, arr2)).toBe(false);
        });

        it('should return false for arrays with different elements', () => {
            const arr1 = [1, 2, 3];
            const arr2 = [1, 2, 4];
            expect(deepEquals(arr1, arr2)).toBe(false);
        });

        it('should return true for empty arrays', () => {
            const arr1: unknown[] = [];
            const arr2: unknown[] = [];
            expect(deepEquals(arr1, arr2)).toBe(true);
        });
    });

    describe('mixed array and object comparison tests', () => {
        it('should return false for object vs array', () => {
            const obj = {a: 1};
            const arr = [1];
            expect(deepEquals(obj, arr)).toBe(false);
        });

        it('should return false for array vs string', () => {
            const arr = [1, 2];
            const str = '12';
            expect(deepEquals(arr, str)).toBe(false);
        });

        // Edge cases
        it('should return true for empty objects', () => {
            expect(deepEquals({}, {})).toBe(true);
        });

        it('should return true for empty arrays', () => {
            expect(deepEquals([], [])).toBe(true);
        });

        it('should return false for objects and null', () => {
            const obj = {a: 1};
            expect(deepEquals(obj, null)).toBe(false);
        });

        it('should return false for arrays and null', () => {
            const arr = [1];
            expect(deepEquals(arr, null)).toBe(false);
        });

        it('should return false for functions', () => {
            const fn1 = () => {
            };
            const fn2 = () => {
            };
            expect(deepEquals(fn1, fn2)).toBe(false);
        });

        // Nested arrays and objects
        it('should return true for deeply nested equal objects', () => {
            const obj1 = {a: {b: {c: 3}}};
            const obj2 = {a: {b: {c: 3}}};
            expect(deepEquals(obj1, obj2)).toBe(true);
        });

        it('should return false for deeply nested different objects', () => {
            const obj1 = {a: {b: {c: 3}}};
            const obj2 = {a: {b: {c: 4}}};
            expect(deepEquals(obj1, obj2)).toBe(false);
        });
    });
});

describe('file system and temp folder utilities', () => {
    it('RealFileSystem.rmSync removes a directory recursively (covers rmSync)', () => {
        const realFs = new RealFileSystem();
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-core-rmSync-'));
        const nested = path.join(dir, 'nested');
        fs.mkdirSync(nested);
        fs.writeFileSync(path.join(nested, 'file.txt'), 'x');
        expect(fs.existsSync(dir)).toBe(true);

        realFs.rmSync(dir, {recursive: true, force: true});
        expect(fs.existsSync(dir)).toBe(false);
    });

    it('TempFolder.removeSyncIfNotKept removes root when not marked to keep (covers removeSyncIfNotKept)', async () => {
        const temp = new TempFolder(); // uses RealFileSystem internally
        const subPath = await temp.getPath('sub');
        const root = path.dirname(subPath);
        fs.mkdirSync(subPath, {recursive: true});
        fs.writeFileSync(path.join(subPath, 'a.txt'), 'content');
        expect(fs.existsSync(root)).toBe(true);

        temp.removeSyncIfNotKept();
        expect(fs.existsSync(root)).toBe(false);
    });
});