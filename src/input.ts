import * as moment from "moment-timezone";

export class InputHelper {
    /**
     * Returns the date if it exists, else returns `undefined`
     * @param {string} date 
     * @returns {string | undefined}
     */
    static getDateFromInput(input: string): string | undefined {
        // Input is valid date: e.g. 2019-07-12
        const validDateRegex = new RegExp(/\d{4}-\d{2}-\d{2}/);
        const validatedDate = validDateRegex.exec(input);

        if (validatedDate) {
            return validatedDate[0];
        }
        else {
            return undefined;
        }
    }

    /**
     * TODO: Returns true if `date` is the same as `now`, because `moment(date)` results in `${date}T00:00:00`,
     * which will always be before `now`
     * @param {string} date 
     * @returns {boolean}
     */
    static dateIsInPast(date: string): boolean {
        const dateAsMoment: moment.Moment = moment(date);
        const now: moment.Moment = moment();

        return dateAsMoment.isBefore(now);
    }

    /**
     * Returns the time if it exists, else returns `undefined`
     * @param {string} date e.g. "08:30"
     * @returns {string | undefined}
     */
    static getTimeFromInput(time: string): string | undefined {
        const validTimeRegex = new RegExp(/\d{2}:\d{2}/);
        const validatedTime = validTimeRegex.exec(time);

        if (validatedTime) {
            return validatedTime[0];
        }
        else {
            return undefined;
        }
    }
}