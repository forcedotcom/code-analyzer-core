package com.salesforce;

import com.google.common.annotations.VisibleForTesting;
import com.salesforce.cli.CacheCreator;
import com.salesforce.cli.CliArgParser;
import com.salesforce.cli.OutputFormatter;
import com.salesforce.cli.Result;
import com.salesforce.config.UserFacingMessages;
import com.salesforce.exception.ProgrammingException;
import com.salesforce.exception.SfgeException;
import com.salesforce.exception.SfgeRuntimeException;
import com.salesforce.exception.UnexpectedException;
import com.salesforce.exception.UserActionException;
import com.salesforce.graph.ops.GraphUtil;
import com.salesforce.metainfo.MetaInfoCollector;
import com.salesforce.metainfo.MetaInfoCollectorProvider;
import com.salesforce.rules.AbstractRule;
import com.salesforce.rules.AbstractRuleRunner;
import com.salesforce.rules.RuleRunner;
import com.salesforce.rules.Violation;
import com.salesforce.rules.ops.ProgressListenerProvider;

import java.io.FileWriter;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.tinkerpop.gremlin.process.traversal.dsl.graph.GraphTraversalSource;

/**
 * The main class, invoked by sfdx-scanner. The first arg should be either `catalog` or `execute`,
 * and determines which flow runs. <br>
 * For `catalog`, the second arg should be either `pathless`, `dfa`, or `all`. Enabled rules matching that
 * type will be written as a JSON to the file specified by the third arg. No meaningful environment variables
 * exist for this flow. Exit code 0 means success. Any other exit code means failure. <br>
 * For `execute`, the second arg should be the path to a JSON file whose contents are structured as:
 *
 * <ol>
 *   <li>rulesToRun: an array of rule names.
 *   <li>projectDirs: an array of directories from which the graph should be built.
 *   <li>targets: an array of objects with a `targetFile` property indicating the file to be
 *       analyzed and a `targetMethods` property that may optionally indicate individual methods
 *       within that file.
 * </ol>
 *
 * The third arg should be a file to which the results will be written as a JSON
 * The following exit codes are possible:
 *
 * <ol>
 *   <li>0: Successful run without violations.
 *   <li>1: Internal error with no violations.
 *   <li>4: Successful run with violations.5: Internal error with some violations.>
 * </ol>
 */
@SuppressWarnings(
        "PMD.SystemPrintln") // Since println is currently used to communicate to outer layer
public class Sfge {
    @VisibleForTesting static final int EXIT_GOOD_RUN = 0;
    @VisibleForTesting static final int EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS = 1;
    @VisibleForTesting static final int EXIT_WITH_INTERNAL_ERROR_AND_VIOLATIONS = 5;

    private static final Logger LOGGER = LogManager.getLogger(Sfge.class);
    public static final String ERROR_PREFIX = "SfgeErrorStart\n";

    private final Dependencies dependencies;

    public static void main(String[] args) {
        Sfge m = new Sfge();
        int status = m.process(args);
        System.exit(status);
    }

    Sfge() {
        this(new Dependencies());
    }

    @VisibleForTesting
    Sfge(Dependencies dependencies) {
        this.dependencies = dependencies;
    }

    @VisibleForTesting
    int process(String... args) {
        if (LOGGER.isInfoEnabled()) {
            LOGGER.info("Invoked with args=" + Arrays.asList(args));
        }
        if (args.length == 0) {
            // No args means we can't do anything productive.
            dependencies.printError(
                    UserFacingMessages.InvocationErrors.REQUIRES_AT_LEAST_ONE_ARGUMENT);
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        }

        CliArgParser parser = new CliArgParser();
        CliArgParser.CLI_ACTION action = parser.getCliAction(args);

        switch (action) {
            case CATALOG:
                return catalog(args);
            case EXECUTE:
                return execute(args);
            default:
                throw new ProgrammingException("Unhandled action: " + action);
        }
    }

    /** Expectations for args documented in class header above. */
    private int catalog(String... args) {
        LOGGER.info("Invoked CATALOG flow");
        CliArgParser.CatalogArgParser cap = new CliArgParser.CatalogArgParser();
        List<AbstractRule> rules;
        try {
            cap.parseArgs(args);
            rules = cap.getSelectedRules();
        } catch (SfgeException | SfgeRuntimeException ex) {
            dependencies.printError(ex.getMessage());
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        }
        OutputFormatter formatter = new OutputFormatter();
        dependencies.writeOutput(formatter.formatRuleJsons(rules), cap.getOutfile());
        return EXIT_GOOD_RUN;
    }

