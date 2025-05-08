import {getMessage} from "./messages";
import {REGEX_STRING_PATTERN} from "./config";
import pLimit from 'p-limit';

export function convertToRegex(value: string): RegExp {
    const match: RegExpMatchArray | null = value.match(REGEX_STRING_PATTERN);
    if (!match) {
        throw new Error(getMessage('InvalidRegexDueToBadPattern', value, REGEX_STRING_PATTERN.toString()));
    }
    const pattern: string = match[1];
    const modifiers: string = match[2];

    if (!modifiers.includes('g')){
        throw new Error(getMessage('InvalidRegexDueToGlobalModifierNotProvided', value, `/${pattern}/g${modifiers}`));
    }

    try {
        return new RegExp(pattern, modifiers);
    } catch (err) {
        /* istanbul ignore next */
        const errMsg: string = err instanceof Error ? err.message : String(err);
        throw new Error(getMessage('InvalidRegexDueToError', value, errMsg), {cause: err});
    }
}

/**
 * Utility that can help replace "Promise.all" calls so that you can limit how many promises are executed concurrently at a given time.
 *
 * Basically if you have someFunction that takes in a value and that produces a Promise<T> and have something like:
 *     const promises: Promise<T> = someArray.map(elem => someFunction(elem));
 *     const outputs: T[] = await Promise.all(promises);
 * then this could be very expensive and may use up your machine resources (like if someFunction opens/closes files).
 *
 * Instead, you might want to limit how many promises are executed at a given time, by delaying the creation of the
 * promises and executing them with a limit of how many promises can concurrently run at a given time by the following:
 *     const promiseLimiter: PromiseExecutionLimiter = new PromiseExecutionLimiter(200);
 *     const promiseFunctions: (()=>Promise<T>)[] = someArray.map(elem => ()=>someFunction(elem));
 *     const outputs: T[] = await promiseLimiter.execute(promiseFunctions);
 * which would execute just 200 promises at most at a given time.
 */
export class PromiseExecutionLimiter {
    private readonly limitFcn: pLimit.Limit;

    constructor(concurrencyLimit: number = 1000) {
        this.limitFcn = pLimit(concurrencyLimit);
    }

    execute<T>(promiseFunctions: (() => Promise<T>)[], concurrencyLimit: number = 1000): Promise<T[]> {
        const limit: pLimit.Limit = pLimit(concurrencyLimit);
        const wrappedPromises: Promise<T>[] = promiseFunctions.map(promiseFnc => limit(promiseFnc));
        return Promise.all(wrappedPromises);
    }
}
