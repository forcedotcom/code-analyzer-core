package com.salesforce.collections;

import com.google.common.collect.ForwardingSet;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/** An HashSet that doesn't allow null values */
public class NonNullHashSet<E> extends ForwardingSet<E> {
    private final HashSet<E> delegate;

    private NonNullHashSet(HashSet<E> set) {
        this.delegate = set;
    }

    static <E> NonNullHashSet<E> newInstance() {
        return new NonNullHashSet<>(new HashSet<>());
    }

    @Override
    protected Set<E> delegate() {
        return delegate;
    }

    @Override
    public boolean add(E element) {
        return super.add(NonNullGuard.check(element));
    }

    @Override
    public boolean addAll(Collection<? extends E> collection) {
        NonNullGuard.checkAll(collection);
        return super.addAll(collection);
    }
}
