import {getMessage} from "./messages";
import {REGEX_STRING_PATTERN} from "./config";
import pLimit from 'p-limit';

const IS_WINDOWS: boolean = process.platform.startsWith('win');

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
    // Windows machines seem to hit limits easier than unix machines. For the number of open file descriptors (FDs), for
    // example, some Windows machines have max of 512. So using 400 to safely stay under windows limits. Regarding unix,
    // after doing some testing on unix, it seems that performance decreases when we go below 900, but there seems to be
    // no difference in performance for values over 1000. So using 1000 as the default for unix based machines.
    // To provide flexibility in debugging issues, we will allow users to set an undocumented environment variable
    // "SFCA_CONCURRENCY_LIMIT" if they still reach limits, like with https://github.com/forcedotcom/code-analyzer/issues/1832.
    private static readonly DEFAULT_CONCURRENCY_LIMIT: number = process.env.SFCA_CONCURRENCY_LIMIT !== undefined ?
        Number(process.env.SFCA_CONCURRENCY_LIMIT ) : (IS_WINDOWS ? 400 : 1000);
    private readonly limitFcn: pLimit.Limit;

    constructor(concurrencyLimit: number = PromiseExecutionLimiter.DEFAULT_CONCURRENCY_LIMIT) {
        this.limitFcn = pLimit(concurrencyLimit);
    }

    execute<T>(promiseFunctions: (() => Promise<T>)[]): Promise<T[]> {
        const wrappedPromises: Promise<T>[] = promiseFunctions.map(promiseFnc => this.limitFcn(promiseFnc));
        return Promise.all(wrappedPromises);
    }
}
