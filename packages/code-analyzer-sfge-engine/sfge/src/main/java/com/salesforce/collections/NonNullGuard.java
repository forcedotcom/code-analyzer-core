package com.salesforce.collections;

/** Rejects null values for the NonNull* collections. Throws the same exception type for every write path. */
final class NonNullGuard {
    private NonNullGuard() {}

    static <T> T check(T item) {
        if (item == null) {
            throw new IllegalArgumentException("Null is not allowed in this collection");
        }
        return item;
    }

    /** Checks everything up front so that a rejected bulk operation leaves the collection unchanged. */
    static void checkAll(Iterable<?> items) {
        for (Object item : items) {
            check(item);
        }
    }
}
