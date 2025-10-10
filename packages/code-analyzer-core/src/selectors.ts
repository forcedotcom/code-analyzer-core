import { getMessage } from "./messages";

export interface Selector {
    matchesSelectables(selectables: string[]): boolean;
}

export function toSelector(selectorString: string): Selector {
    if (selectorString === '') {
        // ERROR CASE: The selector is empty. Possible if you do something like "()" or "a:()".
        throw new Error(getMessage("SelectorCannotBeEmpty"));
    }

    let commaIdx: number|null = null;
    let colonIdx: number|null = null;
    let parenBalance: number = 0;
    let hasParens: boolean = false;
    for (let i = 0; i < selectorString.length; i++) {
        const char: string = selectorString[i];
        if ((i === 0 || i === selectorString.length - 1) && (char === ',' || char === ':')) {
            // ERROR CASE: The selector cannot start or end with a binary operator, because that's nonsense.
            throw new Error(getMessage("SelectorStartsOrEndsWithOperator", selectorString));
        } else if (char === ' ') {
            // ERROR CASE: The selector contains whitespace.
            throw new Error(getMessage("SelectorLooksIncorrect", selectorString));
        } else if (char === '(') {
            parenBalance += 1;
            hasParens = true;
        } else if (char === ')') {
            parenBalance -= 1;
            hasParens = true;
            // If our parenthesis balance is negative, it means there are more close-parens than open-parens, which is a problem.
            if (parenBalance < 0) {
                throw new Error(getMessage("SelectorLooksIncorrect", selectorString));
            }
        } else if (char === ',') {
            // If we're not inside of parentheses, and we haven't already found a comma, note the location of this one.
            if (parenBalance === 0 && commaIdx === null) {
                commaIdx = i;
            }
        } else if (char === ':') {
            // If we're not inside of parentheses, and we haven't already found a colon, note the location of this one.
            if (parenBalance === 0 && colonIdx === null) {
                colonIdx = i;
            }
        }
    }

    // If our final parenthesis balance is negative, it means there are more open-parens than close-parens, which is a problem.
    if (parenBalance > 0) {
        throw new Error(getMessage("SelectorLooksIncorrect", selectorString));
    }

    // Commas trump colons, so if we have a comma, split along that.
    if (commaIdx != null) {
        const left: string = selectorString.slice(0, commaIdx);
        const right: string = selectorString.slice(commaIdx + 1);
        return new OrSelector(toSelector(left), toSelector(right));
    } else if (colonIdx != null) {
        // If there are colons but no commas, split along the first colon.
        const left: string = selectorString.slice(0, colonIdx);
        const right: string = selectorString.slice(colonIdx + 1);
        return new AndSelector(toSelector(left), toSelector(right));
    } else if (selectorString[0] === '(' && selectorString[selectorString.length - 1] === ')') {
        // If the first and last character are parentheses, then pop those off and run again.
        return toSelector(selectorString.slice(1, selectorString.length - 1));
    } else if (hasParens) {
        // There shouldn't be parentheses in the middle of a selector that has no operators.
        throw new Error(getMessage('SelectorLooksIncorrect', selectorString));
    } else {
        // A string with no operators or problems is just a simple string-selector.
        return new SimpleSelector(selectorString);
    }
}

class SimpleSelector implements Selector {
    private readonly selector: string;

    constructor(selector: string) {
        this.selector = selector;
    }

    public matchesSelectables(selectables: string[]): boolean {
        return selectables.some(s => s === this.selector.toLowerCase());
    }
}

class AndSelector implements Selector {
    private readonly left: Selector;
    private readonly right: Selector;

    constructor(left: Selector, right: Selector) {
        this.left = left;
        this.right = right;
    }

    public matchesSelectables(selectables: string[]): boolean {
        return this.left.matchesSelectables(selectables) && this.right.matchesSelectables(selectables);
    }
}

class OrSelector implements Selector {
    private readonly left: Selector;
    private readonly right: Selector;

    constructor(left: Selector, right: Selector) {
        this.left = left;
        this.right = right;
    }

    public matchesSelectables(selectables: string[]): boolean {
        return this.left.matchesSelectables(selectables) || this.right.matchesSelectables(selectables);
    }
}
