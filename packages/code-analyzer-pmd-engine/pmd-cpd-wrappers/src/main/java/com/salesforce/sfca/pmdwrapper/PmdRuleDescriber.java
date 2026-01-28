package com.salesforce.sfca.pmdwrapper;

import net.sourceforge.pmd.PMDConfiguration;
import net.sourceforge.pmd.PmdAnalysis;
import net.sourceforge.pmd.lang.rule.Rule;
import net.sourceforge.pmd.lang.rule.RuleSet;
import net.sourceforge.pmd.lang.rule.RuleSetLoadException;
import net.sourceforge.pmd.util.log.PmdReporter;
import org.slf4j.event.Level;

import javax.annotation.Nullable;
import java.text.MessageFormat;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.stream.Collectors;

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
        Map<String, PmdRuleInfo> ruleInfoMap = new HashMap<>();
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

        try (PmdAnalysis pmd = PmdAnalysis.create(config)) {
            for (RuleSet ruleSet : pmd.getRulesets()) {
                for (Rule rule : ruleSet.getRules()) {

                    // Filter out custom rules that don't match languages specified
                    String language = rule.getLanguage().toString();
                    if (!languages.contains(language)) {
                        continue;
                    }

                    String ruleSetFile = ruleSet.getFileName();

                    // Filter out any rules that we have already seen (duplicates) which can happen if user specifies a
                    // ruleset that references an existing rule
                    String langPlusName = language + "::" + rule.getName();
                    if(ruleInfoMap.containsKey(langPlusName)) {
                        System.out.println("Skipping rule \"" + rule.getName() + "\" for language \"" + language + "\" from ruleset \"" + ruleSetFile + "\"" +
                        " because we already added a rule with the same name and language from ruleset \"" + ruleInfoMap.get(langPlusName).ruleSetFile + "\".");

                        // Update the existing ruleInfo so that it contains all ruleSets
                        ruleInfoMap.get(langPlusName).ruleSets.add(ruleSet.getName());
                        continue;
                    }

                    // Add rule info
                    PmdRuleInfo pmdRuleInfo = new PmdRuleInfo();
                    pmdRuleInfo.name = rule.getName();
                    pmdRuleInfo.languageId = language;
                    pmdRuleInfo.description = getLimitedDescription(rule);
                    pmdRuleInfo.externalInfoUrl = rule.getExternalInfoUrl();
                    pmdRuleInfo.ruleSets.add(ruleSet.getName());
                    pmdRuleInfo.priority = rule.getPriority().toString(); // If priority isn't set in ruleset file, then PMD uses "Low" by default. So no need for null check here.
                    pmdRuleInfo.ruleSetFile = ruleSetFile;
                    ruleInfoMap.put(langPlusName, pmdRuleInfo);
                }
            }
        }

        return new ArrayList<>(ruleInfoMap.values());
    }

    private static String getLimitedDescription(Rule rule) {
        // Since the rule description can be long, we remove unnecessary whitespace and clip the message
        // so that users can read more on the website if it is over 500 characters long.
        String ruleDescription = Objects.requireNonNullElse(rule.getDescription(),"").trim()
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

// This class simply helps us process any errors that may be thrown by PMD. By default, PMD suppresses errors so that
// they are not thrown. So here, we look out for the errors that we care about and process it to throw a better
// error messages. We override the logEx method in particular because all other error methods call through to logEx.
class PmdErrorListener implements PmdReporter {
    @Override
    public void logEx(Level level, @Nullable String s, Object[] objects, @Nullable Throwable throwable) {
        // Unified handling for PMD log events:
        //  - If a Throwable is present, decide whether to surface it as a specific ruleset load error
        //    (more actionable message) or as a generic unexpected PMD exception.
        //  - If there is no Throwable:
        //      * A WARN containing a deprecation notice ("Discontinue using Rule ...") is surfaced
        //        as a non-fatal [Warning] to stdout so callers can display it.
        //      * Any other message is unexpected for our flows; fail fast with a RuntimeException
        //        so configuration/environment issues are not silently ignored.
        if (throwable != null) {
            handleThrowable(throwable);
            return;
        }
        if (s == null) {
            return; // nothing to report
        }
        final String message = MessageFormat.format(s, objects);
        if (level == Level.WARN && isDeprecationWarning(message)) {
            // Non-fatal deprecation: make it easy to capture and display without failing the operation
            printStdout("Warning", message);
            return;
        }
        // Any other logged message without a throwable is unexpected → fail fast
        throw new RuntimeException("PMD threw an unexpected exception:\n" + message);
    }

    /**
     * Handles PMD throwables emitted through the reporter.
     * - For RuleSetLoadException we extract the ruleset reference and provide a clearer message.
     * - Otherwise we surface a generic unexpected PMD exception.
     */
    private static void handleThrowable(Throwable t) {
        final String msg = t.getMessage();
        if (t instanceof RuleSetLoadException && msg != null && msg.contains("Cannot load ruleset ")) {
            final String ruleset = extractRuleset(msg);
            final String formatted = "PMD errored when attempting to load a custom ruleset \"" + ruleset + "\". " +
                    "Make sure the resource is a valid ruleset file on disk or on the Java classpath.\n\n" +
                    "PMD Exception: \n" + msg.lines().map(l -> "  | " + l).collect(Collectors.joining("n"));
            // The TypeScript side can more easily handle error messages that come from stdout with "[Error]" marker.
            printStdout("Error", formatted);
            throw new RuntimeException(formatted, t);
        }
        throw new RuntimeException("PMD threw an unexpected exception:\n" + msg, t);
    }

    /** Returns true if this is a deprecation warning PMD emits for legacy rule references. */
    private static boolean isDeprecationWarning(String msg) {
        return msg.contains("Discontinue using Rule ");
    }

    /** Extracts the ruleset path from PMD's "Cannot load ruleset ..." message. */
    private static String extractRuleset(String msg) {
        Matcher m = Pattern.compile("Cannot load ruleset (.+?): ").matcher(msg);
        return m.find() ? m.group(1).trim() : "<unknown>";
    }

    /** Prints a tagged message to stdout, replacing newlines for easy single-line capture. */
    private static void printStdout(String kind, String msg) {
        System.out.println("[" + kind + "] " + msg.replaceAll("\n","{NEWLINE}"));
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