import * as fs from 'fs';
import { DATA_PATH } from './util/config';
import { AccountOffersrMapEntry, FloorPriceProperty, MarketPlaceStats, NFT, NftCollectionInfo, NFTokenOffer, NFTokenOfferMapEntry, NFTokenOfferReturnObject } from './util/types';
import { rippleTimeToUnixTime } from 'xrpl';

export class NftStore {

    private static _instance: NftStore;

    private nftokenIdMap:{[key: string]: NFT} = {};

    private nftokenIssuerMap:{[key: string]: {[key: string]: NFT}} = {};

    private nftokenOwnerMap:{[key: string]: {[key: string]: NFT}} = {};

    private nftokenUriMap:{[key: string]: {[key: string]: NFT}} = {};

    private offerIdMap:{[key: string]: NFTokenOffer} = {};

    private offerNftIdMap:{[key: string]: NFTokenOfferMapEntry} = {};

    private offerAccountMap:{[key: string]: AccountOffersrMapEntry} = {};

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

    public getNft(nftokenId:string) {
      return this.nftokenIdMap[nftokenId];
    }

    public getAllIssuers(): string[] {
      return Object.keys(this.nftokenIssuerMap);
    }

    public findNftsByIssuer(issuerAddress: string): NFT[] {
      if(this.nftokenIssuerMap[issuerAddress])
        return Object.values(this.nftokenIssuerMap[issuerAddress]).sort((a,b) => a.Taxon - b.Taxon || a.Sequence - b.Sequence);
      else
        return [];
    }

    public findNFTsByOwner(ownerAccount: string): NFT[] {
      if(this.nftokenOwnerMap[ownerAccount])
        return Object.values(this.nftokenOwnerMap[ownerAccount])
      else
        return [];
    }