    /** Expectations for args documented in class header above. */
    private int execute(String... args) {
        LOGGER.info("Invoked EXECUTE flow");
        // Parse the arguments with our delegate class.
        CliArgParser.ExecuteArgParser eap = dependencies.createExecuteArgParser();
        try {
            eap.parseArgs(args);
        } catch (SfgeRuntimeException ex) {
            LOGGER.error("Error while parsing input arguments", ex);
            dependencies.printError(formatError(ex));
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        }

        // Collect additional information from other files in project
        try {
            collectMetaInfo(eap);
        } catch (MetaInfoCollector.MetaInfoLoadException ex) {
            LOGGER.error("Error while collecting meta info", ex);
            dependencies.printError(formatError(ex));
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        }

        // Initialize and clean our graph.
        GraphTraversalSource g = dependencies.getGraph();

        // Compile all of the Apex into ASTs.
        try {
            dependencies.loadSourceFoldersToGraph(eap, g);
        } catch (GraphUtil.GraphLoadException ex) {
            LOGGER.error("Error while loading graph", ex);
            dependencies.printError(formatError(ex));
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        } catch (UnexpectedException ex) {
            LOGGER.error("Unexpected exception while loading graph", ex);
            dependencies.printError(
                    "Unexpected exception while loading graph. See logs for more information.");
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        } catch (UserActionException ex) {
            LOGGER.error("User action expected: ", ex);
            dependencies.printError(formatError(ex));
            return EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS;
        }

        // Run all of the rules.
        final Result result = new Result();
        try {
            final List<AbstractRuleRunner.RuleRunnerTarget> targets = eap.getTargets();
            final List<AbstractRule> selectedRules = eap.getSelectedRules();
            if (LOGGER.isTraceEnabled()) {
                LOGGER.trace(
                        String.format(
                                "This many files: %d. This many rules: %d.",
                                targets.size(), selectedRules.size()));
            }
            final RuleRunner ruleRunner = dependencies.createRuleRunner(g);
            result.merge(ruleRunner.runRules(selectedRules, targets));

            // Mark analysis as completed
            ProgressListenerProvider.get().completedAnalysis();
        } finally {

            final List<Violation> violations = result.getOrderedViolations();
            OutputFormatter formatter = new OutputFormatter();
            dependencies.writeOutput(formatter.formatViolationJsons(violations), eap.getOutfile());

            // Check if any exceptions were thrown
            final List<Throwable> errorsThrown = result.getErrorsThrown();
            for (Throwable throwable : errorsThrown) {
                dependencies.printError(formatError(throwable));
            }

            // Create cache data, if any
            final CacheCreator cacheCreator = new CacheCreator();
            cacheCreator.create(result);

            if (!errorsThrown.isEmpty()) {
                return violations.isEmpty()
                        ? EXIT_WITH_INTERNAL_ERROR_NO_VIOLATIONS
                        : EXIT_WITH_INTERNAL_ERROR_AND_VIOLATIONS;
            }
            return EXIT_GOOD_RUN;
        }
    }

    private void collectMetaInfo(CliArgParser.ExecuteArgParser eap) {
        final Collection<? extends MetaInfoCollector> allCollectors =
                dependencies.getMetaInfoCollectors();

        for (MetaInfoCollector collector : allCollectors) {
            collector.loadProjectFiles(eap.getProjectDirs());

            // Let progress listener know about the meta information collected
            ProgressListenerProvider.get()
                    .collectedMetaInfo(
                            collector.getMetaInfoTypeName(), collector.getMetaInfoCollected());
        }
    }

    private String formatError(Throwable error) {
        return ERROR_PREFIX
                + (error.getCause() != null
                        ? String.format(
                                UserFacingMessages.CompilationErrors.EXCEPTION_FORMAT_TEMPLATE,
                                error.getMessage(),
                                error.getCause().getMessage())
                        : error.getMessage());
    }

    static class Dependencies {
        CliArgParser.ExecuteArgParser createExecuteArgParser() {
            return new CliArgParser.ExecuteArgParser();
        }

        Collection<? extends MetaInfoCollector> getMetaInfoCollectors() {
            return MetaInfoCollectorProvider.getAllCollectors();
        }

        GraphTraversalSource getGraph() {
            return GraphUtil.getGraph();
        }

        void loadSourceFoldersToGraph(CliArgParser.ExecuteArgParser eap, GraphTraversalSource g)
                throws GraphUtil.GraphLoadException {
            GraphUtil.loadSourceFolders(g, eap.getProjectDirs());
        }

        RuleRunner createRuleRunner(GraphTraversalSource g) {
            return new RuleRunner(g);
        }

        void printError(String message) {
            System.err.println(message);
        }

        void writeOutput(String output, String outfile) {
            try (FileWriter fileWriter = new FileWriter(outfile)) {
                fileWriter.write(output);
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        }
    }
}
