import * as fetch from 'node-fetch';
import consoleStamp = require("console-stamp");
import * as fs from 'fs';
import * as scheduler from 'node-schedule';

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

export class SelfAssessments {

    private static _instance: SelfAssessments;

    private selfAssessments:Map<string, any> = new Map();

    private constructor() { }

    public static get Instance(): SelfAssessments
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        await this.loadSelfAssessmentsFromFS();

        scheduler.scheduleJob("loadSelfAssessmentsFromFS", "*/10 * * * *", () => this.loadSelfAssessmentsFromApi());
    }

    public getSelfAssessment(issuerCurrency): string {
        if(this.selfAssessments.has(issuerCurrency) && this.selfAssessments.get(issuerCurrency) != null) {
            //take it from cache
            return this.selfAssessments.get(issuerCurrency);
        } else {
            return null
        }
    }

    private async saveSelfAssessmentsToFS(): Promise<void> {
        if(this.selfAssessments && this.selfAssessments.size > 0) {
            let selfAssessmentsObject:any = {};
            this.selfAssessments.forEach((value, key, map) => {
                selfAssessmentsObject[key] = value;
            });
            fs.writeFileSync("./../selfAssessments_new.js", JSON.stringify(selfAssessmentsObject));
            fs.renameSync("./../selfAssessments_new.js", "./../selfAssessments.js");

            console.log("saved " + this.selfAssessments.size + " self assessments to file system");
        }
    }

    private async loadSelfAssessmentsFromFS(): Promise<void> {
        console.log("loading self assessments from FS");
        try {
            if(fs.existsSync("./../selfAssessments.js")) {
                let selfAssessmentsObject:any = JSON.parse(fs.readFileSync("./../selfAssessments.js").toString());
                //console.log(JSON.stringify(selfAssessmentsObject));
                if(selfAssessmentsObject) {
                    for (var issuerToken in selfAssessmentsObject) {
                        if (selfAssessmentsObject.hasOwnProperty(issuerToken)) {
                            this.selfAssessments.set(issuerToken, selfAssessmentsObject[issuerToken] != null ? selfAssessmentsObject[issuerToken] : "");
                        }
                    }

                    console.log("loaded " + this.selfAssessments.size + " self assessments from file system");
                }
            } else {
                console.log("self assessments file does not exist yet. Loading it...")
                await this.loadSelfAssessmentsFromApi();
            }
        } catch(err) {
            console.log("error reading self assessments from FS");
            console.log(err);
            this.selfAssessments.clear();
        }
    }

    private async loadSelfAssessmentsFromApi(): Promise<any> {
        try {
            //try to resolve it from xrplorer.com API
            let apiResponse:fetch.Response = await fetch.default("https://assessments.api.xrplf.org/api/v1/all");
            
            if(apiResponse && apiResponse.ok) {
                let selfAssessmentsArray:any[] = await apiResponse.json();

                selfAssessmentsArray.forEach(assessment => {
                    let key = assessment.issuer + "_" + assessment.currency_code;
                    this.selfAssessments.set(key, assessment);
                });

                this.saveSelfAssessmentsToFS();
                
            }
        } catch(err) {
            console.log(JSON.stringify(err));
            return null;
        }
    }
}