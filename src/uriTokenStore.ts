import * as fs from 'fs';
import { DATA_PATH } from './util/config';
import { URIToken } from './util/types';

export class UriTokenStore {

    private static _instance: UriTokenStore;

    private uriTokenIdMap:Map<string,URIToken> = new Map();

    private uriTokenIssuerMap:Map<string,Map<string,URIToken>> = new Map();

    private uriTokenOwnerMap:Map<string,Map<string,URIToken>> = new Map();

    private uriTokenUriMap:Map<string,Map<string,URIToken>> = new Map();

    private current_ledger_index: number;
    private current_ledger_date: string;
    private current_ledger_time_ms: number;
    private current_ledger_hash: string;

    private constructor() { }

    public static get Instance(): UriTokenStore
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public getUriToken(uriTokenId:string): URIToken {
      return this.uriTokenIdMap.get(uriTokenId);
    }

    public getAllIssuers(): string[] {
      return Array.from(this.uriTokenIssuerMap.keys()).sort((a,b) => a.localeCompare(b));
    }

    public findUriTokenByIssuer(issuerAddress: string): URIToken[] {
      if(this.uriTokenIssuerMap.has(issuerAddress))
        return Array.from(this.uriTokenIssuerMap.get(issuerAddress).values());
      else
        return [];
    }

    public findUriTokensByOwner(ownerAccount: string): URIToken[] {
      if(this.uriTokenOwnerMap.has(ownerAccount))
        return Array.from(this.uriTokenOwnerMap.get(ownerAccount).values()).sort((a,b) => a.Issuer.localeCompare(b.Issuer));
      else
        return [];
    }

    public findUriTokenById(uriTokenId:string): URIToken {
      if(this.uriTokenIdMap.has(uriTokenId))
        return this.uriTokenIdMap.get(uriTokenId);
      else
        return null;
    }

    public findUriTokensByUri(uri:string): URIToken[] {
      if(this.uriTokenUriMap.has(uri))
        return Array.from(this.uriTokenUriMap.get(uri).values());
      else
        return [];
    }

    public async addUriToken(newUriToken: URIToken) {

      //add null URI if URI is not available:
      if(!newUriToken.URI)
        newUriToken.URI = null;

      this.uriTokenIdMap.set(newUriToken.URITokenID, newUriToken);

      if(!this.uriTokenIssuerMap.has(newUriToken.Issuer))
        this.uriTokenIssuerMap.set(newUriToken.Issuer, new Map());

      this.uriTokenIssuerMap.get(newUriToken.Issuer).set(newUriToken.URITokenID, newUriToken);

      if(!this.uriTokenOwnerMap.has(newUriToken.Owner))
        this.uriTokenOwnerMap.set(newUriToken.Owner, new Map());

      this.uriTokenOwnerMap.get(newUriToken.Owner).set(newUriToken.URITokenID, newUriToken);

      if(newUriToken.URI) {
        if(!this.uriTokenUriMap.has(newUriToken.URI))
          this.uriTokenUriMap.set(newUriToken.URI, new Map());

        this.uriTokenUriMap.get(newUriToken.URI).set(newUriToken.URITokenID, newUriToken);
      }
    }

    public removeNft(burnedUriToken:URIToken) {
      //console.log("burning NFT: " + burnedNft);

      //console.log("uriTokenIdMap size BEFORE: " + this.uriTokenIdMap.size);
      //console.log("uriTokenIssuerMap size BEFORE: " + this.uriTokenIssuerMap.get(burnedNft.Issuer).size);

      this.uriTokenIdMap.delete(burnedUriToken.URITokenID);

      this.uriTokenIssuerMap.get(burnedUriToken.Issuer).delete(burnedUriToken.URITokenID);

      this.uriTokenOwnerMap.get(burnedUriToken.Owner).delete(burnedUriToken.URITokenID);

      if(burnedUriToken.URI) {
        this.uriTokenUriMap.get(burnedUriToken.URI).delete(burnedUriToken.URITokenID);
      }

      //console.log("uriTokenIdMap size AFTER: " + this.uriTokenIdMap.size);
      //console.log("uriTokenIssuerMap size AFTER: " + this.uriTokenIssuerMap.get(burnedNft.Issuer).size);
    }

