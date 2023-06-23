import * as fs from 'fs';
import * as scheduler from 'node-schedule';
import { DATA_PATH } from './util/config';
import { SupplyInfoType } from './util/types';

export class SupplyInfo {

    private static _instance: SupplyInfo;

    private supplyInfo: SupplyInfoType;

    private constructor() { }

    public static get Instance(): SupplyInfo
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        await this.loadSupplyInfoFromFS();

        scheduler.scheduleJob("loadSupplyInfoFromFS", "*/10 * * * *", () => this.loadSupplyInfoFromFS());
    }

    public getSupplyInfo() {
        return this.supplyInfo;
    }

    private setSupplyInfo(supplyInfo: SupplyInfoType): void{
        this.supplyInfo = supplyInfo;
      }

    private async loadSupplyInfoFromFS(): Promise<void> {
      try {
        //console.log("loading ledger data from FS");
        if(fs.existsSync(DATA_PATH+"supplyInfo.js")) {
            let suppInfo:SupplyInfoType = JSON.parse(fs.readFileSync(DATA_PATH+"supplyInfo.js").toString());
            if(suppInfo) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                this.setSupplyInfo(suppInfo);
            }
        } else {
          console.log("supply info file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading supply info from FS");
        console.log(err);
      }  
    }
}