import {getMessage} from "./messages";
import {REGEX_STRING_PATTERN} from "./config";

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
