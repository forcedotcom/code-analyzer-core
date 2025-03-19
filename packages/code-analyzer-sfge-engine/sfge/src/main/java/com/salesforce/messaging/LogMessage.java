package com.salesforce.messaging;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

public class LogMessage {
    private final String messageKey;
    private final List<String> args;
    private final String internalLog;
    private final MessageSeverity messageSeverity;
    private final long time;

    public static LogMessage create(String internalLog, LogEventKey eventKey, String[] args) {
        assert eventKey != null : "EventKey must not be null";

        assert eventKey.getArgCount() == args.length : "EventKey expected " + eventKey.getArgCount() + " args, received " + args.length;

        return new LogMessage(
                eventKey.getMessageKey(),
                Arrays.asList(args),
                internalLog,
                eventKey.getMessageSeverity()
        );
    }

    private LogMessage(String messageKey, List<String> args, String internalLog, MessageSeverity messageSeverity) {
        this.messageKey = messageKey;
        this.args = args;
        this.internalLog = internalLog;
        this.messageSeverity = messageSeverity;
        this.time = Instant.now().toEpochMilli();
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

    public MessageSeverity getMessageSeverity() {
        return this.messageSeverity;
    }

    public long getTime() {
        return this.time;
    }

    public enum LogEventKey {
        DEBUG_GENERAL("debug_sfgeInfoLog", 1, MessageSeverity.DEBUG),
        DEBUG_METAINFO_COLLECTED("debug_sfgeMetaInfoCollected", 2, MessageSeverity.DEBUG),
        WARNING_GENERAL("warning_sfgeWarnLog", 1, MessageSeverity.WARNING),
        WARNING_MULTIPLE_METHOD_TARGET_MATCHES("warning_multipleMethodTargetMatches", 3, MessageSeverity.WARNING),
        WARNING_NO_METHOD_TARGET_MATCHES("warning_noMethodTargetMatches", 2, MessageSeverity.WARNING),
        ERROR_GENERAL("error_external_sfgeErrorLog", 1, MessageSeverity.ERROR),
        TELEMETRY("info_telemetry", 1, MessageSeverity.TELEMETRY);

        private final String messageKey;
        private final int argCount;
        private final MessageSeverity messageSeverity;

        LogEventKey(String messageKey, int argCount, MessageSeverity messageSeverity) {
            this.messageKey = messageKey;
            this.argCount = argCount;
            this.messageSeverity = messageSeverity;
        }

        public String getMessageKey() {
            return this.messageKey;
        }

        public int getArgCount() {
            return this.argCount;
        }

        public MessageSeverity getMessageSeverity() {
            return this.messageSeverity;
        }
    }

    public enum MessageSeverity {
        TELEMETRY,
        DEBUG,
        INFO,
        WARNING,
        ERROR
    }
}
