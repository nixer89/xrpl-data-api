import * as fs from 'fs';
import * as scheduler from 'node-schedule';
import { NFT } from './util/types';


export class NftIssuerAccounts {

    private static _instance: NftIssuerAccounts;

    private nftArray:NFT[] = [];
    private nftokenIdMap:Map<string, NFT> = new Map();
    private nftokenIssuerMap:Map<string, NFT[]> = new Map();

    private nftokenIssuerAllStructure = {
      "nfts": []
    }

    private constructor() { }

    public static get Instance(): NftIssuerAccounts
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        await this.loadNftIssuerDataFromFS();

        scheduler.scheduleJob("loadNftIssuerDataFromFS", "*/10 * * * *", () => this.loadNftIssuerDataFromFS());
    }

    public getAllNftsByIssuer(): any {
      return this.nftokenIssuerAllStructure;
    }

    public findNftsByIssuer(issuerAddress: string): NFT[] {
      if(this.nftokenIssuerMap.has(issuerAddress))
        return this.nftokenIssuerMap.get(issuerAddress);
      else
        return [];
    }

    public findNftokenById(nftokenId:string): NFT {
      if(this.nftokenIdMap.has(nftokenId))
        return this.nftokenIdMap.get(nftokenId);
      else
        return null;
    }

    private async loadNftIssuerDataFromFS(): Promise<void> {
      try {
        console.log("loading nft issuer data from FS");
        if(fs.existsSync("./../nftData.js")) {
            let nftData:any = JSON.parse(fs.readFileSync("./../nftData.js").toString());
            if(nftData) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                this.nftArray = nftData.nfts;

                console.log("nftArray: " + this.nftArray.length);

                let newNftokenIdMap:Map<string, NFT> = new Map();
                let newNftokenIssuerMap:Map<string, NFT[]> = new Map();

                for(let i = 0; i < this.nftArray.length; i++) {
                  newNftokenIdMap.set(this.nftArray[i].NFTokenID, this.nftArray[i]);

                  if(newNftokenIssuerMap.has(this.nftArray[i].Issuer)) {
                    newNftokenIssuerMap.get(this.nftArray[i].Issuer).push(this.nftArray[i]);
                  } else {
                    newNftokenIssuerMap.set(this.nftArray[i].Issuer, [this.nftArray[i]]);
                  }
                }

                let newAllStructure = {
                  "nfts": []
                }

                newNftokenIssuerMap.forEach((value, key, map) => {
                  newAllStructure["nfts"].push(value);
                });

                this.nftokenIssuerAllStructure = newAllStructure;
                this.nftokenIdMap = newNftokenIdMap;
                this.nftokenIssuerMap = newNftokenIssuerMap;

                console.log("finished loading nft data!");
                console.log("nftokenIdMap: " + this.nftokenIdMap.size);
                console.log("nftokenIssuerMap: " + this.nftokenIssuerMap.size);
                console.log("nftokenIssuerAllStructure:" + this.nftokenIssuerAllStructure.nfts.length);
            }
        } else {
          console.log("nft issuer data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading nft issuer data from FS");
        console.log(err);
        this.nftArray = [];
        this.nftokenIdMap = new Map();
        this.nftokenIssuerMap = new Map();
        this.nftokenIssuerAllStructure = {
          "nfts": []
        };
      }  
    }
}