    public findTaxonsByIssuer(issuerAddress: string): number[] {
      
      if(this.nftokenIssuerMap[issuerAddress]) {
        let taxons:number[] = [];
        let nfts:NFT[] = Object.values(this.nftokenIssuerMap[issuerAddress])

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
      if(this.nftokenIssuerMap[issuerAddress])
        return Object.values(this.nftokenIssuerMap[issuerAddress]).filter(nft => nft.Taxon == taxon).sort((a,b) => a.Sequence - b.Sequence);
      else
        return [];
    }

    public findNftokenById(nftokenId:string): NFT {
      if(this.nftokenIdMap[nftokenId])
        return this.nftokenIdMap[nftokenId];
      else
        return null;
    }

    public findNftokenByUri(uri:string): NFT[] {
      if(this.nftokenUriMap[uri])
        return Object.values(this.nftokenUriMap[uri]);
      else
        return [];
    }

    public findOfferById(offerId: string): NFTokenOffer {
      if(this.offerIdMap[offerId])
        return this.offerIdMap[offerId]
      else
        return null;
    }

    public findOffersByNft(nftokenId: string, nftOwner: string, uri: string): NFTokenOfferReturnObject {
      if(this.offerNftIdMap[nftokenId]) {
        return {
          NFTokenID: nftokenId,
          NFTokenOwner: nftOwner,
          URI: uri,
          buy: Object.values(this.offerNftIdMap[nftokenId].buy),
          sell: Object.values(this.offerNftIdMap[nftokenId].sell)
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

        return returnArray;
      } else {
        return [];
      }
    }

    public findOffersByOfferOwner(ownerAddress: string): NFTokenOffer[] {
      //first get all NFT from an issuer
      //let offersFromOwner = Array.from(this.offerIdMap.values()).filter(offer => offer.Owner === ownerAddress);

      if(this.offerAccountMap[ownerAddress] && Object.keys(this.offerAccountMap[ownerAddress].as_owner).length > 0) {
        return Object.values(this.offerAccountMap[ownerAddress].as_owner)
      } else {
        return [];
      }
    }

    public findOffersByOfferDestination(destinationAddress: string): NFTokenOffer[] {
      //first get all NFT from an issuer
      //let offersWithDestination = Array.from(this.offerIdMap.values()).filter(offer => offer.Destination && offer.Destination === destinationAddress);

      if(this.offerAccountMap[destinationAddress] && Object.keys(this.offerAccountMap[destinationAddress].as_destination).length > 0)
        return Object.values(this.offerAccountMap[destinationAddress].as_destination)
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

      this.nftokenIdMap[newNft.NFTokenID] = newNft;

      if(!this.nftokenIssuerMap[newNft.Issuer])
        this.nftokenIssuerMap[newNft.Issuer] = {};

      this.nftokenIssuerMap[newNft.Issuer][newNft.NFTokenID] = newNft;

      if(!this.nftokenOwnerMap[newNft.Owner])
        this.nftokenOwnerMap[newNft.Owner] = {};

      this.nftokenOwnerMap[newNft.Owner][newNft.NFTokenID] = newNft;

      if(newNft.URI) {
        if(!this.nftokenUriMap[newNft.URI])
          this.nftokenUriMap[newNft.URI] = {};

        this.nftokenUriMap[newNft.URI][newNft.NFTokenID] = newNft;
      }
    }

    public removeNft(burnedNft:NFT) {
      //console.log("burning NFT: " + burnedNft);

      //console.log("nftokenIdMap size BEFORE: " + this.nftokenIdMap.size);
      //console.log("nftokenIssuerMap size BEFORE: " + this.nftokenIssuerMap.get(burnedNft.Issuer).size);

      delete this.nftokenIdMap[burnedNft.NFTokenID];

      delete this.nftokenIssuerMap[burnedNft.Issuer][burnedNft.NFTokenID];

      delete this.nftokenOwnerMap[burnedNft.Owner][burnedNft.NFTokenID];

      if(burnedNft.URI) {
        delete this.nftokenUriMap[burnedNft.URI][burnedNft.NFTokenID];
      }

      //console.log("nftokenIdMap size AFTER: " + this.nftokenIdMap.size);
      //console.log("nftokenIssuerMap size AFTER: " + this.nftokenIssuerMap.get(burnedNft.Issuer).size);
    }

    public changeNftOwner(existingNft:NFT, newOwner: string) {
      if(this.nftokenOwnerMap[existingNft.Owner]) {
        delete this.nftokenOwnerMap[existingNft.Owner][existingNft.NFTokenID];
      }

      existingNft.Owner = newOwner;

      if(!this.nftokenOwnerMap[existingNft.Owner])
        this.nftokenOwnerMap[existingNft.Owner] = {};

      this.nftokenOwnerMap[existingNft.Owner][existingNft.NFTokenID] =  existingNft;

      this.nftokenIdMap[existingNft.NFTokenID] = existingNft;

      this.nftokenIssuerMap[existingNft.Issuer][existingNft.NFTokenID] = existingNft;

      if(existingNft.URI) {
        if(!this.nftokenUriMap[existingNft.URI]) {
          this.nftokenUriMap[existingNft.URI] = {};
        }

        this.nftokenUriMap[existingNft.URI][existingNft.NFTokenID] = existingNft;
      }
    }

    public async addNFTOffer(newOffer:NFTokenOffer) {

      this.offerIdMap[newOffer.OfferID] = newOffer;

      if(!this.offerNftIdMap[newOffer.NFTokenID])
        this.offerNftIdMap[newOffer.NFTokenID] = {buy: {}, sell: {}};

      //this is a sell offer!
      if(newOffer.Flags && newOffer.Flags == 1) {
        this.offerNftIdMap[newOffer.NFTokenID].sell[newOffer.OfferID] = newOffer;
      } else { //this is a buy offer!
        this.offerNftIdMap[newOffer.NFTokenID].buy[newOffer.OfferID] = newOffer;
      }

      if(!this.offerAccountMap[newOffer.Owner]) {
        this.offerAccountMap[newOffer.Owner] = {as_destination: {}, as_owner: {}};
      }

      this.offerAccountMap[newOffer.Owner].as_owner[newOffer.OfferID] = newOffer;

      if(newOffer.Destination) {
        if(!this.offerAccountMap[newOffer.Destination]) {
          this.offerAccountMap[newOffer.Destination] = {as_destination: {}, as_owner: {}};
        }

        this.offerAccountMap[newOffer.Destination].as_destination[newOffer.OfferID] = newOffer;
      }

    }

    public removeNftOffer(deletedOffer:NFTokenOffer) {

      delete this.offerIdMap[deletedOffer.OfferID];

      if(deletedOffer.Flags && deletedOffer.Flags == 1) {
        delete this.offerNftIdMap[deletedOffer.NFTokenID].sell[deletedOffer.OfferID];
      } else {
        delete this.offerNftIdMap[deletedOffer.NFTokenID].buy[deletedOffer.OfferID];
      }

      if(this.offerAccountMap[deletedOffer.Owner]) {
        delete this.offerAccountMap[deletedOffer.Owner].as_owner[deletedOffer.OfferID];
      }

      if(deletedOffer.Destination && this.offerAccountMap[deletedOffer.Destination]) {
        delete this.offerAccountMap[deletedOffer.Destination].as_destination[deletedOffer.OfferID];
      }
    }

    public loadNftDataFromFS() {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync(DATA_PATH+"nftData.js")) {
            let nftData:any = JSON.parse(fs.readFileSync(DATA_PATH+"nftData.js").toString());
            if(nftData && nftData.nfts) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                let nftArray:NFT[] = nftData.nfts;

                //console.log("nftArray: " + this.nftArray.length);

                this.nftokenIdMap = {};
                this.nftokenIssuerMap = {};
                this.nftokenOwnerMap = {};
                this.nftokenUriMap = {};
                this.offerAccountMap = {};

                this.setCurrentLedgerIndex(nftData.ledger_index);
                this.setCurrentLedgerHash(nftData.ledger_hash);
                this.setCurrentLedgerCloseTime(nftData.ledger_close);
                this.setCurrentLedgerCloseTimeMs(nftData.ledger_close_ms);

                for(let i = 0; i < nftArray.length; i++) {
                  this.addNFT(nftArray[i]);
                }
            }
        } else {
          console.log("nft issuer data file does not exist yet.")
        }

        if(fs.existsSync(DATA_PATH+"nftOffers.js")) {
          let nftOffers:any = JSON.parse(fs.readFileSync(DATA_PATH+"nftOffers.js").toString());
          if(nftOffers && nftOffers.offers) {
              //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
              let offerArray:NFTokenOffer[] = nftOffers.offers;

              //console.log("nftArray: " + this.nftArray.length);

              this.offerIdMap = {};
              this.offerNftIdMap = {};

              for(let i = 0; i < offerArray.length; i++) {
                this.addNFTOffer(offerArray[i]);
              }

          }

          console.log("NFTs loaded!");
          console.log("nftokenIdMap: " + Object.keys(this.nftokenIdMap).length);
          console.log("nftokenIssuerMap: " + Object.keys(this.nftokenIssuerMap).length);
          console.log("nftokenOwnerMap: " + Object.keys(this.nftokenOwnerMap).length);
          console.log("nftokenUriMap: " + Object.keys(this.nftokenUriMap).length);
          console.log("offerIdMap: " + Object.keys(this.offerIdMap).length);
          console.log("offerNftIdMap: " + Object.keys(this.offerNftIdMap).length);
          console.log("offerAccountMap: " + Object.keys(this.offerAccountMap).length);

      } else {
        console.log("nft issuer data file does not exist yet.")
      }
      } catch(err) {
        console.log("error reading nft issuer data from FS");
        console.log(err);
        this.nftokenIdMap = {};
        this.nftokenIssuerMap = {};
        this.nftokenOwnerMap = {};
        this.nftokenUriMap = {};
        this.offerIdMap = {};
        this.offerNftIdMap = {};
        this.offerAccountMap = {};
      }
    }

    public readCurrentLedgerFromFS() {
      try {
        //console.log("loading nft issuer data from FS");
        if(fs.existsSync(DATA_PATH+"nftData.js")) {
            let nftData:any = JSON.parse(fs.readFileSync(DATA_PATH+"nftData.js").toString());
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