package com.salesforce.collections;

import com.google.common.collect.ForwardingList;
import com.google.common.collect.ForwardingListIterator;
import java.util.Collection;
import java.util.List;
import java.util.ListIterator;

/**
 * A List view that rejects nulls on every write path, including the ones that bypass add/set: list iterators (which
 * is also what {@link List#replaceAll} and {@link List#sort} write through) and sub lists.
 */
class NullRejectingList<E> extends ForwardingList<E> {
    private final List<E> delegate;

    NullRejectingList(List<E> delegate) {
        this.delegate = delegate;
    }

    @Override
    protected List<E> delegate() {
        return delegate;
    }

    @Override
    public boolean add(E element) {
        return super.add(NonNullGuard.check(element));
    }

    @Override
    public void add(int index, E element) {
        super.add(index, NonNullGuard.check(element));
    }

    @Override
    public boolean addAll(Collection<? extends E> collection) {
        NonNullGuard.checkAll(collection);
        return super.addAll(collection);
    }

    @Override
    public boolean addAll(int index, Collection<? extends E> elements) {
        NonNullGuard.checkAll(elements);
        return super.addAll(index, elements);
    }

    @Override
    public E set(int index, E element) {
        return super.set(index, NonNullGuard.check(element));
    }

    @Override
    public ListIterator<E> listIterator() {
        return new NullRejectingListIterator<>(super.listIterator());
    }

    @Override
    public ListIterator<E> listIterator(int index) {
        return new NullRejectingListIterator<>(super.listIterator(index));
    }

    @Override
    public List<E> subList(int fromIndex, int toIndex) {
        return new NullRejectingList<>(super.subList(fromIndex, toIndex));
    }

    private static final class NullRejectingListIterator<E> extends ForwardingListIterator<E> {
        private final ListIterator<E> delegate;

        NullRejectingListIterator(ListIterator<E> delegate) {
            this.delegate = delegate;
        }

        @Override
        protected ListIterator<E> delegate() {
            return delegate;
        }

        @Override
        public void add(E element) {
            super.add(NonNullGuard.check(element));
        }

        @Override
        public void set(E element) {
            super.set(NonNullGuard.check(element));
        }
    }
}
