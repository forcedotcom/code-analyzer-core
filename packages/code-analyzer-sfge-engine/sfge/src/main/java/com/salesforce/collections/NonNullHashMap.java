package com.salesforce.collections;

import com.google.common.collect.ForwardingMap;
import com.google.common.collect.ForwardingMapEntry;
import com.google.common.collect.ForwardingSet;
import com.google.common.collect.Iterators;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/**
 * A HashMap that doesn't allow null keys or values. The default Map methods (putIfAbsent, merge, compute, replace,
 * ...) write through {@link #put}, and replaceAll writes through the entries returned by {@link #entrySet()}, so
 * guarding those two covers every write path.
 */
public class NonNullHashMap<K, V> extends ForwardingMap<K, V> {
    private final HashMap<K, V> delegate;

    private NonNullHashMap(HashMap<K, V> map) {
        this.delegate = map;
    }

    static <K, V> NonNullHashMap<K, V> newInstance() {
        return new NonNullHashMap<>(new HashMap<>());
    }

    @Override
    protected Map<K, V> delegate() {
        return delegate;
    }

    @Override
    public V put(K key, V value) {
        return super.put(NonNullGuard.check(key), NonNullGuard.check(value));
    }

    @Override
    public void putAll(Map<? extends K, ? extends V> map) {
        NonNullGuard.checkAll(map.keySet());
        NonNullGuard.checkAll(map.values());
        super.putAll(map);
    }

    @Override
    public Set<Map.Entry<K, V>> entrySet() {
        return new NullRejectingEntrySet<>(super.entrySet());
    }

    private static final class NullRejectingEntrySet<K, V> extends ForwardingSet<Map.Entry<K, V>> {
        private final Set<Map.Entry<K, V>> delegate;

        NullRejectingEntrySet(Set<Map.Entry<K, V>> delegate) {
            this.delegate = delegate;
        }

        @Override
        protected Set<Map.Entry<K, V>> delegate() {
            return delegate;
        }

        @Override
        public Iterator<Map.Entry<K, V>> iterator() {
            return Iterators.transform(delegate.iterator(), NullRejectingEntry::new);
        }

        // The inherited toArray methods would hand out the underlying (unguarded) entries.
        @Override
        public Object[] toArray() {
            return standardToArray();
        }

        @Override
        public <T> T[] toArray(T[] array) {
            return standardToArray(array);
        }
    }

    private static final class NullRejectingEntry<K, V> extends ForwardingMapEntry<K, V> {
        private final Map.Entry<K, V> delegate;

        NullRejectingEntry(Map.Entry<K, V> delegate) {
            this.delegate = delegate;
        }

        @Override
        protected Map.Entry<K, V> delegate() {
            return delegate;
        }

        @Override
        public V setValue(V value) {
            return super.setValue(NonNullGuard.check(value));
        }
    }
}
