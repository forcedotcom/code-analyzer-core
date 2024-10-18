package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.rule.Rule;
import net.sourceforge.pmd.lang.rule.RuleSet;
import net.sourceforge.pmd.lang.rule.RuleSetLoadException;
import net.sourceforge.pmd.util.log.PmdReporter;
import org.slf4j.event.Level;

import javax.annotation.Nullable;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

class PmdRuleDescriber {
    /**
     * Map from language to the available standard rulesets.
     * Notes:
     *   - Language is a setting on the individual rule and not ruleset, but the standard rulesets are all organized
     *     by language, so we are safe to use this mapping.
     *   - We could get this information dynamically from pmd.newRuleSetLoader().getStandardRuleSets() but it is very
     *     slow which is why we hard code this list here (in order to boost performance).
     *   - A unit test exists to validate that this hard coded map is up-to-date.
     */
    static Map<String, Set<String>> LANGUAGE_TO_STANDARD_RULESETS = Map.of(
            "apex", Set.of(
                    "category/apex/bestpractices.xml",
                    "category/apex/codestyle.xml",
                    "category/apex/design.xml",
                    "category/apex/documentation.xml",
                    "category/apex/errorprone.xml",
                    "category/apex/performance.xml",
                    "category/apex/security.xml"
            ),
            "ecmascript", Set.of(
                    "category/ecmascript/bestpractices.xml",
                    "category/ecmascript/codestyle.xml",
                    "category/ecmascript/errorprone.xml",
                    "category/ecmascript/performance.xml"
            ),
            "html", Set.of(
                    "category/html/bestpractices.xml"
            ),
            "java", Set.of(
                    "category/java/bestpractices.xml",
                    "category/java/codestyle.xml",
                    "category/java/design.xml",
                    "category/java/documentation.xml",
                    "category/java/errorprone.xml",
                    "category/java/multithreading.xml",
                    "category/java/performance.xml",
                    "category/java/security.xml"
            ),
            "pom", Set.of(
                    "category/pom/errorprone.xml"
            ),
            "visualforce", Set.of(
                    "category/visualforce/security.xml"
            ),
            "xml", Set.of(
                    "category/xml/bestpractices.xml",
                    "category/xml/errorprone.xml"
            ),
            "xsl", Set.of(
                    "category/xsl/codestyle.xml",
                    "category/xsl/performance.xml"
            )
    );

    List<PmdRuleInfo> describeRulesFor(List<String> customRulesets, Set<String> languages) {
        List<PmdRuleInfo> ruleInfoList = new ArrayList<>();
        PMDConfiguration config = new PMDConfiguration();

        // Set Reported which will throw error during PmdAnalysis.create if a custom ruleset cannot be found
        config.setReporter(new PmdErrorListener());

        // Add in user specified custom rulesets, which must be added before standard rules so that they take preference
        // in case of duplication
        for (String customRuleset : customRulesets) {
            config.addRuleSet(customRuleset);
        }

        // Add in standard rulesets based on the languages specified
        for (String lang : languages) {
            for (String ruleSetFile : LANGUAGE_TO_STANDARD_RULESETS.get(lang)) {
                config.addRuleSet(ruleSetFile);
            }
        }

        // Keep track of "<language>::<ruleName>" so that we don't have duplicates
        Map<String, String> alreadySeen = new HashMap<>();

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            for (RuleSet ruleSet : pmd.getRulesets()) {
                for (Rule rule : ruleSet.getRules()) {

                    // Filter out custom rules that don't match languages specified
                    String language = rule.getLanguage().toString();
                    if (!languages.contains(language)) {
                        continue;
                    }

                    // Filter out any rules that we have already seen (duplicates) which can happen if user specifies a
                    // ruleset that references an existing rule
                    String langPlusName = language + "::" + rule.getName();
                    if(alreadySeen.containsKey(langPlusName)) {
                        System.out.println("Skipping rule \"" + rule.getName() + "\" for language \"" + language + "\" from ruleset \"" + ruleSet.getFileName() + "\"" +
                        " because we already added a rule with the same name and language from ruleset \"" + alreadySeen.get(langPlusName) + "\".");
                        continue;
                    }
                    alreadySeen.put(langPlusName, ruleSet.getFileName());

                    // Add rule info
                    PmdRuleInfo pmdRuleInfo = new PmdRuleInfo();
                    pmdRuleInfo.name = rule.getName();
                    pmdRuleInfo.language = language;
                    pmdRuleInfo.description = getLimitedDescription(rule);
                    pmdRuleInfo.externalInfoUrl = rule.getExternalInfoUrl();
                    pmdRuleInfo.ruleSet = rule.getRuleSetName();
                    pmdRuleInfo.priority = rule.getPriority().toString();
                    pmdRuleInfo.ruleSetFile = ruleSet.getFileName();
                    ruleInfoList.add(pmdRuleInfo);
                }
            }
        }

        return ruleInfoList;
    }

    private static String getLimitedDescription(Rule rule) {
        // Since the rule description can be long, we remove unnecessary whitespace and clip the message
        // so that users can read more on the website if it is over 500 characters long.
        String ruleDescription = rule.getDescription().trim()
                .replaceAll("\\s+"," ") // Switch to only use a single space whenever whitespace is found
                .replaceAll("\\[([^]]+)]\\([^)]+\\)", "$1"); // Remove markdown urls. i.e. replace "[phrase](<url>)" with "phrase"
        if (ruleDescription.length() > 500) {
            String clipText = "... Learn more: " +  rule.getExternalInfoUrl();

            int clipLocation = 500 - clipText.length();
            // Attempt to clip at some nearby whitespace instead of clipping the middle of a word
            for (int i = 0; i < 10; i++) {
                if (ruleDescription.charAt(clipLocation - i) == ' ') {
                    clipLocation = clipLocation - i;
                    break;
                }
            }

            ruleDescription = ruleDescription.substring(0, clipLocation) + clipText;
        }
        return ruleDescription;
    }
}

// This class simply helps us process any errors that may be thrown by PMD. By default PMD suppresses errors so that
// they are not thrown. So here, we look out for the errors that we care about and process it to throw a better
// error messages.
class PmdErrorListener implements PmdReporter {
    @Override
    public void logEx(Level level, @Nullable String s, Object[] objects, @Nullable Throwable throwable) {
        if (throwable != null) {
            String message = throwable.getMessage();
            if (throwable instanceof RuleSetLoadException && message.contains("Cannot load ruleset ")) {
                Pattern pattern = Pattern.compile("Cannot load ruleset (.+?):");
                Matcher matcher = pattern.matcher(message);
                if (matcher.find()) {
                    String ruleset = matcher.group(1).trim();
                    String errorMessage = "PMD errored when attempting to load a custom ruleset \"" + ruleset + "\". " +
                            "Make sure the resource is a valid file on disk or on the Java classpath.";

                    // The typescript side can more easily handle error messages that come from stdout with "[Error] " marker
                    System.out.println("[Error] " + errorMessage);
                    throw new RuntimeException(errorMessage, throwable);
                }
            }
            throw new RuntimeException("PMD threw an unexpected exception:\n" + message, throwable);
        }
    }

    // These methods aren't needed or used, but they are required to be implemented (since the interface does not give them default implementations)
    @Override
    public boolean isLoggable(Level level) {
        return false;
    }
    @Override
    public int numErrors() {
        return 0;
    }
}