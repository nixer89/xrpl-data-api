import * as fs from 'fs';
import { NFT } from './util/types';

export class NftStore {

    private static _instance: NftStore;

    private nftokenIdMap:Map<string, NFT> = new Map();
    private nftokenIdMapTemp:Map<string, NFT> = new Map();

    private nftokenIssuerMap:Map<string, Map<string, NFT>> = new Map();
    private nftokenIssuerMapTemp:Map<string, Map<string, NFT>> = new Map();

    private nftokenOwnerMap:Map<string, Map<string, NFT>> = new Map();
    private nftokenOwnerMapTemp:Map<string, Map<string, NFT>> = new Map();

    private current_ledger_index: number;
    private current_ledger_index_temp: number;
    private current_ledger_date: string;
    private current_ledger_date_temp: string;
    private current_ledger_time_ms: number;
    private current_ledger_time_ms_temp: number;
    private current_ledger_hash: string;
    private current_ledger_hash_temp: string;

    private constructor() { }

    public static get Instance(): NftStore
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async addNFT(newNft:NFT): Promise<void> {
      this.nftokenIdMapTemp.set(newNft.NFTokenID, newNft);

      if(!this.nftokenIssuerMapTemp.has(newNft.Issuer))
        this.nftokenIssuerMapTemp.set(newNft.Issuer, new Map());

      this.nftokenIssuerMapTemp.get(newNft.Issuer).set(newNft.NFTokenID, newNft);

      if(!this.nftokenOwnerMapTemp.has(newNft.Owner))
        this.nftokenOwnerMapTemp.set(newNft.Owner, new Map());

      this.nftokenOwnerMapTemp.get(newNft.Owner).set(newNft.NFTokenID, newNft);
    }

    public removeNft(burnedNft:NFT) {
      //console.log("burning NFT: " + burnedNft);

      //console.log("nftokenIdMapTemp size BEFORE: " + this.nftokenIdMapTemp.size);
      //console.log("nftokenIssuerMapTemp size BEFORE: " + this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size);

      this.nftokenIdMapTemp.delete(burnedNft.NFTokenID);
      this.nftokenIssuerMapTemp.get(burnedNft.Issuer).delete(burnedNft.NFTokenID);
      this.nftokenOwnerMapTemp.get(burnedNft.Owner).delete(burnedNft.NFTokenID);

      //console.log("nftokenIdMapTemp size AFTER: " + this.nftokenIdMapTemp.size);
      //console.log("nftokenIssuerMapTemp size AFTER: " + this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size);
    }

    public changeOwner(existingNft:NFT, newOwner: string) {
      if(this.nftokenOwnerMapTemp.has(existingNft.Owner)) {
        this.nftokenOwnerMapTemp.get(existingNft.Owner).delete(existingNft.NFTokenID)
      }

      existingNft.Owner = newOwner;

      if(!this.nftokenOwnerMapTemp.has(existingNft.Owner))
        this.nftokenOwnerMapTemp.set(existingNft.Owner, new Map());

      this.nftokenOwnerMapTemp.get(existingNft.Owner).set(existingNft.NFTokenID, existingNft);

      this.nftokenIdMapTemp.set(existingNft.NFTokenID, existingNft);

      this.nftokenIssuerMapTemp.get(existingNft.Issuer).set(existingNft.NFTokenID, existingNft);

    }

    public getNft(nftokenId:string) {
      return this.nftokenIdMapTemp.get(nftokenId);
    }

    public getAllIssuers(): string[] {
      return Array.from(this.nftokenIssuerMap.keys());
    }

    public findNftsByIssuer(issuerAddress: string): NFT[] {
      if(this.nftokenIssuerMap.has(issuerAddress))
        return Array.from(this.nftokenIssuerMap.get(issuerAddress).values()).sort((a,b) => a.Taxon - b.Taxon || a.Sequence - b.Sequence);
      else
        return [];
    }

    public findNFtsByOwner(ownerAccount: string): NFT[] {
      return Array.from(this.nftokenOwnerMap.get(ownerAccount).values());
    }

    public findTaxonsByIssuer(issuerAddress: string): number[] {
      
      if(this.nftokenIssuerMap.has(issuerAddress)) {
        let taxons:number[] = [];
        let nfts:NFT[] = [...this.nftokenIssuerMap.get(issuerAddress).values()];

        for(let i = 0; i < nfts.length; i++) {
          if(!taxons.includes(nfts[i].Taxon)) {
            taxons.push(nfts[i].Taxon);
          }
        }

        return taxons.sort((a,b) => a - b);

      } else {
        return [];
      }
    }

    public findNftsByIssuerAndTaxon(issuerAddress: string, taxon: number): NFT[] {
      if(this.nftokenIssuerMap.has(issuerAddress))
        return [...this.nftokenIssuerMap.get(issuerAddress).values()].filter(nft => nft.Taxon == taxon).sort((a,b) => a.Sequence - b.Sequence);
      else
        return [];
    }

