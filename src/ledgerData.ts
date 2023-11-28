import * as fs from 'fs';
import * as scheduler from 'node-schedule';
import { DATA_PATH } from './util/config';

export class LedgerData {

    private static _instance: LedgerData;

    private ledgerData: any;
    private escrows:any[] = [];

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

    public getEscrows() {
      return this.escrows;
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

    private setEscrows(escrows: []): void{
      this.escrows = escrows;
  }

    private async loadLedgerDataFromFS(): Promise<void> {
      try {
        //console.log("loading ledger data from FS");
        if(fs.existsSync(DATA_PATH+"ledgerData.js")) {
            let ledgerData:any = JSON.parse(fs.readFileSync(DATA_PATH+"ledgerData.js").toString());
            if(ledgerData) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                this.setLedgerData(ledgerData);
            }
        } else {
          console.log("ledger data file does not exist yet.")
        }

        if(fs.existsSync(DATA_PATH+"escrows.js")) {
          let escrowFile:any = JSON.parse(fs.readFileSync(DATA_PATH+"escrows.js").toString());
          if(escrowFile && escrowFile.escrows) {
              //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
              this.setEscrows(escrowFile.escrows);
          }
      } else {
        console.log("escrows file does not exist yet.")
      }

      } catch(err) {
        console.log("error reading issuer data from FS");
        console.log(err);
        this.setLedgerData({});
      }  
    }
}