import * as fs from 'fs';
import { DATA_PATH } from './util/config';
import { AccountOffersrMapEntry, FloorPriceProperty, MarketPlaceStats, NFT, NftCollectionInfo, NFTokenOffer, NFTokenOfferMapEntry, NFTokenOfferReturnObject } from './util/types';
import { rippleTimeToUnixTime } from 'xrpl';

export class NftStore {

    private static _instance: NftStore;

    private nftokenIdMap:Map<string,NFT> = new Map();

    private nftokenIssuerMap:Map<string,Map<string,NFT>> = new Map();

    private nftokenOwnerMap:Map<string,Map<string,NFT>> = new Map();

    private offerIdMap:Map<string,NFTokenOffer> = new Map();

    private offerNftIdMap:Map<string, NFTokenOfferMapEntry> = new Map();

    private offerAccountMap:Map<string, AccountOffersrMapEntry> = new Map();;

    private current_ledger_index: number;
    private current_ledger_date: string;
    private current_ledger_time_ms: number;
    private current_ledger_hash: string;

    private brokerAccounts:string[] = [
      "rpZqTPC8GvrSvEfFsUuHkmPCg29GdQuXhC", //onXRP
      "rpx9JThQ2y37FaGeeJP7PXDUVEXY3PHZSC", //xrp.cafe
      "rXMART8usFd5kABXCayoP6ZfB35b4v43t", //xMart
      "rPLe3RVbfa3HiSj9cLqWvu3Huxk9qrckW4", //nftmaster
      "rpwubYKzGGECiTVHjCmNQbCgeUrHGnMngE", //nftmaster
      "rDeizxSRo6JHjKnih9ivpPkyD2EgXQvhSB", //XPmarket
      //"rsQmGXm3G4FA6n5L5QqTELBqTph9xEP5nK", // bot ???
      //"rBkFerpC65D7uuWAhFkuQFdLF6FVYaoBot", // bot ??
    ]

    private constructor() { }

    public static get Instance(): NftStore
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public getNft(nftokenId:string): NFT {
      return this.nftokenIdMap.get(nftokenId);
    }

    public getAllIssuers(): string[] {
      return Array.from(this.nftokenIssuerMap.keys()).sort((a,b) => a.localeCompare(b));
    }

    public findNftsByIssuer(issuerAddress: string): NFT[] {
      if(this.nftokenIssuerMap.has(issuerAddress)) {
        return Array.from(this.nftokenIssuerMap.get(issuerAddress).values()).sort((a,b) => a.Taxon - b.Taxon || a.Sequence - b.Sequence);
      } else {
        return [];
      }
    }

    public findNFTsByOwner(ownerAccount: string): NFT[] {
      if(this.nftokenOwnerMap.has(ownerAccount))
        return Array.from(this.nftokenOwnerMap.get(ownerAccount).values()).sort((a,b) => a.Issuer.localeCompare(b.Issuer) || a.Taxon - b.Taxon || a.Sequence - b.Sequence);
      else
        return [];
    }

