import * as fs from 'fs';
import { AccountNames } from './accountNames';
import { IssuerData, IssuerVerification } from "./util/types"
import { TokenCreation } from './tokenCreation';
import * as scheduler from 'node-schedule';
import { SelfAssessments } from './selfAssessments';
import { DATA_PATH } from './util/config';

require("log-timestamp");

export class IssuerAccounts {

    private static _instance: IssuerAccounts;
    
    private accountInfo:AccountNames;
    private tokenCreation:TokenCreation;
    private selfAssessments:SelfAssessments;

    private tokenIssuers: Map<string, IssuerData> = new Map();
    private nftIssuers: Map<string, IssuerData> = new Map();

    private ledger_index: number;
    private ledger_close_time: string;
    private ledger_close_time_ms: number;
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
        this.selfAssessments = SelfAssessments.Instance;

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
        let selfAssessment:any = this.selfAssessments.getSelfAssessment(key);

        if(acc === 'rhrFfvzZAytd8UHPH87UHMgHQ18nnLbpgN' || acc == 'rG9Fo4mgx5DEZp7zKUEchs3R3jSMbx3NhR') //remove gatehub issuer for SGB on their request and LCC fake issuer
          return;

        //set kyc data
        if(!issuerData) {
          issuerData = {
            account: acc,
            verified: false,
            resolvedBy: null,
            kyc : this.accountInfo.getKycData(acc),
          }
        } else {
          issuerData.kyc = this.accountInfo.getKycData(acc);
        }
    
        if(data.offers > 0 && data.amount <= 0) {
          //remove abandoned currencies with only offers
          //console.log(acc + ": " + currency + ": " + JSON.stringify(data));
        } else if(!transformedIssuers[acc]) {
          transformedIssuers[acc] = {
            data: issuerData,
            tokens: [{currency: currency, amount: data.amount, trustlines: data.trustlines, holders: data.holders, offers: data.offers, created: creationDate, self_assessment: selfAssessment}]
          }
        } else {
          transformedIssuers[acc].tokens.push({currency: currency, amount: data.amount, trustlines: data.trustlines, holders: data.holders, offers: data.offers, created: creationDate, self_assessment: selfAssessment});
        }
      });
    
      return transformedIssuers;
    }

    public getTokenIssuer():Map<string, IssuerData> {
      return this.tokenIssuers;
    }

    public getNftIssuer():Map<string, IssuerData> {
      return this.nftIssuers;
    }

    public getLedgerTokensV1(): any {
        return this.transformIssuersV1(new Map(this.getTokenIssuer()));
    }

    public getLedgerNftsV1(): any {
      return this.transformIssuersV1(new Map(this.getNftIssuer()));
    }

    private setTokenIssuers(issuers: Map<string, IssuerData>): void{
        this.tokenIssuers = new Map(issuers);
    }

    private setNftIssuers(issuers: Map<string, IssuerData>): void{
      this.nftIssuers = new Map(issuers);
  }

    private async loadIssuerDataFromFS(): Promise<void> {
      try {
        //console.log("loading issuer data from FS");
        let loadedMap:Map<string, IssuerData> = new Map();
        if(fs.existsSync(DATA_PATH+"issuerData.js")) {
            let issuerData:any = JSON.parse(fs.readFileSync(DATA_PATH+"issuerData.js").toString());
            if(issuerData) {
                let issuers = issuerData.issuers;
                for (var account in issuers) {
                    if (issuers.hasOwnProperty(account)) {
                        if(!issuers[account].offers)
                          issuers[account].offers = 0;

                        loadedMap.set(account, issuers[account]);
                    }
                }

                //console.log("loaded " + loadedMap.size + " issuer data from file system");

                this.setLedgerIndex(issuerData['ledger_index']);
                this.setLedgerCloseTime(issuerData['ledger_close']);
                this.setLedgerCloseTimeMs(issuerData['ledger_close_ms']);
                this.setLedgerHash(issuerData['ledger_hash']);

                let tokens:Map<string, IssuerData> = new Map();
                let nfts:Map<string, IssuerData> = new Map();

                loadedMap.forEach((data: IssuerData, key: string, map) => {

                  if(data.amount > 1000000000000000e-85) {
                    tokens.set(key, data);
                  } else if(data.amount <= 1000000000000000e-85 && data.amount >= 1000000000000000e-96) {
                    nfts.set(key, data);
                  }
                });

                this.setTokenIssuers(tokens);
                this.setNftIssuers(nfts);
            }
        } else {
          console.log("issuer data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading issuer data from FS");
        console.log(err);
        this.setTokenIssuers(new Map());
        this.setNftIssuers(new Map());
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