// @ts-nocheck
// This file intentionally has violations for testing

function processData(data: string): string {
    debugger; // no-debugger violation
    const unusedVariable: number = 42; // no-unused-vars violation
    return data.toUpperCase();
}

export { processData };
