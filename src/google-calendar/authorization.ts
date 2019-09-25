import { google } from "googleapis";

import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { OAuth2Client } from "googleapis-common";

const TOKEN_PATH = './token.json';
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];


class Authorization {
    static async authorize(credentials: any): Promise<OAuth2Client> {
        return new Promise((resolve, reject) => {
            const { client_secret, client_id, redirect_uris } = credentials.installed;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
            // Check if we have previously stored a token.
            fs.readFile(path.join(__dirname, TOKEN_PATH), 'utf8', (err, token) => {
                if (err) return this.getAccessToken(oAuth2Client);
                oAuth2Client.setCredentials(JSON.parse(token));
                return resolve(oAuth2Client);
            });
        });
    }

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {OAuth2Client} oAuth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback for the authorized client.
     */
    static getAccessToken(oAuth2Client: OAuth2Client): Promise<OAuth2Client> | void {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        console.log('Authorize this component to access your Google Calendar by visiting this url:', authUrl);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    return Promise.reject(console.error('Error retrieving access token', err));
                }

                oAuth2Client.setCredentials(token!);
                // Store the token to disk for later program executions
                return fs.writeFile(path.join(__dirname, TOKEN_PATH), JSON.stringify(token), (err) => {
                    if (err) {
                        return Promise.reject(console.error(err));
                    }

                    console.log('Token stored to', TOKEN_PATH);
                    console.log('Component was set up successfully!');
                    return Promise.resolve(oAuth2Client);
                });
            });
        });
    }
}

export {Authorization};