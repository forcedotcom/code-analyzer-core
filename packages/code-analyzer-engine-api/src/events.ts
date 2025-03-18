/**
 * Enum of event types that are available from an engine to listen to
 */
export enum EventType {
    LogEvent = "LogEvent",
    RunRulesProgressEvent = "RunRulesProgressEvent",
    DescribeRulesProgressEvent = "DescribeRulesProgressEvent"
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
 * Event emitted when an engine logs a message
 *   These events are received by callbacks provided to the {@link Engine.onEvent} for {@link EventType.LogEvent}.
 */
export type LogEvent = {
    type: EventType.LogEvent,
    logLevel: LogLevel,
    message: string
}

/**
 * Event that engines should emit during {@link Engine.runRules} to report the progress of the run.
 * These events are received by callbacks provided to the {@link Engine.onEvent} for {@link EventType.RunRulesProgressEvent}.
 */
export type RunRulesProgressEvent = {
    type: EventType.RunRulesProgressEvent,
    message?: string,
    percentComplete: number
}

/**
 * Event that engines should emit during {@link Engine.describeRules} to report the progress of the run.
 * These events are received by callbacks provided to the {@link Engine.onEvent} for {@link EventType.DescribeRulesProgressEvent}.
 */
export type DescribeRulesProgressEvent = {
    type: EventType.DescribeRulesProgressEvent,
    percentComplete: number
}

/**
 * Convenience type corresponding to each of the various events that can be emitted by an engine
 */
export type Event = LogEvent | RunRulesProgressEvent | DescribeRulesProgressEvent;