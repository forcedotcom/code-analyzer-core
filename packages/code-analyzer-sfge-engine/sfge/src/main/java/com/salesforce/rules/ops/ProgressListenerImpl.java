package com.salesforce.rules.ops;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Joiner;
import com.salesforce.config.SfgeConfigProvider;
import com.salesforce.graph.ApexPath;
import com.salesforce.messaging.CliMessager;
import com.salesforce.messaging.LogMessage;
import com.salesforce.messaging.ProgressMessage;
import com.salesforce.rules.Violation;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/** Publishes realtime information to CLI on the progress of analysis. */
public class ProgressListenerImpl implements ProgressListener {

    @VisibleForTesting static final String NONE_FOUND = "none found";

    private static final int COMPILATION_PROGRESS_PERCENT = 10;
    private static final int STARTED_BUILDING_GRAPH_COMPLETION_PERCENT = 15;
    private static final int COMPLETED_BUILDING_GRAPH_COMPLETION_PERCENT = 25;
    private static final int PATH_ENTRY_POINTS_IDENTIFIED_COMPLETION_PERCENT = 30;
    private static final int COMPLETED_PATH_ANALYSIS_COMPLETION_PERCENT = 90;

    private int filesCompiled = 0;
    private int pathsDetected = 0;
    private int lastPathCountReported = 0;
    private int violationsDetected = 0;
    private int entryPointsAnalyzed = 0;
    private int totalEntryPoints = 0;

    private final int progressIncrements;

    static ProgressListener getInstance() {
        return ProgressListenerImpl.LazyHolder.INSTANCE;
    }

    private static final class LazyHolder {
        private static final ProgressListenerImpl INSTANCE = new ProgressListenerImpl();
    }

    @VisibleForTesting
    ProgressListenerImpl() {
        progressIncrements = SfgeConfigProvider.get().getProgressIncrements();
    }

    @Override
    public void collectedMetaInfo(String metaInfoType, TreeSet<String> itemsCollected) {
        final String items = stringify(itemsCollected);
        CliMessager.postLogMessage("Meta information collected", LogMessage.LogEventKey.DEBUG_METAINFO_COLLECTED, metaInfoType, items);
    }

    @Override
    public void compiledAnotherFile() {
        filesCompiled++;
    }

    @Override
    public void finishedFileCompilation() {
        CliMessager.postProgressMessage("Finished compiling files",
                ProgressMessage.ProgressEventKey.COMPLETED_FILE_COMPILATION,
                COMPILATION_PROGRESS_PERCENT,
                String.valueOf(filesCompiled));
    }

    @Override
    public void startedBuildingGraph() {
        CliMessager.postProgressMessage("Started building graph",
                ProgressMessage.ProgressEventKey.STARTED_BUILDING_GRAPH,
                STARTED_BUILDING_GRAPH_COMPLETION_PERCENT);
    }

    @Override
    public void completedBuildingGraph() {
        CliMessager.postProgressMessage("Finished building graph",
                ProgressMessage.ProgressEventKey.COMPLETED_BUILDING_GRAPH,
                COMPLETED_BUILDING_GRAPH_COMPLETION_PERCENT);
    }

    @Override
    public void pathEntryPointsIdentified(int pathEntryPointsCount) {
        totalEntryPoints = pathEntryPointsCount;
        CliMessager.postProgressMessage(
                "Path entry points identified",
                ProgressMessage.ProgressEventKey.PATH_ENTRY_POINTS_IDENTIFIED,
                PATH_ENTRY_POINTS_IDENTIFIED_COMPLETION_PERCENT,
                String.valueOf(totalEntryPoints)
        );
    }

    @Override
    public void finishedAnalyzingEntryPoint(List<ApexPath> paths, Set<Violation> violations) {
        pathsDetected += paths.size();
        violationsDetected += violations.size();
        entryPointsAnalyzed++;
        int progressMultiplier = COMPLETED_PATH_ANALYSIS_COMPLETION_PERCENT - PATH_ENTRY_POINTS_IDENTIFIED_COMPLETION_PERCENT;
        double percentageOfEntryPointsAnalyzed = (double) entryPointsAnalyzed / (double) totalEntryPoints;
        int completionPercent = (int) Math.round(percentageOfEntryPointsAnalyzed * progressMultiplier) + PATH_ENTRY_POINTS_IDENTIFIED_COMPLETION_PERCENT;

        // Make a post only if we have more paths detected than the progress increments
        // since the last time we posted.
        if (pathsDetected - lastPathCountReported >= progressIncrements) {
            CliMessager.postProgressMessage(
                    "Count of violations in paths, entry points",
                    ProgressMessage.ProgressEventKey.PATH_ANALYSIS_PROGRESS,
                    completionPercent,
                    String.valueOf(violationsDetected),
                    String.valueOf(pathsDetected),
                    String.valueOf(entryPointsAnalyzed),
                    String.valueOf(totalEntryPoints)
            );

            lastPathCountReported = pathsDetected;
        }
    }

    @Override
    public void completedAnalysis() {
        CliMessager.postProgressMessage(
                "Completed analysis stats",
                ProgressMessage.ProgressEventKey.COMPLETED_PATH_ANALYSIS,
                COMPLETED_PATH_ANALYSIS_COMPLETION_PERCENT,
                String.valueOf(pathsDetected),
                String.valueOf(entryPointsAnalyzed),
                String.valueOf(violationsDetected)
        );
    }

    @VisibleForTesting
    String stringify(Collection<String> items) {
        return (items.isEmpty()) ? NONE_FOUND : Joiner.on(',').join(items);
    }

    @VisibleForTesting
    void reset() {
        filesCompiled = 0;
        pathsDetected = 0;
        lastPathCountReported = 0;
        violationsDetected = 0;
        entryPointsAnalyzed = 0;
    }

    @VisibleForTesting
    int getFilesCompiled() {
        return filesCompiled;
    }

    @VisibleForTesting
    int getPathsDetected() {
        return pathsDetected;
    }

    @VisibleForTesting
    int getLastPathCountReported() {
        return lastPathCountReported;
    }

    @VisibleForTesting
    int getViolationsDetected() {
        return violationsDetected;
    }

    @VisibleForTesting
    int getEntryPointsAnalyzed() {
        return entryPointsAnalyzed;
    }
}
