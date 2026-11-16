package com.salesforce.graph.ops;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

/**
 * Guards the dependency-hygiene decisions documented in {@code build.gradle.kts}: SFGE only needs an in-memory
 * TinkerGraph, and must not ship libraries that carry known vulnerabilities.
 */
public class NoVulnerableBundledLibrariesTest {
    @Test
    public void inMemoryGraphWorksWithoutGremlinShaded() {
        // Fails with NoClassDefFoundError if TinkerGraph needs anything from gremlin-shaded beyond what we provide.
        assertNotNull(GraphUtil.getGraph());
    }

    @Test
    public void gremlinShadedJacksonImplementationIsNotOnClasspath() {
        assertThrows(
                ClassNotFoundException.class,
                () -> Class.forName("org.apache.tinkerpop.shaded.jackson.databind.ObjectMapper"));
        assertThrows(
                ClassNotFoundException.class,
                () -> Class.forName("org.apache.tinkerpop.shaded.jackson.core.JsonFactory"));
    }

    @Test
    public void commonsCollections3IsNotOnClasspath() {
        assertThrows(
                ClassNotFoundException.class,
                () -> Class.forName("org.apache.commons.collections.FastHashMap"));
    }

    @Test
    public void nettyAndGremlinDriverAreNotOnClasspath() {
        assertThrows(ClassNotFoundException.class, () -> Class.forName("io.netty.channel.Channel"));
        assertThrows(
                ClassNotFoundException.class,
                () -> Class.forName("org.apache.tinkerpop.gremlin.driver.Cluster"));
    }
}
