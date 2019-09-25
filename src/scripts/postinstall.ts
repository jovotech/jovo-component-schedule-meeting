import * as readline from "readline";
import * as path from "path";

import { Authorization } from "../google-calendar/authorization";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('Please type in the path to your credentials file from the current working directory: ', (credentialsPath) => {
    rl.close();
    credentialsPath = path.join(process.cwd(), credentialsPath);
    const credentials = require(credentialsPath);
    Authorization.authorize(credentials).then((oauth2Client) => {
        console.log('Component was set up successfully');
    });
});

