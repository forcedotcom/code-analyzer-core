package org.apache.tinkerpop.shaded.jackson.core;

import java.io.IOException;

/**
 * Minimal stand-in for the relocated Jackson exception type that {@code TinkerGraph} references in a {@code catch}
 * clause.
 *
 * <p>Why this exists: {@code gremlin-shaded} bundles (relocated) copies of Jackson and Kryo. The Jackson version it
 * bundles contains known vulnerabilities that cannot be fixed with dependency constraints, and SFGE does not use it
 * since SFGE only builds and traverses an in-memory graph (no GraphSON/Gryo/GraphML import or export). So we exclude
 * {@code gremlin-shaded} from the runtime classpath (see {@code build.gradle.kts}). However, the JVM must still be able
 * to load this one exception class when it verifies {@code TinkerGraph}, even though no Jackson code ever runs.
 *
 * <p>This class intentionally contains no Jackson code. Remove it (and re-evaluate the {@code gremlin-shaded} exclusion)
 * when upgrading to a Gremlin release whose bundled Jackson is patched. {@code NoVulnerableBundledLibrariesTest}
 * guards this behavior.
 */
public class JsonProcessingException extends IOException {
    public JsonProcessingException(String message) {
        super(message);
    }
}
