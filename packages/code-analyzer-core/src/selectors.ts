import { getMessage } from "./messages";

export interface Selector {
    matchesSelectables(selectables: string[]): boolean;
}

export function toSelector(selectorString: string): Selector {
    if (selectorString === '') {
        throw new Error(getMessage("SelectorCannotBeEmpty"));
    } else if (selectorString.endsWith(')')) {
        const correspondingOpenParen: number = identifyCorrespondingOpenParen(selectorString);
        if (correspondingOpenParen === 0) {
            return toSelector(selectorString.slice(1, -1))
        } else {
            const left: string = selectorString.slice(0, correspondingOpenParen - 1);
            const right: string = selectorString.slice(correspondingOpenParen);
            const op: string = selectorString[correspondingOpenParen - 1];
            return toComplexSelector(left, right, op);
        }
    } else {
        const lastComma: number = selectorString.lastIndexOf(',');
        const lastColon: number = selectorString.lastIndexOf(':');

        if (lastComma === -1 && lastColon === -1) {
            if (selectorString.includes(')') || selectorString.includes('(')) {
                throw new Error(getMessage('SelectorLooksIncorrect', selectorString));
            }
            return new SimpleSelector(selectorString);
        } else if (lastComma > lastColon) {
            const left: string = selectorString.slice(0, lastComma);
            const right: string = selectorString.slice(lastComma + 1);
            return toComplexSelector(left, right, ',');
        } else {
            const left: string = selectorString.slice(0, lastColon);
            const right: string = selectorString.slice(lastColon + 1);
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