    public findTaxonsByIssuer(issuerAddress: string): number[] {
      
      if(this.nftokenIssuerMap.has(issuerAddress)) {
        let taxons:number[] = [];
        let nfts:NFT[] = Array.from(this.nftokenIssuerMap.get(issuerAddress).values());

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
        return Array.from(this.nftokenIssuerMap.get(issuerAddress).values()).filter(nft => nft.Taxon == taxon).sort((a,b) => a.Sequence - b.Sequence);
      else
        return [];
    }

    public findNftokenById(nftokenId:string): NFT {
      if(this.nftokenIdMap.has(nftokenId))
        return this.nftokenIdMap.get(nftokenId);
      else
        return null;
    }

    public findNftokenByUri(uri:string): NFT[] {
      let filtered = Array.from(this.nftokenIdMap.values()).filter(nft => nft.URI === uri);

      return filtered;
    }

    public findOfferById(offerId: string): NFTokenOffer {
      if(this.offerIdMap.has(offerId))
        return this.offerIdMap.get(offerId);
      else
        return null;
    }

    public findOffersByNft(nftokenId: string, nftOwner: string, uri: string): NFTokenOfferReturnObject {
      if(this.offerNftIdMap.has(nftokenId)) {
        return {
          NFTokenID: nftokenId,
          NFTokenOwner: nftOwner,
          URI: uri,
          buy: Array.from(this.offerNftIdMap.get(nftokenId).buy.values()),
          sell: Array.from(this.offerNftIdMap.get(nftokenId).sell.values())
        }
      } else
        return {
          NFTokenID: nftokenId,
          NFTokenOwner: nftOwner,
          URI: uri,
          buy: [],
          sell: []
        };
    }

    public findOffersByIssuer(issuerAddress: string): NFTokenOfferReturnObject[] {
      //first get all NFT from an issuer
      let nftsFromIssuer = this.findNftsByIssuer(issuerAddress);

      return this.findAllOffersFromNfts(nftsFromIssuer);
    }

    public findOffersByIssuerAndTaxon(issuerAddress: string, taxon: number): NFTokenOfferReturnObject[] {
      //first get all NFT from an issuer
      let nftsFromIssuer = this.findNftsByIssuerAndTaxon(issuerAddress, taxon);

      return this.findAllOffersFromNfts(nftsFromIssuer);
    }

    public findOffersByNftOwner(nftOwnerAddress: string): NFTokenOfferReturnObject[] {
      //first get all NFT from an issuer
      let nftsOfOwner = this.findNFTsByOwner(nftOwnerAddress);

      return this.findAllOffersFromNfts(nftsOfOwner);
    }

    public findAllOffersFromNfts(nfts:NFT[]): NFTokenOfferReturnObject[] {
      if(nfts && nfts.length > 0) {
        let returnArray:NFTokenOfferReturnObject[] = [];
        for(let i = 0; i < nfts.length; i++) {
          let offerObject:NFTokenOfferReturnObject = this.findOffersByNft(nfts[i].NFTokenID, nfts[i].Owner, nfts[i].URI);
          if(offerObject && (offerObject.buy.length > 0 || offerObject.sell.length > 0)) {
            returnArray.push(offerObject);
          }
        }

        return returnArray.sort((a,b) => a.NFTokenID.localeCompare(b.NFTokenID));
      } else {
        return [];
      }
    }

    public findOffersByOfferOwner(ownerAddress: string): NFTokenOffer[] {
      //first get all NFT from an issuer
      //let offersFromOwner = Array.from(this.offerIdMap.values()).filter(offer => offer.Owner === ownerAddress);

      if(this.offerAccountMap.has(ownerAddress) && this.offerAccountMap.get(ownerAddress).as_owner.size > 0) {
        return Array.from(this.offerAccountMap.get(ownerAddress).as_owner.values()).sort((a,b) => a.NFTokenID.localeCompare(b.NFTokenID) || a.OfferID.localeCompare(b.OfferID));
      } else {
        return [];
      }
    }

    public findOffersByOfferDestination(destinationAddress: string): NFTokenOffer[] {
      //first get all NFT from an issuer
      //let offersWithDestination = Array.from(this.offerIdMap.values()).filter(offer => offer.Destination && offer.Destination === destinationAddress);

      if(this.offerAccountMap.has(destinationAddress) && this.offerAccountMap.get(destinationAddress).as_destination.size > 0)
        return Array.from(this.offerAccountMap.get(destinationAddress).as_destination.values()).sort((a,b) => a.NFTokenID.localeCompare(b.NFTokenID) || a.OfferID.localeCompare(b.OfferID));
      else
        return [];
    }

    public getCollectionInfo(issuer:string, taxon: number): NftCollectionInfo {
      let collectionNfts:NFT[] = [];
      let collectionOffers:NFTokenOfferReturnObject[] = [];
      
      if(taxon) {
        collectionNfts = this.findNftsByIssuerAndTaxon(issuer,taxon);
        collectionOffers = this.findAllOffersFromNfts(collectionNfts);
      } else {
        collectionNfts = this.findNftsByIssuer(issuer);
        collectionOffers = this.findAllOffersFromNfts(collectionNfts);
      }

      let holders:string[] = [];
      for(let i = 0; i < collectionNfts.length; i++) {
        if(!holders.includes(collectionNfts[i].Owner) && collectionNfts[i].Owner != issuer) {
          holders.push(collectionNfts[i].Owner)
        }
      }

      let sellOffers:string[] = [];
      let buyOffers:string[] = [];
      let nftForSale:string[] = [];
      let floorPrices:Map<string, FloorPriceProperty> = new Map();

      let sellOffersPerMp:Map<string, string[]> = new Map();
      let buyOffersPerMp:Map<string, string[]> = new Map();
      let nftForSalePerMp:Map<string, string[]> = new Map();
      let floorPricePerMp:Map<string, Map<string, FloorPriceProperty>> = new Map();

      for(let i = 0; i < collectionOffers.length; i++) {
        let sells = collectionOffers[i].sell;
        let buys = collectionOffers[i].buy;
        let nftOwner = collectionOffers[i].NFTokenOwner;

        for(let j = 0; j < buys.length; j++) {
          let singleBuyOffer = buys[j];

          //determine issuer, currency and sell price
          let issuer:string = null;
          let currency:string = null;
          let amount:number = null;

          if(typeof(singleBuyOffer.Amount) === 'string') {
            issuer = "XRP_in_drops"
            currency = "XRP";
            amount = Number(singleBuyOffer.Amount);
          } else {
            issuer = singleBuyOffer.Amount.issuer
            currency = singleBuyOffer.Amount.currency;
            amount = Number(singleBuyOffer.Amount.value);
          }

          if(amount > 0 && !this.isNftOfferExpired(singleBuyOffer.Expiration)) {

            if(!buyOffers.includes(singleBuyOffer.OfferID)) {
              buyOffers.push(singleBuyOffer.OfferID)
            }

            if(this.brokerAccounts.includes(singleBuyOffer.Destination)) {
              if(!buyOffersPerMp.has(singleBuyOffer.Destination)) {
                buyOffersPerMp.set(singleBuyOffer.Destination, []);
              }

              if(!buyOffersPerMp.get(singleBuyOffer.Destination).includes(singleBuyOffer.OfferID)) {
                buyOffersPerMp.get(singleBuyOffer.Destination).push(singleBuyOffer.OfferID)
              }
            }
          }
        }

        for(let k = 0; k < sells.length; k++) {
          let singleSellOffer = sells[k];

          //determine issuer, currency and sell price
          let issuer:string = null;
          let currency:string = null;
          let amount:number = null;

          if(typeof(singleSellOffer.Amount) === 'string') {
            issuer = "XRP_in_drops"
            currency = "XRP";
            amount = Number(singleSellOffer.Amount);
          } else {
            issuer = singleSellOffer.Amount.issuer
            currency = singleSellOffer.Amount.currency;
            amount = Number(singleSellOffer.Amount.value);
          }

          if(amount > 0 && !this.isNftOfferExpired(singleSellOffer.Expiration) && singleSellOffer.Owner === nftOwner) {

            if(!nftForSale.includes(collectionOffers[i].NFTokenID)) {
              nftForSale.push(collectionOffers[i].NFTokenID)
            }

            if(!sellOffers.includes(singleSellOffer.OfferID)) {
              sellOffers.push(singleSellOffer.OfferID)
            }

            if(!singleSellOffer.Destination || this.brokerAccounts.includes(singleSellOffer.Destination)) {
              let mpAccount = singleSellOffer.Destination ? singleSellOffer.Destination : 'XRPL_DEX';

              if(!nftForSalePerMp.has(mpAccount)) {
                nftForSalePerMp.set(mpAccount, []);
              }

              if(!nftForSalePerMp.get(mpAccount).includes(collectionOffers[i].NFTokenID)) {
                nftForSalePerMp.get(mpAccount).push(collectionOffers[i].NFTokenID)
              }

              if(!sellOffersPerMp.has(mpAccount)) {
                sellOffersPerMp.set(mpAccount, []);
              }

              if(!sellOffersPerMp.get(mpAccount).includes(singleSellOffer.OfferID)) {
                sellOffersPerMp.get(mpAccount).push(singleSellOffer.OfferID)
              }

              if(amount && currency && amount > 0) {
                if(!floorPrices.has(issuer+"_"+currency) || amount < floorPrices.get(issuer+"_"+currency).amount) {
                  floorPrices.set(issuer+"_"+currency, {issuer: issuer, currency: currency, amount: amount});
                }

                if(!floorPricePerMp.has(mpAccount)) {
                  floorPricePerMp.set(mpAccount, new Map());
                }
                
                if(!floorPricePerMp.get(mpAccount).has(issuer+"_"+currency) || amount < floorPricePerMp.get(mpAccount).get(issuer+"_"+currency).amount) {
                  floorPricePerMp.get(mpAccount).set(issuer+"_"+currency, {issuer: issuer, currency: currency, amount: amount});
                }
              }
            }
          }
        }
      }

      let returnInfo:NftCollectionInfo = {
        issuer: issuer,
        taxon: taxon,
        nfts: collectionNfts.length,
        unique_owners: holders.length,
        nfts_for_sale: nftForSale.length,
        buy_offers: buyOffers.length,
        sell_offers: sellOffers.length,
        floor: [],
        open_market: {
          nfts_for_sale: 0,
          sell_offers: 0,
          buy_offers: 0,
          floor: []
        },
        market_places: []
      }

      let floorValues = Array.from(floorPrices.values());

      for(let i = 0; i < floorValues.length; i++) {
        returnInfo.floor.push(floorValues[i]);
      }

      let xrpldex_info = {
        nfts_for_sale: 0,
        buy_offers: 0,
        sell_offers: 0,
        floor: []
      }

      xrpldex_info.nfts_for_sale = nftForSalePerMp.has("XRPL_DEX") ? nftForSalePerMp.get("XRPL_DEX").length : 0;
      xrpldex_info.sell_offers = sellOffersPerMp.has("XRPL_DEX") ? sellOffersPerMp.get("XRPL_DEX").length : 0;
      xrpldex_info.buy_offers = buyOffersPerMp.has("XRPL_DEX") ? buyOffersPerMp.get("XRPL_DEX").length : 0;

      if(floorPricePerMp.has("XRPL_DEX")) {
        let singleMpValues = Array.from(floorPricePerMp.get("XRPL_DEX").values());
        for(let j = 0; j < singleMpValues.length; j++) {
          xrpldex_info.floor.push(singleMpValues[j]);
        }
      }

      returnInfo.open_market = xrpldex_info;

      for(let i = 0; i < this.brokerAccounts.length; i++) {
        let brokerAccount = this.brokerAccounts[i];

        let mpDataInfo:MarketPlaceStats = {
          mp_account: brokerAccount,
          nfts_for_sale: 0,
          buy_offers: 0,
          sell_offers: 0,
          floor: []
        }

        mpDataInfo.nfts_for_sale = nftForSalePerMp.has(brokerAccount) ? nftForSalePerMp.get(brokerAccount).length : 0;
        mpDataInfo.sell_offers = sellOffersPerMp.has(brokerAccount) ? sellOffersPerMp.get(brokerAccount).length : 0;
        mpDataInfo.buy_offers = buyOffersPerMp.has(brokerAccount) ? buyOffersPerMp.get(brokerAccount).length : 0;
        

        if(floorPricePerMp.has(brokerAccount)) {
          let singleMpValues = Array.from(floorPricePerMp.get(brokerAccount).values());
          for(let j = 0; j < singleMpValues.length; j++) {
            mpDataInfo.floor.push(singleMpValues[j]);
          }
        }

        returnInfo.market_places.push(mpDataInfo);

      }

      return returnInfo;
    }

    public async addNFT(newNft:NFT) {

      //add null URI if URI is not available:
      if(!newNft.URI)
        newNft.URI = null;

      this.nftokenIdMap.set(newNft.NFTokenID, newNft);

      if(!this.nftokenIssuerMap.has(newNft.Issuer))
        this.nftokenIssuerMap.set(newNft.Issuer, new Map());

      this.nftokenIssuerMap.get(newNft.Issuer).set(newNft.NFTokenID, newNft);

      if(!this.nftokenOwnerMap.has(newNft.Owner))
        this.nftokenOwnerMap.set(newNft.Owner, new Map());

      this.nftokenOwnerMap.get(newNft.Owner).set(newNft.NFTokenID, newNft);

    }

    public removeNft(burnedNft:NFT) {
      //console.log("burning NFT: " + burnedNft);

      //console.log("nftokenIdMap size BEFORE: " + this.nftokenIdMap.size);
      //console.log("nftokenIssuerMap size BEFORE: " + this.nftokenIssuerMap.get(burnedNft.Issuer).size);

      if(burnedNft) {

        this.nftokenIdMap.delete(burnedNft.NFTokenID);

        this.nftokenIssuerMap.get(burnedNft.Issuer).delete(burnedNft.NFTokenID);

        this.nftokenOwnerMap.get(burnedNft.Owner).delete(burnedNft.NFTokenID);
      }

      //console.log("nftokenIdMap size AFTER: " + this.nftokenIdMap.size);
      //console.log("nftokenIssuerMap size AFTER: " + this.nftokenIssuerMap.get(burnedNft.Issuer).size);
    }

    public changeNftOwner(existingNft:NFT, newOwner: string) {
      if(this.nftokenOwnerMap.has(existingNft.Owner)) {
        this.nftokenOwnerMap.get(existingNft.Owner).delete(existingNft.NFTokenID);
      }

      existingNft.Owner = newOwner;

      if(!this.nftokenOwnerMap.has(existingNft.Owner))
        this.nftokenOwnerMap.set(existingNft.Owner, new Map());

      this.nftokenOwnerMap.get(existingNft.Owner).set(existingNft.NFTokenID, existingNft);

      this.nftokenIdMap.set(existingNft.NFTokenID,existingNft);

      this.nftokenIssuerMap.get(existingNft.Issuer).set(existingNft.NFTokenID, existingNft);

    }

    public async addNFTOffer(newOffer:NFTokenOffer) {

      this.offerIdMap.set(newOffer.OfferID,newOffer);

      if(!this.offerNftIdMap.has(newOffer.NFTokenID))
        this.offerNftIdMap.set(newOffer.NFTokenID, {buy: new Map(), sell: new Map()});

      //this is a sell offer!
      if(newOffer.Flags && newOffer.Flags == 1) {
        this.offerNftIdMap.get(newOffer.NFTokenID).sell.set(newOffer.OfferID, newOffer);
      } else { //this is a buy offer!
        this.offerNftIdMap.get(newOffer.NFTokenID).buy.set(newOffer.OfferID, newOffer);
      }

      if(!this.offerAccountMap.has(newOffer.Owner)) {
        this.offerAccountMap.set(newOffer.Owner, {as_destination: new Map(), as_owner: new Map()});
      }

      this.offerAccountMap.get(newOffer.Owner).as_owner.set(newOffer.OfferID,newOffer);

      if(newOffer.Destination) {
        if(!this.offerAccountMap.has(newOffer.Destination)) {
          this.offerAccountMap.set(newOffer.Destination,{as_destination: new Map(), as_owner: new Map()});
        }

        this.offerAccountMap.get(newOffer.Destination).as_destination.set(newOffer.OfferID, newOffer);
      }

    }

    public removeNftOffer(deletedOffer:NFTokenOffer) {

      this.offerIdMap.delete(deletedOffer.OfferID);

      if(deletedOffer.Flags && deletedOffer.Flags == 1) {
        this.offerNftIdMap.get(deletedOffer.NFTokenID).sell.delete(deletedOffer.OfferID);
      } else {
        this.offerNftIdMap.get(deletedOffer.NFTokenID).buy.delete(deletedOffer.OfferID);
      }

      if(this.offerAccountMap.has(deletedOffer.Owner)) {
        this.offerAccountMap.get(deletedOffer.Owner).as_owner.delete(deletedOffer.OfferID);
      }

      if(deletedOffer.Destination && this.offerAccountMap.has(deletedOffer.Destination)) {
        this.offerAccountMap.get(deletedOffer.Destination).as_destination.delete(deletedOffer.OfferID);
      }
    }

    public loadNftDataFromFS() {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync(DATA_PATH+"nfts/")) {

          this.nftokenIdMap = new Map();
          this.nftokenIssuerMap = new Map();
          this.nftokenOwnerMap = new Map();
          this.offerAccountMap = new Map();

          let fileList = fs.readdirSync(DATA_PATH+"nfts/");

          for(const fileName of fileList) {
            if(fileName.startsWith("nftData") && fs.existsSync(DATA_PATH+"nfts/"+fileName)) {
              let nftData:any = JSON.parse(fs.readFileSync(DATA_PATH+"nfts/"+fileName).toString());

              this.setCurrentLedgerIndex(nftData.ledger_index);
              this.setCurrentLedgerHash(nftData.ledger_hash);
              this.setCurrentLedgerCloseTime(nftData.ledger_close);
              this.setCurrentLedgerCloseTimeMs(nftData.ledger_close_ms);

              let nftArray:NFT[] = nftData.nfts;

              for(let j = 0; j < nftArray.length; j++) {
                this.addNFT(nftArray[j]);
              }
            }
          }

          for(const fileName of fileList) {
            if(fileName.startsWith("nftOffers") && fs.existsSync(DATA_PATH+"nfts/"+fileName)) {
              let nftOffers:any = JSON.parse(fs.readFileSync(DATA_PATH+"nfts/"+fileName).toString());
              if(nftOffers && nftOffers.offers) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                let offerArray:NFTokenOffer[] = nftOffers.offers;
  
                //console.log("nftArray: " + this.nftArray.length);
  
                this.offerIdMap = new Map();
                this.offerNftIdMap = new Map();
  
                for(let i = 0; i < offerArray.length; i++) {
                  this.addNFTOffer(offerArray[i]);
                }
              }
            }
          }

          console.log("NFTs loaded!");
          console.log("nftokenIdMap: " + this.nftokenIdMap.size);
          console.log("nftokenIssuerMap: " + this.nftokenIssuerMap.size);
          console.log("nftokenOwnerMap: " + this.nftokenOwnerMap.size);
          console.log("offerIdMap: " + this.offerIdMap.size);
          console.log("offerNftIdMap: " + this.offerNftIdMap.size);
          console.log("offerAccountMap: " + this.offerAccountMap.size);

        } else {
          console.log("nft issuer data file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading nft issuer data from FS");
        console.log(err);
        this.nftokenIdMap = new Map();
        this.nftokenIssuerMap = new Map();
        this.nftokenOwnerMap = new Map();
        this.offerIdMap = new Map();
        this.offerNftIdMap = new Map();
        this.offerAccountMap = new Map();
      }
    }

    public readCurrentLedgerFromFS() {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync(DATA_PATH+"nfts/nftData_1.js")) {
            let nftData:any = JSON.parse(fs.readFileSync(DATA_PATH+"nfts/nftData_1.js").toString());
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

    private isNftOfferExpired(offerExpiration: number | undefined) {
      if(!offerExpiration) {
          return false;
      } else {
          let dateNowWithMargin = Date.now(); //add 20 seconds margin!
          return rippleTimeToUnixTime(offerExpiration) < dateNowWithMargin;
      }
  }
}