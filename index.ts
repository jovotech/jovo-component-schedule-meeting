import { ComponentPlugin, PluginConfig, Handler } from "jovo-framework";
import { CalendarHandler } from "./src/handler";
import { CalendarConfig, Config } from "./src/config";

export class ScheduleMeeting extends ComponentPlugin {
    config: CalendarConfig = Config;
    pathToI18n = './src/i18n/';
    name = 'jovo-component-schedule-meeting';
    handler: Handler = {
        [this.name]: CalendarHandler
    };

    constructor(config?: PluginConfig) {
        super(config);
    }
}
