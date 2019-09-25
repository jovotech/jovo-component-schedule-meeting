import { calendar_v3 } from "googleapis";
import { ComponentConfig } from "jovo-framework";

interface CalendarConfig extends ComponentConfig {
    credentialsPath: string;
    calendarId: string;
    eventLengthInMin: number;
    intervalTitles: string[];
    eventOptions?: calendar_v3.Schema$Event;
}

const config: CalendarConfig = {
    credentialsPath: '',
    intentMap: {
        'AMAZON.StopIntent': 'END',
        'AMAZON.HelpIntent': 'HelpIntent',
        'AMAZON.YesIntent': 'YesIntent',
        'AMAZON.NoIntent': 'NoIntent'
    },
    calendarId: '',
    intervalTitles: ['test', 'test2'],
    eventLengthInMin: 15,
    eventOptions: {
        description: 'Description test'
    }
};

export {CalendarConfig, config as Config};