import { ComponentPlugin } from "jovo-framework";
import { CalendarHandler } from "./src/handler";
import { CalendarConfig, Config } from "./src/config";
import { PluginConfig, Handler } from "jovo-core";

export class ScheduleMeeting extends ComponentPlugin {
    handler: Handler = CalendarHandler;
    config: CalendarConfig = Config;
    pathToI18n = './src/i18n/';

    constructor(config?: PluginConfig) {
        super(config);
    }
}
