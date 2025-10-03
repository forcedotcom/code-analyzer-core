import { getMessage } from "./messages";

export interface Selector {
    matchesSelectables(selectables: string[]): boolean;
}

export function toSelector(selectorString: string): Selector {
    // We parse the selector back-to-front, so that the front-most selectors end up at the bottom of the tree we create
    // and therefore get resolved first.
    console.log(`selector is ${selectorString}`);
    if (selectorString === '') {
        console.log('a');
        // ERROR CASE: The selector is empty. Possible if you do something like "()" or "a:()".
        throw new Error(getMessage("SelectorCannotBeEmpty"));
    } else if (selectorString.endsWith(')')) {
        console.log('b');
        // If the selector ends in close-paren, then we need to find the open-paren that matches it.
        const correspondingOpenParen: number = identifyCorrespondingOpenParen(selectorString);
        if (correspondingOpenParen === 0) {
            // RECURSIVE CASE: The entire selector is wrapped in parens. Pop them off and call recursively.
            return toSelector(selectorString.slice(1, -1))
        } else {
            // RECURSIVE CASE: The open-paren is somewhere in the middle of the selector and accompanied by an operator.
            const left: string = selectorString.slice(0, correspondingOpenParen - 1);
            const right: string = selectorString.slice(correspondingOpenParen);
            const op: string = selectorString[correspondingOpenParen - 1];
            return toComplexSelector(left, right, op);
        }
    } else {
        // If there's a close-paren in the string, only look for operators after it.
        const lastCloseParen: number = Math.max(selectorString.lastIndexOf(')'), 0);
        const lastComma: number = selectorString.slice(lastCloseParen).lastIndexOf(',');
        const lastColon: number = selectorString.slice(lastCloseParen).lastIndexOf(':');

        // BASE CASE: The selector contains no commas or colons.
        if (lastComma === -1 && lastColon === -1) {
            // Parens only make sense in conjunction with operators, so if we find any, the selector is malformed.
            if (selectorString.includes(')') || selectorString.includes('(')) {
                throw new Error(getMessage('SelectorLooksIncorrect', selectorString));
            }
            return new SimpleSelector(selectorString);
        } else if (lastComma !== -1) {
            // Commas resolve before colons, so that "x,a:b" and "a:b,x" both resolve equivalently the combination of
            // "x" and "a:b".
            const left: string = selectorString.slice(0, lastComma + lastCloseParen);
            const right: string = selectorString.slice(lastComma + lastCloseParen + 1);
            return toComplexSelector(left, right, ',');
        } else {
            const left: string = selectorString.slice(0, lastColon + lastCloseParen);
            const right: string = selectorString.slice(lastColon + lastCloseParen + 1);
            return toComplexSelector(left, right, ':');
        }
    }
}

function identifyCorrespondingOpenParen(selectorString: string): number {
    const reversedLetters: string[] = selectorString.split('').reverse();
    let parenBalance: number = 0;
    let idx = 0;
    for (const letter of reversedLetters) {
        if (letter === ')') {
            parenBalance += 1;
        } else if (letter === '(') {
            parenBalance -= 1;
        }
        if (parenBalance === 0) {
            break;
        }
        idx += 1;
    }

    if (parenBalance > 0) {
        throw new Error(getMessage("SelectorLooksIncorrect", selectorString));
    }

    return selectorString.length - idx - 1;
}

function toComplexSelector(left: string, right: string, op: string): Selector {
    if (op === ',') {
        return new OrSelector(toSelector(left), toSelector(right));
    } else if (op === ':') {
        return new AndSelector(toSelector(left), toSelector(right));
    } else {
        throw new Error(getMessage("SelectorLooksIncorrect", `${left}${op}${right}`));
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