    public changeProperties(existingUriToken:URIToken, oldOwner: string) {
      if(this.uriTokenOwnerMap.has(oldOwner)) {
        this.uriTokenOwnerMap.get(oldOwner).delete(existingUriToken.URITokenID);
      }

      if(!this.uriTokenOwnerMap.has(existingUriToken.Owner))
        this.uriTokenOwnerMap.set(existingUriToken.Owner, new Map());

      this.uriTokenOwnerMap.get(existingUriToken.Owner).set(existingUriToken.URITokenID, existingUriToken);

      this.uriTokenIdMap.set(existingUriToken.URITokenID, existingUriToken);

      this.uriTokenIssuerMap.get(existingUriToken.Issuer).set(existingUriToken.URITokenID, existingUriToken);

      if(existingUriToken.URI) {
        if(!this.uriTokenUriMap.has(existingUriToken.URI)) {
          this.uriTokenUriMap.set(existingUriToken.URI, new Map());
        }

        this.uriTokenUriMap.get(existingUriToken.URI).set(existingUriToken.URITokenID, existingUriToken);
      }
    }

    public loadUriTokenDataFromFS() {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync(DATA_PATH+"uri_tokens/")) {

          this.uriTokenIdMap = new Map();
          this.uriTokenIssuerMap = new Map();
          this.uriTokenOwnerMap = new Map();
          this.uriTokenUriMap = new Map();

          let fileList = fs.readdirSync(DATA_PATH+"uri_tokens/");

          for(const fileName of fileList) {
            if(fileName.startsWith("uriTokenData") && fs.existsSync(DATA_PATH+"uri_tokens/"+fileName)) {
              let uriTokenData:any = JSON.parse(fs.readFileSync(DATA_PATH+"uri_tokens/"+fileName).toString());

              this.setCurrentLedgerIndex(uriTokenData.ledger_index);
              this.setCurrentLedgerHash(uriTokenData.ledger_hash);
              this.setCurrentLedgerCloseTime(uriTokenData.ledger_close);
              this.setCurrentLedgerCloseTimeMs(uriTokenData.ledger_close_ms);

              let uriTokenArray:URIToken[] = uriTokenData.uriTokens;

              for(let j = 0; j < uriTokenArray.length; j++) {
                this.addUriToken(uriTokenArray[j]);
              }
            }
          }


          console.log("URITokens loaded!");
          console.log("uriTokenIdMap: " + this.uriTokenIdMap.size);
          console.log("uriTokenIssuerMap: " + this.uriTokenIssuerMap.size);
          console.log("uriTokenOwnerMap: " + this.uriTokenOwnerMap.size);
          console.log("uriTokenUriMap: " + this.uriTokenUriMap.size);

        } else {
          console.log("URI Tokens data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading uri token data from FS");
        console.log(err);
        this.uriTokenIdMap = new Map();
        this.uriTokenIssuerMap = new Map();
        this.uriTokenOwnerMap = new Map();
        this.uriTokenUriMap =new Map();{};
      }
    }

    public readCurrentLedgerFromFS() {
      try {
        if(fs.existsSync(DATA_PATH+"uri_tokens/uriTokenData_1.js")) {
            let uriTokenData:any = JSON.parse(fs.readFileSync(DATA_PATH+"uri_tokens/uriTokenData_1.js").toString());
            if(uriTokenData && uriTokenData.ledger_index) {
                return uriTokenData.ledger_index;
            } else {
              return -1;
            }
        } else {
          console.log("uri token data file does not exist yet.")
          return -1;
        }
      } catch(err) {
        console.log("error reading uri token data from FS");
        console.log(err);
        return -1;
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