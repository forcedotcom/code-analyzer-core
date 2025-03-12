package com.salesforce.messaging;

import java.util.List;

import com.google.common.collect.Lists;
import com.google.gson.Gson;

public class CliMessager {
    private static final String REALTIME_START = "SFCA-REALTIME-START";
    private static final String REALTIME_END = "SFCA-REALTIME-END";

	public static void postLogMessage(String internalLog, LogMessage.LogEventKey logEventKey, String... args) {
		final LogMessage logMessage = LogMessage.create(internalLog, logEventKey, args);
		final List<LogMessage> logMessages = Lists.newArrayList(logMessage);

		final String messageAsJson = new Gson().toJson(logMessages);
		System.out.println(REALTIME_START + messageAsJson + REALTIME_END);
	}

	public static void postProgressMessage(String internalLog, ProgressMessage.ProgressEventKey progressEventKey, int progressPercent, String... args) {
		final ProgressMessage progressMessage = ProgressMessage.create(internalLog, progressEventKey, progressPercent, args);
		final List<ProgressMessage> progressMessages = Lists.newArrayList(progressMessage);

		final String messageAsJson = new Gson().toJson(progressMessages);
		System.out.println(REALTIME_START + messageAsJson + REALTIME_END);
	}
}
