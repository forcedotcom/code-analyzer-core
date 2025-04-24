import * as engApi from "@salesforce/code-analyzer-engine-api"
import { EngineRunResults } from "./results"

/**
 * Enum of event types that are available from CodeAnalyzer to listen to
 */
export enum EventType {
    LogEvent = "LogEvent",
    TelemetryEvent = "TelemetryEvent",
    RuleSelectionProgressEvent = "RuleSelectionProgressEvent",
    EngineLogEvent = "EngineLogEvent",
    EngineTelemetryEvent = "EngineTelemetryEvent",
    EngineRunProgressEvent = "EngineRunProgressEvent",
    EngineResultsEvent = "EngineResultsEvent"
}

/**
 * Enum of Log Levels
 */
export enum LogLevel {
    /**
     * Level where error messages are included in the log.
     * At this level no other messages are included in the log.
     */
    Error = 1,

    /**
     * Level where warning messages are included in the log.
     * Additionally, at this level error messages are also included in the log.
     */
    Warn = 2,

    /**
     * Level where informative messages are included in the log.
     * Additionally, at this level warning and error messages are also included in the log.
     */
    Info = 3,

    /**
     * Level where debug messages, which give users additional context, are included in the log.
     * Additionally, at this level informative, warning, and error messages are also included in the log.
     */
    Debug = 4,

    /**
     * Level at which fine detail messages, for internal Salesforce developers to help troubleshoot issues, are included in the log.
     * Additionally, at this level debug, informative, warning, and error messages are also included in the log.
     */
    Fine = 5
}

/**
 * Event emitted when Code Analyzer logs a message
 *   These events are received by callbacks provided to the {@link CodeAnalyzer.onEvent} for {@link EventType.LogEvent}.
 */
export type LogEvent = {
    type: EventType.LogEvent,
    timestamp: Date,
    logLevel: LogLevel,
    message: string
}

export type TelemetryData = engApi.TelemetryData;

export type TelemetryEvent = {
    type: EventType.TelemetryEvent,
    timestamp: Date,
    eventName: string,
    uuid: string,
    data: TelemetryData
}

/**
 * Event emitted to report the progress of an invocation of {@link CodeAnalyzer.selectRules}
 *   These events are received by callbacks provided to the {@link CodeAnalyzer.onEvent} for {@link EventType.RuleSelectionProgressEvent}.
 */
export type RuleSelectionProgressEvent = {
    type: EventType.RuleSelectionProgressEvent,
    timestamp: Date,
    percentComplete: number
}

/**
 * Event emitted when an engine logs a message
 *   These events are received by callbacks provided to the {@link CodeAnalyzer.onEvent} for {@link EventType.EngineLogEvent}.
 */
export type EngineLogEvent = {
    type: EventType.EngineLogEvent,
    timestamp: Date,
    engineName: string
    logLevel: LogLevel,
    message: string
}

/**
 * Event emitted when an engine wants to send a telemetry event.
 * These events are received by callbacks provided to the {@link CodeAnalyzer.onEvent} method for {@link EventType.EngineTelemetryEvent}.
 */
export type EngineTelemetryEvent = {
    type: EventType.EngineTelemetryEvent,
    timestamp: Date,
    engineName: string,
    eventName: string,
    uuid: string,
    data: TelemetryData
}

/**
 * Event emitted when an engine reports on its run progress
 *   These events are received by callbacks provided to the {@link CodeAnalyzer.onEvent} for {@link EventType.EngineRunProgressEvent}.
 */
export type EngineRunProgressEvent = {
    type: EventType.EngineRunProgressEvent,
    timestamp: Date,
    engineName: string,
    percentComplete: number,
    message?: string
}

/**
 * Event emitted when an engine finishes running rules in order to immediately provide its {@link EngineRunResults}
 *   These events are received by callbacks provided to the {@link CodeAnalyzer.onEvent} for {@link EventType.EngineResultsEvent}.
 */
export type EngineResultsEvent = {
    type: EventType.EngineResultsEvent
    timestamp: Date,
    results: EngineRunResults
}

/**
 * Convenience type corresponding to each of the various events that can be emitted by Code Analyzer
 */
export type Event = LogEvent | TelemetryEvent | RuleSelectionProgressEvent | EngineLogEvent | EngineTelemetryEvent | EngineRunProgressEvent | EngineResultsEvent;
