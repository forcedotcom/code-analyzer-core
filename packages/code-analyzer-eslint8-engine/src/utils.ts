/**
 * Returns a copy of the string array but with duplicate entries removed while maintaining order of the original array.
 */
export function makeUnique(values: string[]): string[] {
    // It turns out that spread operator on a Set actually maintains the order in which elements are added to the set.
    // See https://exploringjs.com/js/book/ch_sets.html#:~:text=As%20you%20can%20see%2C%20Sets,in%20which%20they%20were%20added.
    return [...new Set(values)];
}