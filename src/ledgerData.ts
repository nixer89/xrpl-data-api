import * as fs from 'fs';
import * as scheduler from 'node-schedule';
import { DATA_PATH } from './util/config';

export class LedgerData {

    private static _instance: LedgerData;

    private ledgerData: any;
    private escrows:any[] = [];

    private ledger_index: number;
    private ledger_close_time: string;
    private ledger_close_time_ms: number;
    private ledger_hash: string;

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
              if(ledgerData.ledger_data) {
                this.setLedgerData(ledgerData.ledger_data);

                this.setLedgerIndex(ledgerData['ledger_index']);
                this.setLedgerCloseTime(ledgerData['ledger_close']);
                this.setLedgerCloseTimeMs(ledgerData['ledger_close_ms']);
                this.setLedgerHash(ledgerData['ledger_hash']);

              } else {
                this.setLedgerData(ledgerData);
              }
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

  public getLedgerIndex(): number {
    return this.ledger_index;
  }

  public setLedgerIndex(index:number): void {
    this.ledger_index = index;
  }

  public getLedgerHash(): string {
    return this.ledger_hash;
  }

  public setLedgerHash(hash:string): void {
    this.ledger_hash = hash;
  }

  public getLedgerCloseTime(): string {
    return this.ledger_close_time;
  }

  public setLedgerCloseTime(closeTime: string): void {
    this.ledger_close_time = closeTime;
  }

  public getLedgerCloseTimeMs(): number {
    return this.ledger_close_time_ms;
  }

  public setLedgerCloseTimeMs(closeTimeInMs: number): void {
    this.ledger_close_time_ms = closeTimeInMs;
  }
}