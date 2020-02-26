import { Handler, Jovo } from "jovo-core";

import { google, calendar_v3 } from "googleapis";
import * as moment from "moment-timezone";
import * as path from "path";

import { Authorization } from "./google-calendar/authorization";
import { getTimezone, getEvents } from "./google-calendar/calendar";
import { SlotHelper, ISlot } from "./google-calendar/slot";
import { InputHelper } from "./input"; 
import { ComponentResponse } from "jovo-framework";

interface CalendarDate {
    date: string;
    dayOfWeek: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | string;
    freeSlots: ISlot[];
}

interface MeetingInterval {
    busySlots: ISlot[];
    end: string;
    eventId: string;
    start: string;
}

const calendarHandler: Handler = {
    START() {
        this.$session.$data[this.getActiveComponent()!.name] = {};

        this.$speech.t('component-ScheduleMeeting.start-question');

        return this.ask(this.$speech);
    },

    async DatesIntent() {
        /**
         * If it's the second time the intent is called, we should only go through the computation of the free slots, if the user's input is new.
         * One scenario might be where the user suggests "Monday and Tuesday" at the beginning and we give the details about Monday, but we've computed everything for both.
         * If the user asks for the details about Tuesday we skip the computation and simply use the existing data. 
         * 
         * If the second input contains multiple dates of which we have computed one already, we can also skip the computation and use provide the details for the suggested one. 
         * At that point the user might ask for the details about the ones, which we didn't compute yet, at which point we would start the computation again.
         */
        if (this.$session.$data[this.getActiveComponent()!.name].dates) {
            const dates = this.$session.$data[this.getActiveComponent()!.name].dates;
            const inputs = Object.values(this.$inputs);
            dates.forEach((date: CalendarDate) => {
                inputs.forEach((input) => {
                    const dateFromInput = InputHelper.getDateFromInput(input.value);
                    if (date.date === dateFromInput) {
                        this.$session.$data[this.getActiveComponent()!.name].currentDateIndex = dates.indexOf(date);


                        // TODO: redundancy with suggestion part in the bottom
                        const slotSuggestions = SlotHelper.selectSlotSuggestions(date.freeSlots, 3);
                        const localeLanguage = this.$request!.getLocale().split('-')[0]; // 'en-US' -> 'en'
                
                        const timesArray: string[] = [];
                        slotSuggestions.forEach((slot) => {
                            const time = SlotHelper.getTimeFromTimestamp(slot.start, localeLanguage);
                            timesArray.push(time);
                        });
            
                
                        this.$speech.t('component-ScheduleMeeting.date', {
                            day: date.dayOfWeek,
                            numberOfSlots: date.freeSlots.length,
                            slotOne: timesArray[0],
                            slotTwo: timesArray[1],
                            slotThree: timesArray[2]
                        });

                        return this.ask(this.$speech);
                    }

                    return undefined;
                });
            });
        }
        const pathToCredentials = path.join(process.cwd(), this.getActiveComponent()!.config.credentialsPath);
        const credentials = require(pathToCredentials);
        const auth = await Authorization.authorize(credentials);
        const calendar = google.calendar({ version: 'v3', auth });
        const timezone = await getTimezone(calendar, this.getActiveComponent()!.config.calendarId);

        const dates: CalendarDate[] = [];

        const inputs = Object.values(this.$inputs);
        for (const input of inputs) {
            const dateFromInput = InputHelper.getDateFromInput(input.value);

            if (!dateFromInput) {
                continue;
            }

            const minTimeMoment: moment.Moment = moment(dateFromInput); // parsed string: "2019-06-21" -> resulting moment: "2019-06-21T00:00:00"
            const maxTimeMoment: moment.Moment = moment(dateFromInput).add('1', 'day');


            const events = await getEvents(calendar, {
                calendarId: this.getActiveComponent()!.config.calendarId,
                timeMax: maxTimeMoment.toISOString(),
                timeMin: minTimeMoment.toISOString(),
                timeZone: timezone
            });

            if (!events) {
                continue;
            }

            // TODO: FreeSlots need timezone
            const meetingIntervals: MeetingInterval[] = SlotHelper.computeMeetingIntervals(events, this.getActiveComponent()!.config.intervalTitles);

            meetingIntervals.forEach((meetingInterval) => {
                meetingInterval.busySlots = SlotHelper.computeBusySlots(meetingInterval, meetingIntervals, events, timezone!);
            });


            const freeSlots = SlotHelper.computeFreeSlots(meetingIntervals, this.getActiveComponent()!.config.eventLengthInMin);

            const dateObject: CalendarDate = {
                freeSlots,
                date: dateFromInput,
                dayOfWeek: moment(dateFromInput).format('dddd')
            };

            dates.push(dateObject);
        }

        // No valid dates were provided
        if (dates.length === 0) {
            this.$speech.t('component-ScheduleMeeting.invalid-date');

            return this.ask(this.$speech);
        }
        
        this.$session.$data[this.getActiveComponent()!.name].dates = dates;

        // Loop through user's inputs and look for a date with available slots
        const oneDateIsAvailable = dates.some((date) => {
            if (date.freeSlots.length > 0) {
                this.$session.$data[this.getActiveComponent()!.name].currentDateIndex = dates.indexOf(date);

                return true;
            }

            return false;
        });

        if (!oneDateIsAvailable) {
            this.$speech.t('component-ScheduleMeeting.dates-unavailable');

            return this.ask(this.$speech);
        }

        const date = dates[this.$session.$data[this.getActiveComponent()!.name].currentDateIndex];

        const slotSuggestions = SlotHelper.selectSlotSuggestions(date.freeSlots, 3);
        const localeLanguage = this.$request!.getLocale().split('-')[0]; // 'en-US' -> 'en'

        const timesArray: string[] = [];
        slotSuggestions.forEach((slot) => {
            const time = SlotHelper.getTimeFromTimestamp(slot.start, localeLanguage);
            timesArray.push(time);
        });


        this.$speech.t('component-ScheduleMeeting.date', {
            day: date.dayOfWeek,
            numberOfSlots: date.freeSlots.length,
            slotOne: timesArray[0],
            slotTwo: timesArray[1],
            slotThree: timesArray[2],
            timezone: moment().tz("America/Los_Angeles").format('z')
        });
        
        return this.ask(this.$speech);
    },

    async SlotIntent() {
        /**
         * While system suggests freeSlots the user says what about 9am and gets routed here. Should simply check if that's available and proceed accordingly
         */
        const timeFromInput = InputHelper.getTimeFromInput(this.$inputs.slot.value);

        if (!timeFromInput) {
            return this.ask('Please provide a valid time, e.g. 08:30 am');
        }

        const date: CalendarDate = this.$session.$data[this.getActiveComponent()!.name].dates[this.$session.$data[this.getActiveComponent()!.name].currentDateIndex];
        const freeSlots = date.freeSlots;

        const slot = SlotHelper.getSlot(freeSlots, timeFromInput);


        if (slot) {
            this.$session.$data[this.getActiveComponent()!.name].slot = slot;

            this.$speech.t('component-ScheduleMeeting.slot-confirmation', {
                dayOfWeek: date.dayOfWeek,
                date: date.date,
                time: timeFromInput
            });
            return this.ask(this.$speech);
        }
        else {
            this.$speech.t('component-ScheduleMeeting.slot-unavailable');
            return this.ask(this.$speech);
        }
    },

    ON_ERROR() {
        const error = this.$handleRequest!.error;
        
        return sendComponentResponse(this, 'ERROR', undefined, error);
    },

    END() {
        return sendComponentResponse(this, 'REJECTED');
    },

    Unhandled() {
        return this.toIntent('HelpIntent');
    },

    HelpIntent() {
        this.$speech.t('component-ScheduleMeeting.help');

        return this.ask(this.$speech);
    },

    async YesIntent() {
        return this.toIntent('EventCreationIntent');
    },

    async EventCreationIntent() {
        const pathToCredentials = path.join(process.cwd(), this.getActiveComponent()!.config.credentialsPath);
        const credentials = require(pathToCredentials);
        const auth = await Authorization.authorize(credentials);
        const calendar = google.calendar({ version: 'v3', auth });
        const timezone = await getTimezone(calendar, this.getActiveComponent()!.config.calendarId);

        const slot: ISlot = this.$session.$data[this.getActiveComponent()!.name].slot;
        const email = this.getActiveComponent()!.data!.email;
        // general: color, reminder, visibility
        const generalEventSettings = this.getActiveComponent()!.config.eventOptions;
        // user specific: event start & end, timezone, email, etc.
        const userSpecificEventSettings: calendar_v3.Schema$Event = {
            attendees: [
                {
                    email
                }
            ],
            end: {
                dateTime: slot.end,
                timeZone: timezone
            },
            start: {
                dateTime: slot.start,
                timeZone: timezone
            }
        }

        const requestBody = {...generalEventSettings, ...userSpecificEventSettings};

        await calendar.events.insert({
            calendarId: this.getActiveComponent()!.config.calendarId,
            requestBody
        });

        return sendComponentResponse(this, 'SUCCESSFUL');
    },

    NoIntent() {
        this.$speech.t('component-ScheduleMeeting.slot-confirmation-denied');

        this.ask(this.$speech);
    }
};

/**
 * Prepares `$response` object and routes to the `onCompletedIntent`
 * @param {Jovo} jovo
 * @param {string} status Either "SUCCESSFUL" | "ERROR" | "REJECTED"
 * @param {{}} data data object that should be parsed in the response
 */
function sendComponentResponse(jovo: Jovo, status: "SUCCESSFUL" | "ERROR" | "REJECTED", data?: object, error?: Error): Promise<void> {
    const response: ComponentResponse = {
        status
    };

    if (data) {
        response.data = data;
    } else if (error) {
        response.error = error;
    }

    return jovo.sendComponentResponse(response);
}

export {calendarHandler as CalendarHandler, MeetingInterval};