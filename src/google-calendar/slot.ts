import * as moment from "moment-timezone";

import { calendar_v3 } from "googleapis";
import { MeetingInterval } from "../handler";

interface ISlot {
    start: string;
    end: string;
}

class SlotHelper {

    /**
     * Returns an array of x slots
     * @param {ISlot[]} freeSlots 
     * @param {number} numberOfSlots number of slots that the array should have
     * @returns {ISlot[]}
     */
    static selectSlotSuggestions(freeSlots: ISlot[], numberOfSlots: number): ISlot[] {
        if (freeSlots.length < numberOfSlots) {
            return freeSlots;
        }

        const arr: ISlot[] = [];
        while (arr.length < numberOfSlots) {
            const randomNumber: number = Math.floor(Math.random() * freeSlots.length);
            const slot: ISlot = freeSlots[randomNumber];

            if (arr.indexOf(slot) === -1) {
                arr.push(slot);
            }
        }
        return arr;
    }

    /**
     * Returns the desired slot defined in `time` is available
     * @param {ISlot[]} freeSlots 
     * @param {string} time The time of the slot the user wants. E.g. "08:30"
     * @returns {ISlot | undefined}
     */
    static getSlot(freeSlots: ISlot[], time: string): ISlot | undefined {
        for (let i = 0; i < freeSlots.length; i++) {
            const slotStart = moment(freeSlots[i].start);
            const slotStartTime = slotStart.format('HH:mm');
            

            if (slotStartTime === time) return freeSlots[i];
        }

        return undefined;
    }

    /**
     * Returns the time (08:00) from a timestamp (2018-04-06T12:00:00Z)
     * @param {string} timestamp 
     * @param {string} localeLanguage E.g. 'en'
     * @returns {string}
     */
    static getTimeFromTimestamp(timestamp: string, localeLanguage: string): string {
        const timestampAsMoment = moment(timestamp);
        
        if (localeLanguage === 'en') {
            return timestampAsMoment.format('h:mm A'); // e.g. "8:30 AM"
        }
        else {
            return timestampAsMoment.format('k:mm'); // e.g. "20:30"
        }
    }

    /**
     * Runs through the array of events and compares each events title to the strings inside `intervalTitles`,
     * to determine whether the event is placeholder to mark the interval for meetings.
     * Adds these events as `meetingInterval`s to an array and returns it. 
     * @param {calendar_v3.Schema$Event[]} events array of events from which we compute the meeting intervals
     * @param {string[]} intervalTitles the array of strings we use to identify the meeting invervals
     */
    static computeMeetingIntervals(events: calendar_v3.Schema$Event[], intervalTitles: string[]): MeetingInterval[] {
        const meetingIntervals: MeetingInterval[] = [];

        // determine the developer's selected intervals for available meeting slots
        events.forEach((event) => {
            if (intervalTitles.includes(event.summary!)) {
                const meetingInterval: MeetingInterval = {
                    busySlots: [],
                    eventId: event.id!,
                    start: event.start!.dateTime!,
                    end: event.end!.dateTime!
                };

                meetingIntervals.push(meetingInterval);
            }
        });

        return meetingIntervals;
    }

    /**
     * @todo Refactor
     * @param {MeetingInterval} meetingInterval The current meetingInterval for which we compute the busy slots
     * @param {MeetingInterval[]} meetingIntervals The array of all meetingInterval, so we can check that we don't add an event to the busy slots, which is actually an interval
     * @param {calendar_v3.Schema$Event[]} events Array of all the events for the current day in the calendar
     */
    static computeBusySlots(meetingInterval: MeetingInterval, meetingIntervals: MeetingInterval[], events: calendar_v3.Schema$Event[], timezone: string): ISlot[] {
        const busySlots: ISlot[] = [];

        events.forEach((event) => {

            const isIntervalEvent = meetingIntervals.some((meetingInterval) => {
                return meetingInterval.eventId === event.id;
            });

            if (isIntervalEvent) {
                return undefined;
            }

            const eventStartTime = event.start && event.start.dateTime;
            const eventEndTime = event.end && event.end.dateTime;

            if (!eventStartTime || !eventEndTime) {
                return undefined;
            }

            const eventStartMoment = moment(eventStartTime);
            const eventEndMoment = moment(eventEndTime);


            const intervalStartMoment = moment(meetingInterval.start);
            const intervalEndMoment = moment(meetingInterval.end);

            if (eventStartMoment.isSameOrAfter(intervalStartMoment) && eventEndMoment.isSameOrBefore(intervalEndMoment)) {
                busySlots.push({
                    start: eventStartTime!,
                    end: eventEndTime!
                });
            }

            return undefined;
        });

        return busySlots;
    }

    /**
     * Uses the `meetingIntervals` array to compute each meetingInterval's free slots
     * @param {MeetingInterval[]} meetingIntervals 
     * @param {number} eventLengthInMin length of each free slot
     */
    static computeFreeSlots(meetingIntervals: MeetingInterval[], eventLengthInMin: string): ISlot[] {
        const freeSlots: ISlot[] = [];
        meetingIntervals.forEach((meetingInterval) => {
            const busySlots = meetingInterval.busySlots;
            const intervalStartMoment = moment(meetingInterval.start);
            const intervalEndMoment = moment(meetingInterval.end);

            /**
             * No busySlots, so we can run through the whole interval and split it up into slots
             */
            if (busySlots.length === 0) {
                while (!intervalStartMoment.isSame(intervalEndMoment)) {
                    const slot = this.createSlot(intervalStartMoment.clone(), eventLengthInMin);
                    freeSlots.push(slot);

                    intervalStartMoment.add(eventLengthInMin, 'minutes');
                }

                return undefined;
            }

            // interval between actual interval's start and first busy slot
            const firstBusySlotStartMoment = moment(busySlots[0].start);
            while (!intervalStartMoment.isSame(firstBusySlotStartMoment)) {
                const slot = this.createSlot(intervalStartMoment.clone(), eventLengthInMin);
                freeSlots.push(slot);

                intervalStartMoment.add(eventLengthInMin, 'minutes');
            }

            // available slots in between busy slots
            for (let i = 0; i < busySlots.length - 1; i++) {
                const busySlotEndMoment = moment(busySlots[i].end);
                const nextBusySlotStartMoment = moment(busySlots[i + 1].start);

                while (!busySlotEndMoment.isSame(nextBusySlotStartMoment)) {
                    const slot = this.createSlot(busySlotEndMoment.clone(), eventLengthInMin);
                    freeSlots.push(slot);
                }
            }

            // interval between last busy slot and actual interval's end
            const lastBusySlotEndTime = moment(busySlots[busySlots.length - 1].end);
            while (!lastBusySlotEndTime.isSame(intervalEndMoment)) {
                const slot = this.createSlot(lastBusySlotEndTime.clone(), eventLengthInMin);
                freeSlots.push(slot);

                lastBusySlotEndTime.add(eventLengthInMin, 'minutes');
            }

            return undefined;
        });

        return freeSlots;
    }

    /**
     * Returns a slot by using the original moment's timestamp as start and start + eventLengthInMin as end,
     * !!! Modifies `startMoment` object by using moment.add() !!! 
     * @param {moment.Moment} startMoment 
     * @param {number} length length of the slot in minutes, e.g. 15
     */
    static createSlot(startMoment: moment.Moment, eventLengthInMin: string): ISlot {
        const slot = {
            start: startMoment.toISOString(),
            end: startMoment.add(eventLengthInMin, 'minutes').toISOString()
        };

        return slot;
    }
}

export {SlotHelper, ISlot};