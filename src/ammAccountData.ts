import * as fs from 'fs';
import { DATA_PATH } from './util/config';
import { AMMPool } from './util/types';

export class AmmAccountData {

    private static _instance: AmmAccountData;

    private ammAccounts:AMMPool[] = [];
    private current_ledger_index: number;
    private current_ledger_date: string;
    private current_ledger_time_ms: number;
    private current_ledger_hash: string;

    private constructor() { }

    public static get Instance(): AmmAccountData
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public getAmmAccounts() {
      return this.ammAccounts;
    }

    private setAmmAccounts(ammAccounts: AMMPool[]): void {
      this.ammAccounts = ammAccounts;
    }

    public addAmmAccount(ammAccount:AMMPool): void {
      if(!this.ammAccounts.includes(ammAccount)) {
        this.ammAccounts.push(ammAccount);
      }
    }

    public async loadAmmAccountsFromFS(): Promise<void> {
      try {
        if(fs.existsSync(DATA_PATH+"amm_pools.js")) {
          let ammPoolFile:any = JSON.parse(fs.readFileSync(DATA_PATH+"amm_pools.js").toString());
          if(ammPoolFile && ammPoolFile.amm_pools) {
              //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
              this.setCurrentLedgerIndex(ammPoolFile['ledger_index']);
              this.setCurrentLedgerCloseTime(ammPoolFile['ledger_close']);
              this.setCurrentLedgerCloseTimeMs(ammPoolFile['ledger_close_ms']);
              this.setCurrentLedgerHash(ammPoolFile['ledger_hash']);
              this.setAmmAccounts(ammPoolFile['amm_pools']);

              console.log("loaded ammPools: " + this.getAmmAccounts().length);
          }
        } else {
          console.log("amm pools file does not exist yet.")
        }

      } catch(err) {
        console.log("error reading token escrow data from FS");
        console.log(err);
        this.setAmmAccounts([]);
      }  
    }

  public getCurrentLedgerIndex(): number {
        return this.current_ledger_index;
    }

    public setCurrentLedgerIndex(index:number): void {
        this.current_ledger_index = index;
    }

    public getCurrentLedgerHash(): string {
        return this.current_ledger_hash;
    }

    public setCurrentLedgerHash(hash:string): void {
        this.current_ledger_hash = hash;
    }

    public getCurrentLedgerCloseTime(): string {
        return this.current_ledger_date;
    }

    public setCurrentLedgerCloseTime(closeTime: string): void {
        this.current_ledger_date = closeTime;
    }

    public getCurrentLedgerCloseTimeMs(): number {
        return this.current_ledger_time_ms;
    }

    public setCurrentLedgerCloseTimeMs(closeTimeInMs: number): void {
        this.current_ledger_time_ms = closeTimeInMs;
    }
}