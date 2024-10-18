package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.rule.Rule;
import net.sourceforge.pmd.lang.rule.RuleSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class PmdRuleDescriberTest {
    private PmdRuleDescriber ruleDescriber;

    @BeforeEach
    void setup() {
        ruleDescriber = new PmdRuleDescriber();
    }

    @Test
    void testThatHardCodedStandardRulesetsAreUpToDate() {
        // Note that in the source code, we hard code the standard rulesets because the following dynamic way of getting
        // this information is really slow (adding a full second to the describe method). So we fetch dynamically once
        // to help catch when changes occur to the standard rulesets so that we can keep LANGUAGE_TO_STANDARD_RULESETS
        // up to date.
        Map<String, Set<String>> expectedMap = new HashMap<>();
        try (PmdAnalysis pmd = PmdAnalysis.create(new PMDConfiguration())) {
            for (RuleSet ruleSet : pmd.newRuleSetLoader().getStandardRuleSets()) {
                for (Rule rule : ruleSet.getRules()) {
                    String language = rule.getLanguage().toString();
                    if (!expectedMap.containsKey(language)) {
                        expectedMap.put(language, new HashSet<>());
                    }
                    expectedMap.get(language).add(ruleSet.getFileName());
                }
            }
        }

        // I could just compare the two maps, but I'd prefer to make the output very readable when things fail to help
        // show the diff between actual and expected... thus the loop and conversion to sorted lists:
        assertThat(PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.keySet(), is(expectedMap.keySet()));
        for (String language: PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.keySet()) {
            assertThat("For language: " + language, PmdRuleDescriber.LANGUAGE_TO_STANDARD_RULESETS.get(language).stream().sorted().collect(Collectors.toList()),
                    is(expectedMap.get(language).stream().sorted().collect(Collectors.toList())));
        }
    }

    @Test
    void whenDescribeRulesForApex_thenCorrectRulesAreReturned() {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("apex"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("apex"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "OperationWithLimitsInLoop", "apex");
        assertThat(ruleInfo.description, is("Database class methods, DML operations, SOQL queries, SOSL queries, Approval class methods, Email sending, async scheduling or queueing within loops can cause governor limit exceptions. Instead, try to batch up the data into a list and invoke the operation once on that list of data outside the loop."));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#operationwithlimitsinloop")));
        assertThat(ruleInfo.ruleSet, is("Performance"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/apex/performance.xml"));
    }

    @Test
    void whenDescribeRulesForJava_thenCorrectRulesAreReturned()  {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("java"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("java"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "AvoidReassigningParameters", "java");
        assertThat(ruleInfo.description, is("Reassigning values to incoming parameters of a method or constructor is not recommended, as this can make the code more difficult to understand. The code is often read with the assumption that parameter values don't change and an assignment violates therefore the principle of least astonishment. This is especially a problem if the parameter is documented e.g. in the method's... Learn more: " + ruleInfo.externalInfoUrl));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#avoidreassigningparameters")));
        assertThat(ruleInfo.ruleSet, is("Best Practices"));
        assertThat(ruleInfo.priority, is("Medium High"));
        assertThat(ruleInfo.ruleSetFile, is("category/java/bestpractices.xml"));
    }

    @Test
    void whenDescribeRulesForEcmascript_thenCorrectRulesAreReturned() {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("ecmascript"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("ecmascript"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "ForLoopsMustUseBraces", "ecmascript");
        assertThat(ruleInfo.description, is("Avoid using 'for' statements without using curly braces."));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#forloopsmustusebraces")));
        assertThat(ruleInfo.ruleSet, is("Code Style"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/ecmascript/codestyle.xml"));
    }

    @Test
    void whenDescribeRulesForVisualforce_thenCorrectRulesAreReturned()  {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("visualforce"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("visualforce"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "VfUnescapeEl", "visualforce");
        assertThat(ruleInfo.description, is("Avoid unescaped user controlled content in EL as it results in XSS."));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#vfunescapeel")));
        assertThat(ruleInfo.ruleSet, is("Security"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/visualforce/security.xml"));
    }

    @Test
    void whenDescribeRulesForXml_thenCorrectRulesAreReturned()  {
        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("xml"));
        assertThat(ruleInfoList.size(), is(greaterThan(0))); // Leaving this flexible. The actual list of rules are tested by typescript tests.
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            assertThat(ruleInfo.language, is("xml"));
        }

        // Sanity check one of the rules:
        PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "MissingEncoding", "xml");
        assertThat(ruleInfo.description, is("When the character encoding is missing from the XML declaration, the parser may produce garbled text. This is completely dependent on how the parser is set up and the content of the XML file, so it may be hard to reproduce. Providing an explicit encoding ensures accurate and consistent parsing."));
        assertThat(ruleInfo.externalInfoUrl, allOf(startsWith("https://"), endsWith(".html#missingencoding")));
        assertThat(ruleInfo.ruleSet, is("Best Practices"));
        assertThat(ruleInfo.priority, is("Medium"));
        assertThat(ruleInfo.ruleSetFile, is("category/xml/bestpractices.xml"));
    }

    @Test
    void whenDescribeRulesForMultipleLanguages_thenCorrectRulesAreReturned() {
        List<PmdRuleInfo> combinedRuleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("apex", "visualforce"));
        List<PmdRuleInfo> apexRuleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("apex"));
        List<PmdRuleInfo> visualforceRuleInfoList = ruleDescriber.describeRulesFor(List.of(), Set.of("visualforce"));
        assertThat(combinedRuleInfoList, hasSize(apexRuleInfoList.size() + visualforceRuleInfoList.size()));
    }

    @Test
    void whenDescribeRulesIsGivenCustomRulesetThatDoesNotExist_thenErrorWithNiceMessage() {
        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            Exception thrown = assertThrows(Exception.class, () ->
                    ruleDescriber.describeRulesFor(List.of("does/not/exist.xml"), Set.of("apex", "visualforce")));
            assertThat(thrown.getMessage(), is("PMD errored when attempting to load a custom ruleset \"does/not/exist.xml\". " +
                            "Make sure the resource is a valid file on disk or on the Java classpath."));
            }
    }

    @Test
    void whenDescribeRulesIsGivenCustomRulesetFromAbsolutePathOnDisk_thenReturnAssociatedRules(@TempDir Path tempDir) throws Exception {
        Path rulesetFile1 = tempDir.resolve("sampleRulesetFile1.xml");
        Files.write(rulesetFile1, createSampleRuleset("sampleRuleset1", "sampleRule1", "apex", 3).getBytes());
        Path rulesetFile2 = tempDir.resolve("sampleRulesetFile2.xml");
        Files.write(rulesetFile2, createSampleRuleset("sampleRuleset2", "sampleRule2", "visualforce", 5).getBytes());

        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(
                List.of(rulesetFile1.toAbsolutePath().toString(), rulesetFile2.toAbsolutePath().toString()),
                Set.of("apex", "visualforce"));

        PmdRuleInfo sampleRuleInfo1 = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "sampleRule1", "apex");
        assertThat(sampleRuleInfo1.description, is("Sample sampleRule1 description"));
        assertThat(sampleRuleInfo1.externalInfoUrl, is("https://sampleRule1.com"));
        assertThat(sampleRuleInfo1.ruleSet, is("sampleRuleset1"));
        assertThat(sampleRuleInfo1.priority, is("Medium"));
        assertThat(sampleRuleInfo1.ruleSetFile, is(rulesetFile1.toAbsolutePath().toString()));

        PmdRuleInfo sampleRuleInfo2 = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "sampleRule2", "visualforce");
        assertThat(sampleRuleInfo2.description, is("Sample sampleRule2 description"));
        assertThat(sampleRuleInfo2.externalInfoUrl, is("https://sampleRule2.com"));
        assertThat(sampleRuleInfo2.ruleSet, is("sampleRuleset2"));
        assertThat(sampleRuleInfo2.priority, is("Low"));
        assertThat(sampleRuleInfo2.ruleSetFile, is(rulesetFile2.toAbsolutePath().toString()));
    }

    @Test
    void whenDescribeRulesIsGivenCustomRulesetThatIsOnJavaClasspath_thenReturnAssociatedRules() throws Exception {
        // Unfortunately there is no dynamic way to update the java classpath to add more jars to it
        // from within a junit test (since java is already loaded and running). So we will leave the
        // case of testing a custom jar file to our typescript tests and just have this java test
        // check that if an existing ruleset (already bundled with PMD) is specified that it doesn't
        // cause any conflicts or errors.
        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(
                    List.of("category/java/codestyle.xml"),
                    Set.of("java"));

            assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "AtLeastOneConstructor", "java");
            assertThat(stdoutCaptor.getCapturedOutput(), containsString("Skipping rule "));
        }
    }

    @Test
    void whenDescribeRulesIsGivenCustomRulesetButCustomRuleLanguageIsNotSpecified_thenItIsOmitted(@TempDir Path tempDir) throws Exception {
        Path rulesetFile1 = tempDir.resolve("sampleRulesetFile1.xml");
        Files.write(rulesetFile1, createSampleRuleset("sampleRuleset1", "sampleRule1", "apex", 3).getBytes()); // Notice apex here...
        Path rulesetFile2 = tempDir.resolve("sampleRulesetFile2.xml");
        Files.write(rulesetFile2, createSampleRuleset("sampleRuleset2", "sampleRule2", "visualforce", 5).getBytes());

        List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(
                List.of(rulesetFile1.toAbsolutePath().toString(), rulesetFile2.toAbsolutePath().toString()),
                Set.of("java", "visualforce")); // ... but we don't have apex here but we do have visualforce...

        assertContainsNoRuleWithNameAndLanguage(ruleInfoList, "sampleRule1", "apex"); // ... thus this rule should not show
        assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "sampleRule2", "visualforce"); // Should show since visualforce is provided
        assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "AtLeastOneConstructor", "java"); // Should show since visualforce is provided
    }

    @Test
    void whenDescribeRulesIsGivenCustomRulesetThatContainsNameOfStandardRule_thenCustomRuleWins(@TempDir Path tempDir) throws Exception {
        Path rulesetFile = tempDir.resolve("sampleRulesetFile.xml");
        Files.write(rulesetFile, createSampleRuleset("sampleRuleset", "ApexCRUDViolation", "apex", 1).getBytes());

        try (StdOutCaptor stdoutCaptor = new StdOutCaptor()) {
            List<PmdRuleInfo> ruleInfoList = ruleDescriber.describeRulesFor(
                    List.of(rulesetFile.toAbsolutePath().toString()),
                    Set.of("apex"));

            PmdRuleInfo ruleInfo = assertContainsOneRuleWithNameAndLanguage(ruleInfoList, "ApexCRUDViolation", "apex");
            assertThat(ruleInfo.description, is("Sample ApexCRUDViolation description"));
            assertThat(ruleInfo.externalInfoUrl, is("https://ApexCRUDViolation.com"));
            assertThat(ruleInfo.ruleSet, is("sampleRuleset"));
            assertThat(ruleInfo.priority, is("High"));
            assertThat(ruleInfo.ruleSetFile, is(rulesetFile.toAbsolutePath().toString()));

            assertThat(stdoutCaptor.getCapturedOutput(), containsString(
                    "Skipping rule \"ApexCRUDViolation\" for language \"apex\" from ruleset \"category/apex/security.xml\" because we already added a rule with the same name and language from ruleset "));
        }
    }

    static String createSampleRuleset(String rulesetName, String ruleName, String language, int priority) {
        return "<ruleset name=\"" + rulesetName + "\"\n" +
                "         xmlns=\"http://pmd.sourceforge.net/ruleset/2.0.0\"\n" +
                "         xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "         xsi:schemaLocation=\"http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd\">\n" +
                "    <description>Sample " + rulesetName + " Description</description>\n" +
                "    <rule name=\"" + ruleName + "\" language=\"" + language + "\" message=\"Sample " + ruleName + " message\" class=\"net.sourceforge.pmd.lang.rule.xpath.XPathRule\" externalInfoUrl=\"https://" + ruleName + ".com\">\n" +
                "        <description>Sample " + ruleName + " description</description>\n" +
                "        <priority>" + priority + "</priority>\n" +
                "        <properties>\n" +
                "            <property name=\"xpath\">\n" +
                "                <value>\n" +
                "<![CDATA[\n" +
                "//MethodCallExpression[lower-case(@FullMethodName)='" + ruleName + "']\n" +
                "]]>\n" +
                "                </value>\n" +
                "            </property>\n" +
                "        </properties>\n" +
                "    </rule>\n" +
                "</ruleset>";
    }

    static PmdRuleInfo assertContainsOneRuleWithNameAndLanguage(List<PmdRuleInfo> ruleInfoList, String ruleName, String language) {
        PmdRuleInfo ruleFound = null;
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            if (ruleInfo.name.equals(ruleName) && ruleInfo.language.equals(language)) {
                if(ruleFound != null) {
                    throw new RuntimeException("The ruleInfoList contained more than one rule with name \"" + ruleName + "\" and language \"" + language + "\"");
                }
                ruleFound = ruleInfo;
            }
        }
        if (ruleFound == null) {
            throw new RuntimeException("The ruleInfoList failed to contain a rule with name \"" + ruleName + "\" and language \"" + language + "\"");
        }
        return ruleFound;
    }

    static void assertContainsNoRuleWithNameAndLanguage(List<PmdRuleInfo> ruleInfoList, String ruleName, String language) {
        for (PmdRuleInfo ruleInfo : ruleInfoList) {
            if (ruleInfo.name.equals(ruleName) && ruleInfo.language.equals(language)) {
                throw new RuntimeException("The ruleInfoList unexpectedly contained a rule with name \"" + ruleName + "\" and language \"" + language + "\"");
            }
        }
    }
}
