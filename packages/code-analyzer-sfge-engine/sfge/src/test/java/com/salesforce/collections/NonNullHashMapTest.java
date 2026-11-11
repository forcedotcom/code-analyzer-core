package com.salesforce.collections;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

public class NonNullHashMapTest {
    private static NonNullHashMap<String, String> mapOf(String... kvs) {
        NonNullHashMap<String, String> map = NonNullHashMap.newInstance();
        for (int i = 0; i < kvs.length; i += 2) {
            map.put(kvs[i], kvs[i + 1]);
        }
        return map;
    }

    @Test
    public void nullKeysAndValuesAreRejectedOnEveryMutatingPath() {
        NonNullHashMap<String, String> map = mapOf("a", "1");
        assertThrows(IllegalArgumentException.class, () -> map.put(null, "x"));
        assertThrows(IllegalArgumentException.class, () -> map.put("x", null));
        assertThrows(IllegalArgumentException.class, () -> map.put("a", null));
        assertThrows(IllegalArgumentException.class, () -> map.putIfAbsent("x", null));
        assertThrows(IllegalArgumentException.class, () -> map.putIfAbsent(null, "x"));
        assertThrows(IllegalArgumentException.class, () -> map.replace("a", null));
        assertThrows(IllegalArgumentException.class, () -> map.replaceAll((k, v) -> null));
        assertThrows(IllegalArgumentException.class, () -> map.computeIfAbsent(null, k -> "x"));
        assertThrows(IllegalArgumentException.class, () -> map.compute(null, (k, v) -> "x"));
        assertThrows(IllegalArgumentException.class, () -> map.merge(null, "x", (o, n) -> n));
        assertThrows(
                IllegalArgumentException.class,
                () -> map.entrySet().iterator().next().setValue(null));
        Map<String, String> bad = new HashMap<>();
        bad.put("ok", "1");
        bad.put("bad", null);
        assertThrows(IllegalArgumentException.class, () -> map.putAll(bad));
        assertEquals(Collections.singletonMap("a", "1"), map, "a rejected write must not change the map");
    }

    @Test
    public void validOperationsBehaveLikeHashMap() {
        NonNullHashMap<String, String> map = mapOf("a", "1", "b", "2");
        assertEquals("1", map.put("a", "10"));
        assertNull(map.put("c", "3"));
        assertEquals(3, map.size());
        assertEquals("10", map.get("a"));
        assertTrue(map.containsKey("c"));
        assertTrue(map.containsValue("3"));
        assertEquals("3", map.remove("c"));
        assertEquals(new HashSet<>(Arrays.asList("a", "b")), map.keySet());
        assertEquals(new HashSet<>(Arrays.asList("10", "2")), new HashSet<>(map.values()));
        map.putAll(Collections.singletonMap("d", "4"));
        assertEquals("4", map.get("d"));
        map.entrySet().stream().filter(e -> e.getKey().equals("d")).forEach(e -> e.setValue("40"));
        assertEquals("40", map.get("d"));
        map.replaceAll((k, v) -> v + "!");
        assertEquals("10!", map.get("a"));
        assertEquals("99", map.computeIfAbsent("z", k -> "99"));
        assertEquals("98", map.merge("z", "98", (o, n) -> n));
        assertNull(map.compute("z", (k, v) -> null));
        assertFalse(map.containsKey("z"));
        assertNull(map.putIfAbsent("p", "q"));
        assertEquals("q", map.putIfAbsent("p", "r"));
        map.clear();
        assertTrue(map.isEmpty());
    }

    @Test
    public void nullQueriesDoNotThrow() {
        NonNullHashMap<String, String> map = mapOf("a", "1");
        assertNull(map.get(null));
        assertFalse(map.containsKey(null));
        assertFalse(map.containsValue(null));
        assertNull(map.remove(null));
    }

    @Test
    public void equalsHashCodeAndToStringMatchPlainMap() {
        NonNullHashMap<String, String> map = mapOf("a", "1", "b", "2");
        Map<String, String> plain = new HashMap<>();
        plain.put("a", "1");
        plain.put("b", "2");
        assertEquals(plain, map);
        assertEquals(map, plain);
        assertEquals(map, mapOf("b", "2", "a", "1"));
        assertNotEquals(map, mapOf("a", "1"));
        assertEquals(plain.hashCode(), map.hashCode());
        assertEquals(plain.toString(), map.toString());
        assertThrows(UnsupportedOperationException.class, () -> Collections.unmodifiableMap(map).put("x", "y"));
    }
}
