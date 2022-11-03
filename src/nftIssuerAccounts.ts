import * as fs from 'fs';
import * as scheduler from 'node-schedule';


export class NftIssuerAccounts {

    private static _instance: NftIssuerAccounts;

    private nftIssuerData: any;

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

    public getNftIssuerData() {
        return this.nftIssuerData;
    }

    public setNftIssuerData(data: any) {
      this.nftIssuerData = data;
    }

    private async loadNftIssuerDataFromFS(): Promise<void> {
      try {
        console.log("loading nft issuer data from FS");
        if(fs.existsSync("./../nftData.js")) {
            let nftIssuerData:any = JSON.parse(fs.readFileSync("./../nftData.js").toString());
            if(nftIssuerData) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                this.setNftIssuerData(nftIssuerData);
            }
        } else {
          console.log("nft issuer data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading nft issuer data from FS");
        console.log(err);
        this.setNftIssuerData({});
      }  
    }
}