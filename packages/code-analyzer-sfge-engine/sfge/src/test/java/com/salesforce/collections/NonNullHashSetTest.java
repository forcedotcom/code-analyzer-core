package com.salesforce.collections;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

public class NonNullHashSetTest {
    private static NonNullHashSet<String> setOf(String... items) {
        NonNullHashSet<String> set = NonNullHashSet.newInstance();
        set.addAll(Arrays.asList(items));
        return set;
    }

    @Test
    public void nullsAreRejectedOnEveryMutatingPath() {
        NonNullHashSet<String> set = setOf("a", "b");
        assertThrows(IllegalArgumentException.class, () -> set.add(null));
        assertThrows(IllegalArgumentException.class, () -> set.addAll(Arrays.asList("c", null)));
        assertEquals(new HashSet<>(Arrays.asList("a", "b")), set, "a rejected write must not change the set");
    }

    @Test
    public void validOperationsBehaveLikeHashSet() {
        NonNullHashSet<String> set = setOf("a", "b");
        assertFalse(set.add("a"));
        assertTrue(set.add("c"));
        assertEquals(3, set.size());
        assertTrue(set.contains("c"));
        assertFalse(set.isEmpty());
        assertTrue(set.remove("c"));
        set.removeIf(s -> s.equals("a"));
        assertEquals(Collections.singleton("b"), set);
        assertEquals(Collections.singletonList("b"), set.stream().collect(Collectors.toList()));
        Iterator<String> it = set.iterator();
        it.next();
        it.remove();
        assertTrue(set.isEmpty());
        set.add("x");
        set.clear();
        assertTrue(set.isEmpty());
    }

    @Test
    public void nullQueriesDoNotThrow() {
        NonNullHashSet<String> set = setOf("a");
        assertFalse(set.contains(null));
        assertFalse(set.remove(null));
    }

    @Test
    public void equalsHashCodeAndToStringMatchPlainSet() {
        NonNullHashSet<String> set = setOf("a", "b");
        Set<String> plain = new HashSet<>(Arrays.asList("a", "b"));
        assertEquals(plain, set);
        assertEquals(set, plain);
        assertEquals(set, setOf("b", "a"));
        assertNotEquals(set, setOf("a"));
        assertEquals(plain.hashCode(), set.hashCode());
        assertEquals(plain.toString(), set.toString());
    }
}
