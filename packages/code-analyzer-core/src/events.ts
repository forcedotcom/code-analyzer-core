import * as engApi from "@salesforce/code-analyzer-engine-api"
import { EngineRunResults } from "./results"

/**
 * Enum of event types that are available from CodeAnalyzer to listen to
 */
export enum EventType {
    LogEvent = "LogEvent",
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
    Error = 1,
    Warn = 2,
    Info = 3,
    Debug = 4,
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
export type Event = LogEvent | RuleSelectionProgressEvent | EngineLogEvent | EngineTelemetryEvent | EngineRunProgressEvent | EngineResultsEvent;
