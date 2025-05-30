/**
 * Returns a copy of the string array but with duplicate entries removed while maintaining order of the original array.
 */
export function makeUnique(values: string[]): string[] {
    // It turns out that spread operator on a Set actually maintains the order in which elements are added to the set.
    // See https://exploringjs.com/js/book/ch_sets.html#:~:text=As%20you%20can%20see%2C%20Sets,in%20which%20they%20were%20added.
    return [...new Set(values)];
}


/**
 * Converts an object into one that can be safely converted to a string via JSON.stringify.
 *
 * Some values cannot be "stringified" via JSON.stringify because they contain objects or arrays reference themselves.
 * Also, there are a some values that simply cannot be serialized, like functions, symbols, maps, etc. This function
 * handles these cases to produce an object that should be safe to pass to JSON.stringify for display purposes.
 *
 * @param value - top level value to be sanitized
 * @param replacer - function that can replace a value before it is sanitized
 */
export function makeStringifiable(
    value: unknown,
    replacer: (value: unknown, path: string) => unknown = v => v
): object | null | string | number | boolean
{
    const seen = new WeakMap<object, string>();
    function sanitize(val: unknown, path: string): object | null | string | number | boolean {
        val = replacer(val, path);
        if (val === null || ['string','number','boolean'].includes(typeof val)) {
            return val as null | string | number | boolean;
        } else if (typeof val === "function") {
            return "[Function]";
        } else if (['bigint', 'symbol'].includes(typeof val)) {
            return String(val);
        } else if (Array.isArray(val)) {
            if (seen.has(val)) {
                return `[Exact same array as: ${seen.get(val)}]`;
            }
            seen.set(val, path);
            return val.map((item, index) => sanitize(item, `${path}[${index}]`));
        } else if (typeof val === "object") {
            if (seen.has(val)) {
                return `[Exact same object as: ${seen.get(val)}]`;
            }
            seen.set(val, path);
            const result: Record<string, unknown> = {};
            for (const key of Object.keys(val)) {
                try {
                    result[key] = sanitize((val as Record<string, unknown>)[key], `${path}.${key}`);
                } catch {
                    result[key] = "[Unserializable]";
                }
            }
            return result;
        }
        /* istanbul ignore next */
        return String(val);
    }
    return sanitize(value, '<val>');
}
