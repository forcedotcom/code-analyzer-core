/** An expected engine error whose message is sufficient for the scan report. */
export class FlowAnalyzerError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.stack = undefined;
    }
}
