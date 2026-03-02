package com.salesforce.sfca.pmdwrapper;

import static com.salesforce.sfca.pmdwrapper.PmdRuleDescriberTest.assertContainsOneRuleWithNameAndLanguage;
import static com.salesforce.sfca.pmdwrapper.PmdRuleDescriberTest.createSampleRuleset;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.google.gson.reflect.TypeToken;
import com.salesforce.sfca.testtools.StdOutCaptor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.FileNotFoundException;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

class PmdWrapperTest {
    @Test
    void whenCallingMainWithNoCommand_thenError() {
        String[] args = {};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Missing arguments to PmdWrapper."));
    }

    @Test
    void whenCallingMainWithUnsupportedCommand_thenError() {
        String[] args = {"oops", "abc"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Bad first argument to PmdWrapper. Expected \"describe\", \"run\", or \"ast-dump\". Received: \"oops\""));
    }

    @Test
    void whenCallingMainWithDescribeAndTooFewArgs_thenError() {
        String[] args = {"describe", "notEnough"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"describe\" command. Expected 3 but received: 1"));
    }

    @Test
    void whenCallingMainWithDescribeAndTooManyArgs_thenError() {
        String[] args = {"describe", "far", "too", "many", "args"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"describe\" command. Expected 3 but received: 4"));
    }

    @Test
    void whenCallingMainWithDescribeAndBadOutputFile_thenError(@TempDir Path tempDir) throws Exception {
        Path tempCustomRulesetsListFile = tempDir.resolve("tempCustomRulesetsListFile.txt");
        Files.write(tempCustomRulesetsListFile, "".getBytes());

        String[] args = {"describe", "/this/does/not/exist.txt",
                tempCustomRulesetsListFile.toAbsolutePath().toString(), "apex,visualforce"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getCause(), instanceOf(FileNotFoundException.class));
    }

    @Test
    void whenCallingMainWithDescribeAndMissingCustomRulesetsListFile_thenError(@TempDir Path tempDir) throws Exception {
        Path tempFile = tempDir.resolve("tempFile.txt");
        Path tempCustomRulesetsListFile = tempDir.resolve("tempCustomRulesetsListFile.txt"); // Does not exist

        String[] args = {"describe", tempFile.toAbsolutePath().toString(),
                tempCustomRulesetsListFile.toAbsolutePath().toString(), "apex,visualforce"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getCause(), instanceOf(NoSuchFileException.class));
    }

    @Test
    void whenCallingMainWithDescribeAndValidArgs_thenItWritesValidJsonToFile(@TempDir Path tempDir) throws Exception {
        Path tempFile = tempDir.resolve("tempFile.txt");
        Path tempCustomRulesetsListFile = tempDir.resolve("tempCustomRulesetsListFile.txt");
        Files.write(tempCustomRulesetsListFile, "".getBytes());
        String[] args = {"describe", tempFile.toAbsolutePath().toString(),
                tempCustomRulesetsListFile.toAbsolutePath().toString(), "apex,visualforce"};
        String stdOut = callPmdWrapper(args);

        // Read the file and convert the json back into a list of PmdRuleInfo instances
        String fileContents = Files.readString(tempFile);
        Gson gson = new Gson();
        Type pmdRuleInfoListType = new TypeToken<List<PmdRuleInfo>>(){}.getType();
        List<PmdRuleInfo> pmdRuleInfoList = gson.fromJson(fileContents, pmdRuleInfoListType);

        // Keeping assertions to a minimal since we will lock in most of the output details in our other tests
        assertThat(pmdRuleInfoList, hasSize(greaterThan(60))); // Keeping this test flexible so it doesn't fail on each upgrade

        // Assert stdOut contains time arguments and time information (which help us with debugging)
        assertThat(stdOut, allOf(containsString("ARGUMENTS"), containsString("milliseconds")));
    }

    @Test
    void whenCallingMainWithDescribeWithCustomRulesetsFile_thenRulesetsAreApplied(@TempDir Path tempDir) throws Exception {
        Path sampleRulesetFile1 = tempDir.resolve("sampleRulesetFile1.xml");
        Files.write(sampleRulesetFile1, createSampleRuleset("sampleRuleset1", "sampleRule1", "visualforce", 2).getBytes());
        Path sampleRulesetFile2 = tempDir.resolve("sampleRulesetFile2.xml");
        Files.write(sampleRulesetFile2, createSampleRuleset("sampleRuleset2", "sampleRule2", "apex", 4).getBytes());

        Path tempFile = tempDir.resolve("tempFile.txt");

        Path tempCustomRulesetsListFile = tempDir.resolve("tempCustomRulesetsListFile.txt");
        String tempCustomRulesetsListText = sampleRulesetFile1.toAbsolutePath() + "\n" +
                sampleRulesetFile2.toAbsolutePath() + "\n\n"; // Sanity check that extra new lines don't break anything
        Files.write(tempCustomRulesetsListFile, tempCustomRulesetsListText.getBytes());
        String[] args = {"describe", tempFile.toAbsolutePath().toString(),
                tempCustomRulesetsListFile.toAbsolutePath().toString(), "apex,visualforce"};

        callPmdWrapper(args);

        // Read the file and convert the json back into a list of PmdRuleInfo instances
        String fileContents = Files.readString(tempFile);
        Gson gson = new Gson();
        Type pmdRuleInfoListType = new TypeToken<List<PmdRuleInfo>>(){}.getType();
        List<PmdRuleInfo> pmdRuleInfoList = gson.fromJson(fileContents, pmdRuleInfoListType);
        PmdRuleInfo ruleInfo1 = assertContainsOneRuleWithNameAndLanguage(pmdRuleInfoList, "sampleRule1", "visualforce");
        assertThat(ruleInfo1.ruleSetFile, is(sampleRulesetFile1.toAbsolutePath().toString()));
        PmdRuleInfo ruleInfo2 = assertContainsOneRuleWithNameAndLanguage(pmdRuleInfoList, "sampleRule2", "apex");
        assertThat(ruleInfo2.ruleSetFile, is(sampleRulesetFile2.toAbsolutePath().toString()));
    }

    @Test
    void whenCallingMainWithDescribeWithNcssCountRuleset_thenRuleAppearsInDescribe(@TempDir Path tempDir) throws Exception {
        // Create a minimal ruleset that references Apex NcssCount (metrics)
        String rulesetXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<ruleset name=\"Ruleset for NcssCount\"\n" +
                "    xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "    xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Include Apex NcssCount</description>\n" +
                "    <rule ref=\"category/apex/design.xml/NcssCount\" />\n" +
                "</ruleset>";
        Path ncssRuleset = tempDir.resolve("ncss-ruleset.xml");
        Files.write(ncssRuleset, rulesetXml.getBytes());

        // Prepare describe args with a custom rulesets list file
        Path outputFile = tempDir.resolve("describe-output.json");
        Path rulesetsList = tempDir.resolve("customRulesetsList.txt");
        Files.write(rulesetsList, (ncssRuleset.toAbsolutePath().toString() + "\n").getBytes());

        String[] args = {"describe", outputFile.toAbsolutePath().toString(),
                rulesetsList.toAbsolutePath().toString(), "apex"};
        callPmdWrapper(args);

        // Parse output and assert NcssCount is present and references our ruleset file
        String fileContents = Files.readString(outputFile);
        Gson gson = new Gson();
        Type pmdRuleInfoListType = new TypeToken<List<PmdRuleInfo>>(){}.getType();
        List<PmdRuleInfo> pmdRuleInfoList = gson.fromJson(fileContents, pmdRuleInfoListType);
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(pmdRuleInfoList, "NcssCount", "apex");
        assertThat(ruleInfo.ruleSetFile, is(ncssRuleset.toAbsolutePath().toString()));
    }

    @Test
    void whenCallingMainWithDescribeWithExcessiveClassLengthRuleset_thenRuleAppearsInDescribe(@TempDir Path tempDir) throws Exception {
        // Create a minimal ruleset that references Apex ExcessiveClassLength (design)
        String rulesetXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<ruleset name=\"Ruleset for ExcessiveClassLength\"\n" +
                "    xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "    xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Include Apex ExcessiveClassLength</description>\n" +
                "    <rule ref=\"category/apex/design.xml/ExcessiveClassLength\" />\n" +
                "</ruleset>";
        Path excessiveClassLengthRuleset = tempDir.resolve("excessive-class-length-ruleset.xml");
        Files.write(excessiveClassLengthRuleset, rulesetXml.getBytes());

        // Prepare describe args with a custom rulesets list file
        Path outputFile = tempDir.resolve("describe-output.json");
        Path rulesetsList = tempDir.resolve("customRulesetsList.txt");
        Files.write(rulesetsList, (excessiveClassLengthRuleset.toAbsolutePath().toString() + "\n").getBytes());

        String[] args = {"describe", outputFile.toAbsolutePath().toString(),
                rulesetsList.toAbsolutePath().toString(), "apex"};
        callPmdWrapper(args);

        // Parse output and assert ExcessiveClassLength is present and references our ruleset file
        String fileContents = Files.readString(outputFile);
        Gson gson = new Gson();
        Type pmdRuleInfoListType = new TypeToken<List<PmdRuleInfo>>(){}.getType();
        List<PmdRuleInfo> pmdRuleInfoList = gson.fromJson(fileContents, pmdRuleInfoListType);
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(pmdRuleInfoList, "ExcessiveClassLength", "apex");
        assertThat(ruleInfo.ruleSetFile, is(excessiveClassLengthRuleset.toAbsolutePath().toString()));
    }

    @Test
    void whenCallingMainWithRunAndTwoFewArgs_thenError() {
        String[] args = {"run", "notEnough"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"run\" command. Expected 2 but received: 1"));
    }

    @Test
    void whenCallingMainWithRunAndTooManyArgs_thenError() {
        String[] args = {"run", "too", "many", "args"};
        Exception thrown = assertThrows(Exception.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is("Invalid number of arguments following the \"run\" command. Expected 2 but received: 3"));
    }

    @Test
    void whenCallingMainWithRunAndInputFileThatDoesNotExist_thenError() {
        String[] args = {"run", "/does/not/exist.json", "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("Could not read contents from \"/does/not/exist.json\""));
        assertThat(thrown.getCause(), instanceOf(FileNotFoundException.class));
    }

    @Test
    void whenCallingMainWithRunAndInputFileThatDoesNotContainValidJson_thenError(@TempDir Path tempDir) throws Exception {
        String inputFileContents = "{\"oops"; // Not valid json
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), containsString("Could not read contents from \"" + inputFile + "\""));
        assertThat(thrown.getCause(), instanceOf(JsonSyntaxException.class));
    }

    @Test
    void whenCallingRunWithMissingField_runDataPerLanguage_thenError(@TempDir Path tempDir) throws Exception {
        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String inputFileContents = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\"\n" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke PmdRunner.run: The \"runDataPerLanguage\" field was not set."));
    }

    @Test
    void whenCallingRunWithRunDataPerLanguageHavingZeroFields_thenError(@TempDir Path tempDir) throws Exception {
        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String inputFileContents = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\",\n" +
                "  \"runDataPerLanguage\": {" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke PmdRunner.run: The \"runDataPerLanguage\" field didn't have any languages listed."));
    }

    @Test
    void whenCallingRunWithMissingField_filesToScan_thenError(@TempDir Path tempDir) throws Exception {
        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String inputFileContents = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\",\n" +
                "  \"runDataPerLanguage\": {" +
                "    \"apex\": {}\n" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke PmdRunner.run: The \"filesToScan\" field was missing or empty for language: apex"));
    }

    @Test
    void whenCallingRunWithEmptyArrayFor_filesToScan_thenError(@TempDir Path tempDir) throws Exception {
        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String inputFileContents = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\",\n" +
                "  \"runDataPerLanguage\": {" +
                "    \"apex\": {\n" +
                "      \"filesToScan\": []\n" +
                "    }\n" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke PmdRunner.run: The \"filesToScan\" field was missing or empty for language: apex"));
    }

    @Test
    void whenCallingRunWithInvalidLanguage_thenError(@TempDir Path tempDir) throws Exception {
        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String inputFileContents = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\",\n" +
                "  \"runDataPerLanguage\": {" +
                "    \"unknownLanguage\": {\n" +
                "      \"filesToScan\": [\"" + makePathJsonSafe(ruleSetInputFile) + "\"]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke PmdRunner.run: The language \"unknownLanguage\" is not recognized by PMD."));
    }

    @Test
    void whenCallingRunWithMissingField_ruleSetInputFile_thenError(@TempDir Path tempDir) throws Exception {
        String dummyApexFile = createTempFile(tempDir, "dummy.cls", "");
        String inputFileContents = "{" +
                "  \"runDataPerLanguage\": {" +
                "     \"apex\": {" +
                "       \"filesToScan\": [\"" + makePathJsonSafe(dummyApexFile) + "\"]" +
                "    }" +
                "  }" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String[] args = {"run", inputFile, "/does/not/matter"};
        RuntimeException thrown = assertThrows(RuntimeException.class, () -> callPmdWrapper(args));
        assertThat(thrown.getMessage(), is(
                "Error while attempting to invoke PmdRunner.run: The \"ruleSetInputFile\" field was missing."));
    }

    @Test
    void whenCallingMainWithRunAndValidArgs_thenItWritesValidJsonToFile(@TempDir Path tempDir) throws Exception {
        // Note that I am hard coding some files here because it is actually more work to put them in a resources folder
        // and then copy them to a temp directory (which is needed because the utility assumes absolute file paths).
        // But if this list grows, then we'll need to create a utility to make this easier.

        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String apexViolationCode = "public class OperationWithLimitsInLoop {\n" +
                "    public static void main() {\n" +
                "        for (Integer i = 0; i < 10; i++) {\n" +
                "            List<Account> accounts = [SELECT Id FROM Account];\n" +
                "        }\n" +
                "    }\n" +
                "}";
        String sampleApexFile = createTempFile(tempDir, "OperationWithLimitsInLoop.cls", apexViolationCode);

        String vfViolationCode = "<apex:page controller=\"testSELECT\">\n" +
                "    <script>\n" +
                "      console.log({!Name});\n" +
                "    </script>\n" +
                "</apex:page>";
        String sampleVfFile = createTempFile(tempDir, "VfUnescapeEl.page", vfViolationCode);

        String inputFileContents = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\",\n" +
                "  \"runDataPerLanguage\": {\n" +
                "    \"apex\": {\n" +
                "      \"filesToScan\": [\n" +
                "        \"" + makePathJsonSafe(sampleApexFile) + "\"" +
                "      ]\n" +
                "    },\n" +
                "    \"visualforce\": {\n" +
                "      \"filesToScan\": [\n" +
                "        \"" + makePathJsonSafe(sampleVfFile) + "\"" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("results.json").toAbsolutePath().toString();

        String[] args = {"run", inputFile, resultsOutputFile};
        String stdOut = callPmdWrapper(args); // Should not error

        // Assert results contain valid json and that the expected rule violations (note this is more thoroughly tested on the typescript side)
        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        JsonElement element = JsonParser.parseString(resultsJsonString); // Should not error
        assertThat(element.isJsonObject(), is(true));
        assertThat(resultsJsonString, allOf(
                containsString("\"rule\":\"OperationWithLimitsInLoop\""),
                containsString("\"rule\":\"VfUnescapeEl\"")
        ));

        // Assert stdOut contains arguments, progress information, and duration information (which help us with debugging)
        assertThat(stdOut, allOf(
                containsString("ARGUMENTS"),
                containsString("[Progress]50.0"),
                containsString("[Progress]100.0"),
                containsString("milliseconds")));
    }

    @Test
    void whenCallingRunWithAnInvalidApexFileWithValidApexFile_thenSkipInvalidApexFileWithProcessingErrorButStillProcessValidFile(@TempDir Path tempDir) throws Exception {
        String ruleSetInputFile = createSampleRulesetFile(tempDir);

        String invalidApexCode = "public class InvalidApexCode {\n" +
            "    #### OOPS \n" +
            "}";
        String invalidApexFile = createTempFile(tempDir, "InvalidApexCode.cls", invalidApexCode);

        String validApexCode = "public class ValidApexCode {\n" +
            "    public static void main() {\n" +
            "        for (Integer i = 0; i < 10; i++) {\n" +
            "            List<Account> accounts = [SELECT Id FROM Account];\n" +
            "        }\n" +
            "    }\n" +
            "}";
        String validApexFile = createTempFile(tempDir, "ValidApexCode.cls", validApexCode);

        String inputFileContents = "{\n" +
            "  \"ruleSetInputFile\":\"" + makePathJsonSafe(ruleSetInputFile) + "\",\n" +
            "  \"runDataPerLanguage\": {\n" +
            "    \"apex\": {\n" +
            "      \"filesToScan\": [\n" +
            "        \"" + makePathJsonSafe(invalidApexFile) + "\"," +
            "        \"" + makePathJsonSafe(validApexFile) + "\"" +
            "      ]\n" +
            "    }\n" +
            "  }\n" +
            "}";
        String inputFile = createTempFile(tempDir, "inputFile.json", inputFileContents);

        String resultsOutputFile = tempDir.resolve("results.json").toAbsolutePath().toString();

        String[] args = {"run", inputFile, resultsOutputFile};
        callPmdWrapper(args); // Should not error

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        JsonElement element = JsonParser.parseString(resultsJsonString); // Should not error
        assertThat(element.isJsonObject(), is(true));
        
        assertThat(resultsJsonString, containsString("{\"violations\":[{\"rule\":\"OperationWithLimitsInLoop\"")); // Contains the violation for the valid file
        assertThat(resultsJsonString, containsString("\"processingErrors\":[{\"file\":")); // Contains the processing error for the invalid file
    }

    @Test
    void whenRunningWithNcssCountRule_thenReportsOrExecutesSuccessfully(@TempDir Path tempDir) throws Exception {
        // Create a minimal ruleset that references the Apex NcssCount rule with a very low threshold
        String rulesetXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<ruleset name=\"Ruleset for NcssCount\"\n" +
                "    xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "    xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Run Apex NcssCount</description>\n" +
                "    <rule ref=\"category/apex/design.xml/NcssCount\">\n" +
                "      <properties>\n" +
                "        <property name=\"minimum\" value=\"1\"/>\n" +
                "      </properties>\n" +
                "    </rule>\n" +
                "</ruleset>";
        String rulesetFile = createTempFile(tempDir, "ncss-ruleset.xml", rulesetXml);

        // Create a simple Apex file with a few statements; the low threshold should trigger a violation
        String apexCode = "public class ManyStatements {\n" +
                "  public static void foo(){\n" +
                "    Integer a = 1; Integer b = 2; Integer c = 3; // multiple statements\n" +
                "  }\n" +
                "}\n";
        String apexFile = createTempFile(tempDir, "ManyStatements.cls", apexCode);

        String inputJson = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(rulesetFile) + "\",\n" +
                "  \"runDataPerLanguage\": {\n" +
                "    \"apex\": {\n" +
                "      \"filesToScan\": [\"" + makePathJsonSafe(apexFile) + "\"]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "input.json", inputJson);

        String resultsOutputFile = tempDir.resolve("results.json").toAbsolutePath().toString();
        String[] args = {"run", inputFile, resultsOutputFile};
        callPmdWrapper(args); // Should not error

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        JsonElement element = JsonParser.parseString(resultsJsonString); // Should not error
        assertThat(element.isJsonObject(), is(true));
    }

    @Test
    void whenRunningWithDeprecatedExcessiveClassLengthRule_thenExecutesSuccessfully(@TempDir Path tempDir) throws Exception {
        // Create a minimal ruleset referencing the Apex ExcessiveClassLength rule with a low threshold
        String rulesetXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<ruleset name=\"Ruleset for ExcessiveClassLength\"\n" +
                "    xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "    xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Run Apex ExcessiveClassLength</description>\n" +
                "    <rule ref=\"category/apex/design.xml/ExcessiveClassLength\">\n" +
                "      <properties>\n" +
                "        <property name=\"minimum\" value=\"5\"/>\n" +
                "      </properties>\n" +
                "    </rule>\n" +
                "</ruleset>";
        String rulesetFile = createTempFile(tempDir, "excessive-class-length.xml", rulesetXml);

        // Create an Apex class with enough lines to exceed the small threshold
        StringBuilder apexBuilder = new StringBuilder();
        apexBuilder.append("public class LargeClass {\n");
        apexBuilder.append("  public static void m0(){ Integer x0 = 0; }\n");
        apexBuilder.append("  public static void m1(){ Integer x1 = 1; }\n");
        apexBuilder.append("  public static void m2(){ Integer x2 = 2; }\n");
        apexBuilder.append("  public static void m3(){ Integer x3 = 3; }\n");
        apexBuilder.append("  public static void m4(){ Integer x4 = 4; }\n");
        apexBuilder.append("}\n");
        String apexFile = createTempFile(tempDir, "LargeClass.cls", apexBuilder.toString());

        String inputJson = "{\n" +
                "  \"ruleSetInputFile\":\"" + makePathJsonSafe(rulesetFile) + "\",\n" +
                "  \"runDataPerLanguage\": {\n" +
                "    \"apex\": {\n" +
                "      \"filesToScan\": [\"" + makePathJsonSafe(apexFile) + "\"]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        String inputFile = createTempFile(tempDir, "input-excessive-class-length.json", inputJson);

        String resultsOutputFile = tempDir.resolve("results-excessive-class-length.json").toAbsolutePath().toString();
        String[] args = {"run", inputFile, resultsOutputFile};
        callPmdWrapper(args); // Should not error

        String resultsJsonString = new String(Files.readAllBytes(Paths.get(resultsOutputFile)));
        JsonElement element = JsonParser.parseString(resultsJsonString); // Should not error
        assertThat(element.isJsonObject(), is(true));
    }


    // ===================== AST DUMP TESTS =====================

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

    private static String createSampleRulesetFile(Path tempDir) throws Exception {
        String ruleSetContents = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<ruleset name=\"Ruleset for Salesforce Code Analyzer\"\n" +
                "    xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "    xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "    xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Rules to Run for Salesforce Code Analyzer</description>\n" +
                "    <rule ref=\"category/visualforce/security.xml/VfUnescapeEl\" />\n" +
                "    <rule ref=\"category/apex/performance.xml/OperationWithLimitsInLoop\" />\n" +
                "</ruleset>";
        return createTempFile(tempDir, "ruleSetInputFile.xml", ruleSetContents);
    }

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