    public findNftokenById(nftokenId:string): NFT {
      if(this.nftokenIdMap.has(nftokenId))
        return this.nftokenIdMap.get(nftokenId);
      else
        return null;
    }

    public closeInternalStuff() {

      this.nftokenIdMap = new Map(this.nftokenIdMapTemp)
      this.nftokenIssuerMap = new Map(this.nftokenIssuerMapTemp);
      this.nftokenOwnerMap = new Map(this.nftokenOwnerMapTemp);

      this.current_ledger_date = this.current_ledger_date_temp;
      this.current_ledger_hash = this.current_ledger_hash_temp;
      this.current_ledger_index = this.current_ledger_index_temp;
      this.current_ledger_time_ms = this.current_ledger_time_ms_temp;
    }

    public async loadNftDataFromFS(): Promise<void> {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync("./../nftData.js")) {
            let nftData:any = JSON.parse(fs.readFileSync("./../nftData.js").toString());
            if(nftData && nftData.nfts) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                let nftArray:NFT[] = nftData.nfts;

                //console.log("nftArray: " + this.nftArray.length);

                this.nftokenIdMapTemp = new Map();
                this.nftokenIssuerMapTemp = new Map();
                this.nftokenOwnerMapTemp = new Map();

                this.setCurrentLedgerIndex(nftData.ledger_index);
                this.setCurrentLedgerHash(nftData.ledger_hash);
                this.setCurrentLedgerCloseTime(nftData.ledger_close);
                this.setCurrentLedgerCloseTimeMs(nftData.ledger_close_ms);

                for(let i = 0; i < nftArray.length; i++) {
                  this.nftokenIdMapTemp.set(nftArray[i].NFTokenID, nftArray[i]);

                  if(!this.nftokenIssuerMapTemp.has(nftArray[i].Issuer)) {
                    this.nftokenIssuerMapTemp.set(nftArray[i].Issuer, new Map());
                  }

                  this.nftokenIssuerMapTemp.get(nftArray[i].Issuer).set(nftArray[i].NFTokenID, nftArray[i]);

                  if(!this.nftokenOwnerMapTemp.has(nftArray[i].Owner)) {
                    this.nftokenOwnerMapTemp.set(nftArray[i].Owner, new Map());
                  }

                  this.nftokenOwnerMapTemp.get(nftArray[i].Owner).set(nftArray[i].NFTokenID, nftArray[i]);
                }

                this.closeInternalStuff();

                console.log("NFTs loaded!");
                console.log("nftokenIdMap: " + this.nftokenIdMap.size);
                console.log("nftokenIssuerMap: " + this.nftokenIssuerMap.size);
                console.log("nftokenOwnerMap: " + this.nftokenOwnerMap.size);

                //console.log("finished loading nft data!");
                //console.log("nftokenIdMap: " + this.nftokenIdMap.size);
                //console.log("nftokenIssuerMap: " + this.nftokenIssuerMap.size);
            }
        } else {
          console.log("nft issuer data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading nft issuer data from FS");
        console.log(err);
        this.nftokenIdMap = new Map();
        this.nftokenIdMapTemp = new Map();
        this.nftokenIssuerMap = new Map();
        this.nftokenIssuerMapTemp = new Map();
        this.nftokenOwnerMapTemp = new Map();
      }  
    }

    public async readCurrentLedgerFromFS(): Promise<number> {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync("./../nftData.js")) {
            let nftData:any = JSON.parse(fs.readFileSync("./../nftData.js").toString());
            if(nftData && nftData.ledger_index) {
                return nftData.ledger_index;
            } else {
              return -1;
            }
        } else {
          console.log("nft issuer data file does not exist yet.")
          return -1;
        }
      } catch(err) {
        console.log("error reading nft issuer data from FS");
        console.log(err);
        return -1;
      }  
    }

    public getCurrentLedgerIndex(): number {
        return this.current_ledger_index;
    }

    public setCurrentLedgerIndex(index:number): void {
        this.current_ledger_index_temp = index;
    }

    public getCurrentLedgerHash(): string {
        return this.current_ledger_hash;
    }

    public setCurrentLedgerHash(hash:string): void {
        this.current_ledger_hash_temp = hash;
    }

    public getCurrentLedgerCloseTime(): string {
        return this.current_ledger_date;
    }

    public setCurrentLedgerCloseTime(closeTime: string): void {
        this.current_ledger_date_temp = closeTime;
    }

    public getCurrentLedgerCloseTimeMs(): number {
        return this.current_ledger_time_ms;
    }

    public setCurrentLedgerCloseTimeMs(closeTimeInMs: number): void {
        this.current_ledger_time_ms_temp = closeTimeInMs;
    }
}