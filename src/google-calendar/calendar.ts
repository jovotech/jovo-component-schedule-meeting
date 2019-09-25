import { calendar_v3 } from "googleapis";

/**
 * Returns the timezone of the calendar specified with `calendarId`
 * @param {*} calendar 
 * @param {string} calendarId
 * @returns {string} 
 */
export async function getTimezone(calendar: calendar_v3.Calendar, calendarId: string): Promise<string | undefined> {
    const calendarData = await calendar.calendars.get({
        calendarId, 
    });
    
    return Promise.resolve(calendarData.data.timeZone);
}

/**
 * Returns the events for the time interval and calendar specified in `options`.
 * @param {calendar_v3.Calendar} calendar current active calendar object
 * @param {calendar_v3.Params$Resource$Events$List} options for the api request
 */
export async function getEvents(calendar: calendar_v3.Calendar, options: calendar_v3.Params$Resource$Events$List): Promise<calendar_v3.Schema$Event[] | undefined> {
    const eventList = await calendar.events.list(options);
    const events = eventList.data.items;

    return Promise.resolve(events);
}
