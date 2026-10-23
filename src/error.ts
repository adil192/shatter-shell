export class Error {
    reason: string;

    cause: Error | null = null;

    constructor(reason: string) {
        this.reason = reason;
    }

    context(why: string) {
        const error = new Error(why);
        error.cause = this;
        return error;
    }

    * chain() {
        yield this;

        for (let cause = this.cause; cause != null; cause = cause.cause) {
            yield cause;
        }
    }

    format() {
        const causes = this.chain();

        let buffer = causes.next().value!.reason;

        for (const error of causes) {
            buffer += `\n    caused by: ` + error.reason;
        }

        return buffer + `\n`;
    }
}
