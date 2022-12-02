import * as fs from 'fs';
import * as scheduler from 'node-schedule';

export class LedgerData {

    private static _instance: LedgerData;

    private ledgerData: any;

    private constructor() { }

    public static get Instance(): LedgerData
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        await this.loadLedgerDataFromFS();

        scheduler.scheduleJob("loadLedgerDataFromFS", "*/10 * * * *", () => this.loadLedgerDataFromFS());
    }

    public getLedgerData() {
        return this.ledgerData;
    }

    public getLedgerDataV1(): any[] {
      let dataToUse = JSON.parse(JSON.stringify(this.ledgerData))
      let totalBytes:number = 0;
      for (let data in dataToUse) {
        if (dataToUse.hasOwnProperty(data)) {
            totalBytes += dataToUse[data].size;
        }
      }

      for (let data in dataToUse) {
        if (dataToUse.hasOwnProperty(data)) {
            dataToUse[data].percentage = Math.round(dataToUse[data].size * 100 / totalBytes*1000000)/1000000
        }
      }

      return [totalBytes, dataToUse];
    }

    private setLedgerData(ledgerData: any): void{
        this.ledgerData = ledgerData;
      }

    private async loadLedgerDataFromFS(): Promise<void> {
      try {
        //console.log("loading ledger data from FS");
        if(fs.existsSync("./../ledgerData.js")) {
            let ledgerData:any = JSON.parse(fs.readFileSync("./../ledgerData.js").toString());
            if(ledgerData) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                this.setLedgerData(ledgerData);
            }
        } else {
          console.log("ledger data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading issuer data from FS");
        console.log(err);
        this.setLedgerData({});
      }  
    }
}