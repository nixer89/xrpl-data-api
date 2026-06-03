import * as fs from 'fs';
import { createInterface } from 'readline';
import { once } from 'events';
import * as scheduler from 'node-schedule';
import { DATA_PATH } from './util/config';

require("log-timestamp");

export class TokenCreation {

    private static _instance: TokenCreation;

    private tokenCreation:Map<string, any> = new Map();

    private constructor() { }

    public static get Instance(): TokenCreation
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        await this.loadIssuerCreationFromFS();

        scheduler.scheduleJob("loadIssuerCreationFromFS", "*/10 * * * *", () => this.loadIssuerCreationFromFS());
    }

    private async loadIssuerCreationFromFS(): Promise<void> {
        //console.log("loading issuer creation from FS");
        try {
            if(fs.existsSync(DATA_PATH+"issuerCreation.txt")) {
                try {
                    const rl = createInterface({
                      input: fs.createReadStream(DATA_PATH+"issuerCreation.txt"),
                      crlfDelay: Infinity
                    });
                
                    rl.on('line', (line) => {
                      try {
                        const eqIdx = line.indexOf('=');
                        if (eqIdx === -1) return;
                        const key = line.substring(0, eqIdx);
                        const value = JSON.parse(line.substring(eqIdx + 1));
                        this.tokenCreation.set(key, value);
                      } catch(lineErr) {
                        console.error('Skipping malformed line in issuerCreation.txt:', line);
                      }
                    });
                
                    await once(rl, 'close');
                
                    //console.log('File processed.');
                    //console.log("loaded token creation from file system");

                } catch (err) {
                    console.error(err);
                    console.log("error reading token creation from FS");
                }
            } else {
                console.log("token creation file does not exist yet.")
            }
        } catch(err) {
            console.log("error reading token creation from FS");
            console.log(err);
            this.tokenCreation.clear();
        }
    }

    getTokenCreationDateFromCacheOnly(issuerCurrency): string {
        if(this.tokenCreation.has(issuerCurrency) && this.tokenCreation.get(issuerCurrency) != null) {
            //take it from cache
            return this.tokenCreation.get(issuerCurrency);
        } else {
            return null
        }
    }

    async getTokenCreationDate(issuer: string, currency: string): Promise<any> {
        let issuerKey = issuer+"_"+currency;

        if(this.isTokenInCache(issuerKey)) {
            //take it from cache
            return this.tokenCreation.get(issuerKey);
        } else {
            return { date: "Unknown"}
        }
    }

    isTokenInCache(issuerTokenKey:string) {
        return this.tokenCreation && this.tokenCreation.has(issuerTokenKey) && this.tokenCreation.get(issuerTokenKey) != null;
    }
}