package com.salesforce.messaging;

import java.util.Arrays;
import java.util.List;

public class ProgressMessage {
    private final String messageKey;
    private final List<String> args;
    private final String internalLog;
    private final int progressPercent;

    public static ProgressMessage create(String internalLog, ProgressEventKey eventKey, int progressPercent, String[] args) {
        assert eventKey != null : "EventKey must not be null";

        assert eventKey.getArgCount() == args.length : "EventKey expected " + eventKey.getArgCount() + " args, received " + args.length;

        return new ProgressMessage(
                eventKey.getMessageKey(),
                Arrays.asList(args),
                internalLog,
                progressPercent
        );
    }

    private ProgressMessage(String messageKey, List<String> args, String internalLog, int progressPercent) {
        this.messageKey = messageKey;
        this.args = args;
        this.internalLog = internalLog;
        this.progressPercent = progressPercent;
    }

    public String getMessageKey() {
        return this.messageKey;
    }

    public List<String> getArgs() {
        return this.args;
    }

    public String getInternalLog() {
        return this.internalLog;
    }

    public int getProgressPercent() {
        return this.progressPercent;
    }

    public enum ProgressEventKey {
        COMPLETED_FILE_COMPILATION("progress_sfgeFinishedCompilingFiles", 1),
        STARTED_BUILDING_GRAPH("progress_sfgeStartedBuildingGraph", 0),
        COMPLETED_BUILDING_GRAPH("progress_sfgeFinishedBuildingGraph", 0),
        PATH_ENTRY_POINTS_IDENTIFIED("progress_sfgePathEntryPointsIdentified", 1),
        PATH_ANALYSIS_PROGRESS("progress_sfgeViolationsInPathProgress", 4),
        COMPLETED_PATH_ANALYSIS("progress_sfgeCompletedPathAnalysis", 3);

        private final String messageKey;
        private final int argCount;

        ProgressEventKey(String messageKey, int argCount) {
            this.messageKey = messageKey;
            this.argCount = argCount;
        }

        public String getMessageKey() {
            return this.messageKey;
        }

        public int getArgCount() {
            return this.argCount;
        }
    }
}
