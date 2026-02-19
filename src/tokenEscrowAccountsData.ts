import * as fs from 'fs';
import { DATA_PATH } from './util/config';

export class TokenEscrowAccountsData {

    private static _instance: TokenEscrowAccountsData;

    private tokenEscrowEnabled:string[] = [];
    private current_ledger_index: number;
    private current_ledger_date: string;
    private current_ledger_time_ms: number;
    private current_ledger_hash: string;

    private constructor() { }

    public static get Instance(): TokenEscrowAccountsData
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public getTokenEscrowEnabledAccounts() {
      return this.tokenEscrowEnabled;
    }

    private setTokenEscrowEnabledAccounts(tokenEscrowEnabled: string[]): void {
      this.tokenEscrowEnabled = tokenEscrowEnabled;
    }

    public addTokenEscrowEnabledAccount(account:string): void {
      if(!this.tokenEscrowEnabled.includes(account)) {
        this.tokenEscrowEnabled.push(account);
      }
    }

    public async loadTokenEscrowAccountsFromFS(): Promise<void> {
      try {
        if(fs.existsSync(DATA_PATH+"token_escrow.js")) {
          let tokenEscrowFile:any = JSON.parse(fs.readFileSync(DATA_PATH+"token_escrow.js").toString());
          if(tokenEscrowFile && tokenEscrowFile.escrows) {
              //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
              this.setCurrentLedgerIndex(tokenEscrowFile['ledger_index']);
              this.setCurrentLedgerCloseTime(tokenEscrowFile['ledger_close']);
              this.setCurrentLedgerCloseTimeMs(tokenEscrowFile['ledger_close_ms']);
              this.setCurrentLedgerHash(tokenEscrowFile['ledger_hash']);
              this.setTokenEscrowEnabledAccounts(tokenEscrowFile['token_escrow_enabled']);

              console.log("Loaded " + this.getTokenEscrowEnabledAccounts().length + " token escrow enabled accounts from filesystem!");
          }
        } else {
          console.log("token escrow enabled accounts file does not exist yet.")
        }

      } catch(err) {
        console.log("error reading issuer data from FS");
        console.log(err);
        this.setTokenEscrowEnabledAccounts([]);
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