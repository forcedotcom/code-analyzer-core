package com.salesforce.collections;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** Pins the behavior callers rely on: nulls are rejected with IllegalArgumentException on every path. */
public class NonNullArrayListTest {
    private static NonNullArrayList<String> listOf(String... items) {
        NonNullArrayList<String> list = NonNullArrayList.newInstance();
        list.addAll(Arrays.asList(items));
        return list;
    }

    @Test
    public void nullsAreRejectedOnEveryMutatingPath() {
        NonNullArrayList<String> list = listOf("a", "b");
        assertThrows(IllegalArgumentException.class, () -> list.add(null));
        assertThrows(IllegalArgumentException.class, () -> list.add(1, null));
        assertThrows(IllegalArgumentException.class, () -> list.set(0, null));
        assertThrows(IllegalArgumentException.class, () -> list.addAll(Arrays.asList("c", null)));
        assertThrows(IllegalArgumentException.class, () -> list.addAll(1, Arrays.asList("c", null)));
        assertThrows(IllegalArgumentException.class, () -> list.replaceAll(s -> null));
        assertThrows(IllegalArgumentException.class, () -> list.listIterator().add(null));
        assertThrows(
                IllegalArgumentException.class,
                () -> {
                    ListIterator<String> it = list.listIterator();
                    it.next();
                    it.set(null);
                });
        assertThrows(IllegalArgumentException.class, () -> list.subList(0, 1).add(null));
        assertThrows(IllegalArgumentException.class, () -> list.subList(0, 1).set(0, null));
        assertEquals(Arrays.asList("a", "b"), list, "a rejected write must not change the list");
    }

    @Test
    public void rejectedAddAllLeavesListUnchanged() {
        NonNullArrayList<String> list = listOf("a");
        assertThrows(IllegalArgumentException.class, () -> list.addAll(Arrays.asList("b", null, "c")));
        assertEquals(Collections.singletonList("a"), list);
    }

    @Test
    public void validOperationsBehaveLikeArrayList() {
        NonNullArrayList<String> list = listOf("b", "a");
        list.add("c");
        list.add(0, "z");
        list.set(1, "y");
        assertEquals(Arrays.asList("z", "y", "a", "c"), list);
        assertEquals(4, list.size());
        assertFalse(list.isEmpty());
        assertTrue(list.contains("a"));
        assertEquals(2, list.indexOf("a"));
        assertEquals("a", list.get(2));
        assertEquals("a", list.remove(2));
        assertTrue(list.remove("z"));
        list.sort(Comparator.naturalOrder());
        assertEquals(Arrays.asList("c", "y"), list);
        list.replaceAll(String::toUpperCase);
        assertEquals(Arrays.asList("C", "Y"), list);
        list.removeIf(s -> s.equals("C"));
        assertEquals(Collections.singletonList("Y"), list);
        assertEquals(Collections.singletonList("Y"), list.stream().collect(Collectors.toList()));
        list.clear();
        assertTrue(list.isEmpty());
    }

    @Test
    public void nullQueriesDoNotThrow() {
        NonNullArrayList<String> list = listOf("a");
        assertFalse(list.contains(null));
        assertEquals(-1, list.indexOf(null));
        assertFalse(list.remove(null));
    }

    @Test
    public void equalsHashCodeAndToStringMatchPlainList() {
        NonNullArrayList<String> list = listOf("a", "b");
        List<String> plain = new ArrayList<>(Arrays.asList("a", "b"));
        assertEquals(plain, list);
        assertEquals(list, plain);
        assertEquals(list, listOf("a", "b"));
        assertNotEquals(list, listOf("a"));
        assertEquals(plain.hashCode(), list.hashCode());
        assertEquals(plain.toString(), list.toString());
    }

    @Test
    public void iteratorRemoveAndUnmodifiableViewWork() {
        NonNullArrayList<String> list = listOf("a", "b", "c");
        Iterator<String> it = list.iterator();
        it.next();
        it.remove();
        assertEquals(Arrays.asList("b", "c"), list);
        List<String> view = Collections.unmodifiableList(list);
        assertThrows(UnsupportedOperationException.class, () -> view.add("d"));
        assertEquals(Arrays.asList("b", "c"), view);
        List<String> sub = list.subList(0, 1);
        sub.add("x");
        assertEquals(Arrays.asList("b", "x", "c"), list);
    }
}
