package com.salesforce.collections;

import java.util.ArrayList;

/** An ArrayList that doesn't allow null values */
public class NonNullArrayList<E> extends NullRejectingList<E> {
    private NonNullArrayList(ArrayList<E> list) {
        super(list);
    }

    static <E> NonNullArrayList<E> newInstance() {
        return new NonNullArrayList<>(new ArrayList<>());
    }
}
