import * as fs from 'fs';
import consoleStamp = require("console-stamp");
import { AccountNames } from './accountNames';
import { IssuerData, IssuerVerification } from "./util/types"
import { TokenCreation } from './tokenCreation';
import * as scheduler from 'node-schedule';

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

export class IssuerAccounts {

    private static _instance: IssuerAccounts;
    
    private accountInfo:AccountNames;
    private tokenCreation:TokenCreation;

    private issuers: Map<string, IssuerData> = new Map();

    private ledger_index: number;
    private ledger_date: string;
    private ledger_time_ms: number;
    private ledger_hash: string;

    private constructor() { }

    public static get Instance(): IssuerAccounts
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        this.accountInfo = AccountNames.Instance;
        this.tokenCreation = TokenCreation.Instance;

        await this.loadIssuerDataFromFS();

        scheduler.scheduleJob("loadIssuerDataFromFS", "*/10 * * * *", () => this.loadIssuerDataFromFS());
    }
    
    private transformIssuersV1(issuers: Map<string, IssuerData>): any {
      let transformedIssuers:any = {}
    
      issuers.forEach((data: IssuerData, key: string, map) => {
        let acc:string = key.substring(0, key.indexOf("_"));
        let currency:string = key.substring(key.indexOf("_")+1, key.length);
        let issuerData:IssuerVerification = this.accountInfo.getAccountData(acc);
        let creationDate:string = this.tokenCreation.getTokenCreationDateFromCacheOnly(key);

        //set kyc data
        if(!issuerData) {
          issuerData = {
            account: acc,
            verified: false,
            resolvedBy: null,
            kyc : this.accountInfo.getKycData(acc),
            created: creationDate
          }
        } else {
          issuerData.kyc = this.accountInfo.getKycData(acc);
          issuerData.created = creationDate
        }
    
        if(data.offers > 0 && data.amount <= 0) {
          //remove abandoned currencies with only offers
          //console.log(acc + ": " + currency + ": " + JSON.stringify(data));
        } else if(!transformedIssuers[acc]) {
          transformedIssuers[acc] = {
            data: issuerData,
            tokens: [{currency: currency, amount: data.amount, trustlines: data.trustlines, offers: data.offers}]
          }
        } else {
          transformedIssuers[acc].tokens.push({currency: currency, amount: data.amount, trustlines: data.trustlines, offers: data.offers});
        }
    
      });
    
      return transformedIssuers;
    }

  public getIssuer_1():Map<string, IssuerData> {
    return this.issuers;
  }


    public getLedgerTokensV1(): any {
        return this.transformIssuersV1(new Map(this.issuers));
    }

    private setIssuers(issuers: Map<string, IssuerData>): void{
        this.issuers = new Map(issuers);
    }

    private async loadIssuerDataFromFS(): Promise<void> {
      try {
        console.log("loading issuer data from FS");
        let loadedMap:Map<string, IssuerData> = new Map();
        if(fs.existsSync("./../issuerData.js")) {
            let issuerData:any = JSON.parse(fs.readFileSync("./../issuerData.js").toString());
            if(issuerData) {
                let issuers = issuerData.issuers;
                for (var account in issuers) {
                    if (issuers.hasOwnProperty(account)) {
                        if(!issuers[account].offers)
                          issuers[account].offers = 0;

                        loadedMap.set(account, issuers[account]);
                    }
                }

                console.log("loaded " + loadedMap.size + " issuer data from file system");

                this.setLedgerIndex(issuerData['ledger_index']);
                this.setLedgerCloseTime(issuerData['ledger_date']);
                this.setLedgerCloseTimeMs(issuerData['ledger_time_ms']);
                this.setLedgerHash(issuerData['ledger_hash']);
                this.setIssuers(loadedMap);
            }
        } else {
          console.log("issuer data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading issuer data from FS");
        console.log(err);
        this.setIssuers(new Map());
      }  
    }

  public getLedgerIndex(): number {
      return this.ledger_index;
  }

  public getLedgerIndexNew(): number {
    return this.ledger_index;
  }

  public setLedgerIndex(index:number): void {
    this.ledger_index = index;
  }

  public getLedgerHash(): string {
    return this.ledger_hash;
  }

  public getLedgerHashNew(): string {
    return this.ledger_hash;
  }

  public setLedgerHash(hash:string): void {
    this.ledger_hash = hash;
  }

  public getLedgerCloseTime(): string {
    return this.ledger_date;
  }

  public getLedgerCloseTimeNew(): string {
    return this.ledger_date;
  }

  public setLedgerCloseTime(closeTime: string): void {
    this.ledger_date = closeTime;
  }

  public getLedgerCloseTimeMs(): number {
    return this.ledger_time_ms;
  }

  public getLedgerCloseTimeMsNew(): number {
    return this.ledger_time_ms;
}

  public setLedgerCloseTimeMs(closeTimeInMs: number): void {
    this.ledger_time_ms = closeTimeInMs;
  }
}