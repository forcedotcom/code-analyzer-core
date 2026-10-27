import java.awt.Desktop

plugins {
    // plugin to build java code
    java

    // Code coverage plugin
    jacoco

    // This is a very useful utility for displaying the gradle task dependency tree
    //   Usage: ./gradlew <task 1>...<task N> taskTree
    //   Example Usage: ./gradlew build taskTree
    id("com.dorongold.task-tree") version "4.0.0"
}

repositories {
    mavenCentral()
}

// These dependencies use our version catalog. Versions are listed in the ../gradle/libs.versions.toml file.
// See https://docs.gradle.org/current/userguide/platforms.html#sub::toml-dependencies-format
dependencies {
    implementation(libs.commons.cli)
    implementation(libs.commons.collections4)
    implementation(libs.tinkergraph.gremlin) {
        // commons-collections 3.x (pulled in by commons-beanutils) has known vulnerabilities and no patched release.
        // SFGE and the Gremlin graph layer do not use it, so it is removed from the classpath entirely.
        exclude(group = "commons-collections", module = "commons-collections")
        // gremlin-shaded bundles (relocated) copies of Jackson and Kryo that are only used for graph import/export
        // (GraphSON/Gryo/GraphML). SFGE only builds and traverses an in-memory graph, and the bundled Jackson version
        // contains known vulnerabilities that cannot be patched via dependency constraints, so we do not ship it.
        exclude(group = "org.apache.tinkerpop", module = "gremlin-shaded")
    }
    // These are used directly by SFGE source (they previously arrived only transitively), so declare them explicitly.
    implementation(libs.commons.lang3)
    implementation(libs.commons.text)
    implementation(libs.antlr.runtime)
    implementation(libs.log4j.api)
    implementation(libs.log4j.core)
    implementation(libs.gson)
    implementation(libs.guava)
    implementation(libs.jsr305)
    implementation(libs.json.simple) {
        exclude("junit")
    }
    implementation(libs.reflections)
    implementation(libs.asm)
    // Force patched versions of transitive dependencies of gremlin-core (embedded in-memory graph).
    constraints {
        implementation(libs.commons.configuration2) {
            because("Patched version of a transitive dependency of gremlin-core")
        }
        implementation(libs.commons.beanutils) {
            because("Patched version of a transitive dependency of gremlin-core")
        }
        implementation(libs.snakeyaml) {
            because("Patched version of a transitive dependency of gremlin-core")
        }
    }
    implementation(files("lib/apex-jorje-lsp-sfge.jar"))
    // --- TEST ONLY DEPENDENCIES -----------------------------------------------
    testImplementation(libs.hamcrest)
    testImplementation(libs.junit.jupiter) // Maps to junit-jupiter
    testRuntimeOnly(libs.junit.platform.launcher)
    testImplementation(libs.mockito.core)
    testImplementation(libs.mockito.junit.jupiter)
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

// Directories of interest
val javaLibDir: File = layout.projectDirectory.dir("../dist/java-lib").asFile;
val reportsDir: String = layout.buildDirectory.dir("reports").get().asFile.path


// ======== BUILD RELATED TASKS ========================================================================================

// Task to build and copy jar file, giving it the name "sfge-1.0.0.jar"
tasks.jar {
    archiveBaseName.set("sfge")
    archiveVersion.set("1.0.0")
    destinationDirectory.set(javaLibDir) // Default location for JAR output
}
// Task to copy the runtime dependencies (and make this task run on build)
tasks.register<Copy>("copyDependencies") {
    from(configurations.runtimeClasspath) // This includes all runtime dependencies
    into(javaLibDir) // Target directory for dependencies
}
tasks.build {
    dependsOn("copyDependencies") // Ensure dependencies are copied during the build process
}

// Fail the build if a library that is known to carry unpatchable vulnerabilities (or that SFGE has no need for) sneaks
// back onto the runtime classpath, e.g., through a Gremlin upgrade. Everything on the runtime classpath gets shipped.
val bannedRuntimeDependencies = mapOf(
    "io.netty" to "Only needed by gremlin-driver (remote Gremlin client), which SFGE does not use",
    "software.amazon.awssdk" to "Only needed by gremlin-driver (remote Gremlin client), which SFGE does not use",
    "org.apache.tinkerpop:gremlin-driver" to "SFGE only uses the embedded in-memory graph",
    "org.apache.tinkerpop:gremlin-util" to "SFGE only uses the embedded in-memory graph",
    "org.apache.tinkerpop:gremlin-shaded" to "Bundles Jackson/Kryo with known vulnerabilities that cannot be patched via constraints",
    "commons-collections:commons-collections" to "3.x has known vulnerabilities and no patched release (SFGE uses commons-collections4)"
)
tasks.register("verifyNoBannedDependencies") {
    group = "verification"
    description = "Fails if a banned dependency is on the runtime classpath (and therefore would be shipped)."
    val resolvedModules = configurations.runtimeClasspath.map { config ->
        config.incoming.resolutionResult.allComponents
            .mapNotNull { it.moduleVersion }
            .map { "${it.group}:${it.name}:${it.version}" }
    }
    doLast {
        val violations = resolvedModules.get().flatMap { coordinates ->
            val (group, name) = coordinates.split(":")
            bannedRuntimeDependencies.filter { (banned, _) -> banned == group || banned == "$group:$name" }
                .map { (_, reason) -> "$coordinates -> $reason" }
        }
        if (violations.isNotEmpty()) {
            throw GradleException("Banned dependencies found on the runtime classpath:\n  " + violations.joinToString("\n  "))
        }
    }
}
tasks.check {
    dependsOn("verifyNoBannedDependencies")
}
tasks.build {
    dependsOn("verifyNoBannedDependencies")
}


// ======== TEST RELATED TASKS =========================================================================================
jacoco {
    toolVersion = "0.8.11"
}
tasks.test {
    // Use JUnit 5 for unit tests.
    useJUnitPlatform()

    systemProperty("junit.jupiter.extensions.autodetection.enabled", true)

    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = false
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }

    // Run tests in multiple threads
    maxParallelForks = Runtime.getRuntime().availableProcessors()/2 + 1
}
// The jacocoTestReport and jacocoTestCoverageVerification tasks must be run separately from the test task
// Otherwise, running a single test from the IDE will trigger this verification.
tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = BigDecimal("0.80")
            }
        }
    }
}
tasks.register("showCoverageReport") {
    group = "verification"
    dependsOn(tasks.jacocoTestReport)
    doLast {
        Desktop.getDesktop().browse(File("$reportsDir/jacoco/test/html/index.html").toURI())
    }
}


// ======== CLEAN RELATED TASKS ========================================================================================
tasks.register<Delete>("deleteJavaLibDir") {
    delete(javaLibDir)
}
tasks.named("clean") {
    dependsOn("deleteJavaLibDir")
}
