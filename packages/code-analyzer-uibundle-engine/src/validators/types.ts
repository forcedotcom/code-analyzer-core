export interface ValidatorFinding {
    ruleName: string;
    message: string;
    file: string;
    startLine?: number;
    startColumn?: number;
}

export interface ValidatorResult {
    findings: ValidatorFinding[];
    skipped?: {
        reason: string;
    };
}
