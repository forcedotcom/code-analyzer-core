export abstract class Clock {
    abstract now(): Date;

    public formatToDateTimeString(): string {
        const dateTime: Date = this.now();
        const year: number = dateTime.getFullYear();
        const month: string = String(dateTime.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day: string = String(dateTime.getDate()).padStart(2, '0');
        const hours: string = String(dateTime.getHours()).padStart(2, '0');
        const minutes: string = String(dateTime.getMinutes()).padStart(2, '0');
        const seconds: string = String(dateTime.getSeconds()).padStart(2, '0');
        const milliseconds: string = String(dateTime.getMilliseconds()).padStart(3, '0');
        return `${year}_${month}_${day}_${hours}_${minutes}_${seconds}_${milliseconds}`;
    }
}

export class RealClock extends Clock {
    public now(): Date {
        return new Date();
    }
}

export class FixedClock extends Clock {
    private readonly fixedTimestamp: Date;

    public constructor(fixedTimestamp: Date) {
        super();
        this.fixedTimestamp = fixedTimestamp;
    }

    public now(): Date {
        return this.fixedTimestamp;
    }
}
