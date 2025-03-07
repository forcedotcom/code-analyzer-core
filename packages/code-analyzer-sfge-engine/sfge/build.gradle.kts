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
    implementation("commons-cli:commons-cli:1.4")
    implementation("org.apache.commons:commons-collections4:4.4")
    implementation("org.apache.tinkerpop:tinkergraph-gremlin:3.5.8")
    implementation("org.apache.tinkerpop:gremlin-driver:3.5.8")
    implementation("org.antlr:antlr-runtime:3.5.2")
    implementation("org.apache.logging.log4j:log4j-api:2.17.1")
    implementation("org.apache.logging.log4j:log4j-core:2.17.1")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.google.guava:guava:33.2.1-jre")
    implementation("com.google.code.findbugs:jsr305:3.0.2")
    implementation ("com.googlecode.json-simple:json-simple:1.1.1") {
        exclude("junit")
    }
    implementation("org.reflections:reflections:0.9.12")
    implementation("org.ow2.asm:asm:9.2")
    implementation(files("lib/apex-jorje-lsp-sfge.jar"))
    // --- TEST ONLY DEPENDENCIES -----------------------------------------------
    testImplementation(libs.hamcrest)
    testImplementation(libs.junit.jupiter) // Maps to junit-jupiter
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testImplementation("org.mockito:mockito-core:5.2.0")
    testImplementation("org.mockito:mockito-junit-jupiter:5.2.0")
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