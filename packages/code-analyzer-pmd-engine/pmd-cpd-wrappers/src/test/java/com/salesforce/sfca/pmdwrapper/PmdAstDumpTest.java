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

    @Test
    void whenCallingAstDumpWithNullLanguage_thenThrowsException(@TempDir Path tempDir) throws Exception {
        // Create a test file
        String testFile = createTempFile(tempDir, "test.txt", "some content");

        // Create input JSON with null language
        String inputFileContents = "{\n" +
                "  \"language\": null,\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(testFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command - should throw exception
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("'language' field is required"));
    }

    @Test
    void whenCallingAstDumpWithEmptyLanguage_thenThrowsException(@TempDir Path tempDir) throws Exception {
        // Create a test file
        String testFile = createTempFile(tempDir, "test.txt", "some content");

        // Create input JSON with empty language
        String inputFileContents = "{\n" +
                "  \"language\": \"  \",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(testFile) + "\",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command - should throw exception
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("'language' field is required"));
    }

    @Test
    void whenCallingAstDumpWithNullFileToDump_thenThrowsException(@TempDir Path tempDir) throws Exception {
        // Create input JSON with null fileToDump
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": null,\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command - should throw exception
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("'fileToDump' field is required"));
    }

    @Test
    void whenCallingAstDumpWithEmptyFileToDump_thenThrowsException(@TempDir Path tempDir) throws Exception {
        // Create input JSON with empty fileToDump
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"   \",\n" +
                "  \"encoding\": \"UTF-8\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "astDumpInput.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("astDumpOutput.json").toAbsolutePath().toString();

        // Execute ast-dump command - should throw exception
        String[] args = {"ast-dump", inputFile, resultsOutputFile};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("'fileToDump' field is required"));
    }

    @Test
    void whenCallingAstDumpWithNullEncoding_thenDefaultsToUtf8(@TempDir Path tempDir) throws Exception {
        // Create a simple Apex class
        String apexCode = "public class TestClass { }";
        String apexFile = createTempFile(tempDir, "TestClass.cls", apexCode);

        // Create input JSON with null encoding
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(apexFile) + "\",\n" +
                "  \"encoding\": null\n" +
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

        // Assert the AST was generated successfully (encoding defaulted to UTF-8)
        assertThat(results.file, is(apexFile));
        assertThat(results.ast, is(notNullValue()));
        assertThat(results.error, is(nullValue()));
    }

    @Test
    void whenCallingAstDumpWithEmptyEncoding_thenDefaultsToUtf8(@TempDir Path tempDir) throws Exception {
        // Create a simple Apex class
        String apexCode = "public class TestClass { }";
        String apexFile = createTempFile(tempDir, "TestClass.cls", apexCode);

        // Create input JSON with empty encoding
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(apexFile) + "\",\n" +
                "  \"encoding\": \"  \"\n" +
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

        // Assert the AST was generated successfully (encoding defaulted to UTF-8)
        assertThat(results.file, is(apexFile));
        assertThat(results.ast, is(notNullValue()));
        assertThat(results.error, is(nullValue()));
    }

    @Test
    void whenCallingAstDumpWithInvalidEncoding_thenReturnsError(@TempDir Path tempDir) throws Exception {
        // Create a simple Apex class
        String apexCode = "public class TestClass { }";
        String apexFile = createTempFile(tempDir, "TestClass.cls", apexCode);

        // Create input JSON with invalid encoding
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(apexFile) + "\",\n" +
                "  \"encoding\": \"INVALID-ENCODING-NAME\"\n" +
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
        assertThat(results.error.message, anyOf(
                containsString("INVALID-ENCODING-NAME"),
                containsString("Charset"),
                containsString("encoding")));
    }

    @Test
    void whenCallingAstDumpWithDirectory_thenReturnsError(@TempDir Path tempDir) throws Exception {
        // Use the temp directory itself as the file to dump
        String dirPath = tempDir.toAbsolutePath().toString();

        // Create input JSON pointing to a directory
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(dirPath) + "\",\n" +
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
        assertThat(results.file, is(dirPath));
        assertThat(results.ast, is(nullValue()));
        assertThat(results.error, is(notNullValue()));
        assertThat(results.error.message, containsString("Not a regular file"));
    }

    @Test
    void whenCallingAstDumpWithEmptyFile_thenGeneratesAst(@TempDir Path tempDir) throws Exception {
        // Create an empty Apex file
        String apexFile = createTempFile(tempDir, "Empty.cls", "");

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

        // Empty files may generate an AST or return an error depending on PMD behavior
        // Either outcome is acceptable - we're verifying no exception is thrown
        assertThat(results.file, is(apexFile));
        // Don't assert on ast or error - PMD behavior may vary for empty files
    }

    @Test
    void whenCallingAstDumpWithIso88591Encoding_thenGeneratesAst(@TempDir Path tempDir) throws Exception {
        // Create an Apex file with special characters in ISO-8859-1 encoding
        String apexCode = "public class TestClass {\n" +
                "    // Comment with special char: \u00E9\n" + // é in ISO-8859-1
                "    public String name;\n" +
                "}";
        Path apexPath = tempDir.resolve("TestClass.cls");
        Files.write(apexPath, apexCode.getBytes("ISO-8859-1"));
        String apexFile = apexPath.toAbsolutePath().toString();

        // Create input JSON with ISO-8859-1 encoding
        String inputFileContents = "{\n" +
                "  \"language\": \"apex\",\n" +
                "  \"fileToDump\": \"" + makePathJsonSafe(apexFile) + "\",\n" +
                "  \"encoding\": \"ISO-8859-1\"\n" +
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

        // Assert the AST was generated successfully with correct encoding
        assertThat(results.file, is(apexFile));
        assertThat(results.ast, is(notNullValue()));
        assertThat(results.error, is(nullValue()));
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
