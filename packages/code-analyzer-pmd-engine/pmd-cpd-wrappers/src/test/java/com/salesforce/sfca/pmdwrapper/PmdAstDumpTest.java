package com.salesforce.sfca.pmdwrapper;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.gson.Gson;
import com.salesforce.sfca.testtools.StdOutCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Tests for PMD AST Dump functionality
 */
class PmdAstDumpTest {

    @Test
    void whenCallingMainWithAstDumpAndTooFewArgs_thenError() {
        String[] args = {"ast-dump", "notEnough"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"ast-dump\" command. Expected 2 but received: 1"));
    }

    @Test
    void whenCallingMainWithAstDumpAndTooManyArgs_thenError() {
        String[] args = {"ast-dump", "too", "many", "args"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"ast-dump\" command. Expected 2 but received: 3"));
    }

    @Test
    void whenCallingMainWithAstDumpAndInputFileThatDoesNotExist_thenError() {
        String[] args = {"ast-dump", "/does/not/exist.json", "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("Could not read contents from \"/does/not/exist.json\""));
        assertThat(thrown.getCause(), instanceOf(FileNotFoundException.class));
    }

    @Test
    void whenCallingAstDumpWithValidApexCode_thenGeneratesNonEmptyXmlAst(@TempDir Path tempDir) throws Exception {
        // Create a simple Apex class
        String apexCode = "public class TestClass {\n" +
                "    public String name;\n" +
                "    \n" +
                "    public void sayHello() {\n" +
                "        System.debug('Hello World');\n" +
                "    }\n" +
                "}";
        String apexFile = createTempFile(tempDir, "TestClass.cls", apexCode);

        // Create input JSON for ast-dump command
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(apexFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        String stdOut = callPmdWrapper(args);

        // Read and parse the results
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        Gson gson = new Gson();
        PmdAstDumpResults results = gson.fromJson(resultsJsonString, PmdAstDumpResults.class);

        // Assert the AST was generated successfully
        assertThat(results.file, is(apexFile));
        assertThat(results.ast, is(notNullValue()));
        assertThat(results.ast.length(), greaterThan(100)); // AST should be substantial
        assertThat(results.error, is(nullValue()));

        // Assert the AST contains expected XML structure
        assertThat(results.ast, containsString("<?xml version"));
        assertThat(results.ast, containsString("<ApexFile"));
        assertThat(results.ast, containsString("UserClass"));
        assertThat(results.ast, containsString("Method"));
        assertThat(results.ast, containsString("sayHello"));

        // Assert stdOut contains progress information
        assertThat(stdOut, allOf(
                containsString("ARGUMENTS"),
                containsString("Generating AST"),
                containsString("milliseconds")));
    }

    @Test
    void whenCallingAstDumpWithValidVisualforceCode_thenGeneratesNonEmptyXmlAst(@TempDir Path tempDir) throws Exception {
        // Create a simple Visualforce page
        String vfCode = "<apex:page>\n" +
                "    <h1>Hello World</h1>\n" +
                "    <apex:outputText value=\"Test\" />\n" +
                "</apex:page>";
        String vfFile = createTempFile(tempDir, "TestPage.page", vfCode);

        // Create input JSON for ast-dump command
        String inputFileContents = "{\n" +
                "  \"language\": \"visualforce\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(vfFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        callPmdWrapper(args);

        // Read and parse the results
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        Gson gson = new Gson();
        PmdAstDumpResults results = gson.fromJson(resultsJsonString, PmdAstDumpResults.class);

        // Assert the AST was generated successfully
        assertThat(results.file, is(vfFile));
        assertThat(results.ast, is(notNullValue()));
        assertThat(results.ast.length(), greaterThan(50));
        assertThat(results.error, is(nullValue()));

        // Assert the AST contains expected XML structure
        assertThat(results.ast, containsString("<?xml version"));
    }

    @Test
    void whenCallingAstDumpWithInvalidLanguage_thenReturnsError(@TempDir Path tempDir) throws Exception {
        // Create a test file
        String testFile = createTempFile(tempDir, "test.txt", "some content");

        // Create input JSON with invalid language
        String inputFileContents = "{\n" +
                "  \"language\": \"invalid_language\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(testFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        callPmdWrapper(args);

        // Read and parse the results
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        Gson gson = new Gson();
        PmdAstDumpResults results = gson.fromJson(resultsJsonString, PmdAstDumpResults.class);

        // Assert error is returned
        assertThat(results.file, is(testFile));
        assertThat(results.ast, is(nullValue()));
        assertThat(results.error, is(notNullValue()));
        assertThat(results.error.message, containsString("Language not supported"));
    }

    @Test
    void whenCallingAstDumpWithNonExistentFile_thenReturnsError(@TempDir Path tempDir) throws Exception {
        String nonExistentFile = tempDir.resolve("DoesNotExist.cls").toAbsolutePath().toString();

        // Create input JSON
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(nonExistentFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        callPmdWrapper(args);

        // Read and parse the results
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        Gson gson = new Gson();
        PmdAstDumpResults results = gson.fromJson(resultsJsonString, PmdAstDumpResults.class);

        // Assert error is returned
        assertThat(results.file, is(nonExistentFile));
        assertThat(results.ast, is(nullValue()));
        assertThat(results.error, is(notNullValue()));
        assertThat(results.error.message, containsString("File not found"));
    }

    @Test
    void whenCallingAstDumpWithInvalidApexSyntax_thenReturnsError(@TempDir Path tempDir) throws Exception {
        // Create an Apex file with invalid syntax
        String invalidApexCode = "public class Invalid {\n" +
                "    #### SYNTAX ERROR ####\n" +
                "}";
        String apexFile = createTempFile(tempDir, "Invalid.cls", invalidApexCode);

        // Create input JSON
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(apexFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        callPmdWrapper(args);

        // Read and parse the results
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        Gson gson = new Gson();
        PmdAstDumpResults results = gson.fromJson(resultsJsonString, PmdAstDumpResults.class);

        // Assert error is returned
        assertThat(results.file, is(apexFile));
        assertThat(results.ast, is(nullValue()));
        assertThat(results.error, is(notNullValue()));
    }

    // ===================== HELPER METHODS =====================

    private static String createTempFile(Path tempDir, String fileName, String fileContents) throws Exception {
        Path inputFilePath = tempDir.resolve(fileName);
        Files.write(inputFilePath, fileContents.getBytes());
        return inputFilePath.toAbsolutePath().toString();
    }

    private static String callPmdWrapper(String[] args) {
        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            PmdWrapper.main(args);
            return stdoutCaptor.getCapturedOutput();
        }
    }

    private static String makePathJsonSafe(String file) {
        return file.replace("\\", "\\\\")   // Escape backslashes
                .replace("\"", "\\\"");     // Escape double quotes
    }
}
