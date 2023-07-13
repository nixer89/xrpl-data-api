import * as fs from 'fs';
import { DATA_PATH } from './util/config';
import { AccountOffersrMapEntry, FloorPriceProperty, MarketPlaceStats, NFT, NftCollectionInfo, NFTokenOffer, NFTokenOfferMapEntry, NFTokenOfferReturnObject } from './util/types';
import { rippleTimeToUnixTime } from 'xrpl';
import { klona } from 'klona/json';

export class NftStore {

    private static _instance: NftStore;

    private nftokenIdMap:{[key: string]: NFT} = {};
    private nftokenIdMapTemp:{[key: string]: NFT} = {};
    private nftokenIdMapChanged:boolean = false;

    private nftokenIssuerMap:{[key: string]: {[key: string]: NFT}} = {};
    private nftokenIssuerMapTemp:{[key: string]: {[key: string]: NFT}} = {};
    private nftokenIssuerMapChanged:boolean = false;

    private nftokenOwnerMap:{[key: string]: {[key: string]: NFT}} = {};
    private nftokenOwnerMapTemp:{[key: string]: {[key: string]: NFT}} = {};
    private nftokenOwnerMapChanged:boolean = false;

    private nftokenUriMap:{[key: string]: {[key: string]: NFT}} = {};
    private nftokenUriMapTemp:{[key: string]: {[key: string]: NFT}} = {};
    private nftokenUriMapChanged:boolean = false;

    private offerIdMap:{[key: string]: NFTokenOffer} = {};
    private offerIdMapTemp:{[key: string]: NFTokenOffer} = {};
    private offerIdMapChanged:boolean = false;

    private offerNftIdMap:{[key: string]: NFTokenOfferMapEntry} = {};
    private offerNftIdMapTemp:{[key: string]: NFTokenOfferMapEntry} = {};
    private offerNftIdMapChanged:boolean = false;

    private offerAccountMap:{[key: string]: AccountOffersrMapEntry} = {};
    private offerAccountMapTemp:{[key: string]: AccountOffersrMapEntry} = {};
    private offerAccountMapChanged:boolean = false;

    private current_ledger_index: number;
    private current_ledger_index_temp: number;
    private current_ledger_date: string;
    private current_ledger_date_temp: string;
    private current_ledger_time_ms: number;
    private current_ledger_time_ms_temp: number;
    private current_ledger_hash: string;
    private current_ledger_hash_temp: string;

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

    public getNftFromTemp(nftokenId:string) {
      return this.nftokenIdMapTemp[nftokenId];
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

    public findOfferByIdFromTemp(offerId: string): NFTokenOffer {
      if(this.offerIdMapTemp[offerId])
        return this.offerIdMapTemp[offerId];
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

      this.nftokenIdMapTemp[newNft.NFTokenID] = newNft;
      this.nftokenIdMapChanged = true;

      if(!this.nftokenIssuerMapTemp[newNft.Issuer])
        this.nftokenIssuerMapTemp[newNft.Issuer] = {};

      this.nftokenIssuerMapTemp[newNft.Issuer][newNft.NFTokenID] = newNft;
      this.nftokenIssuerMapChanged = true;

      if(!this.nftokenOwnerMapTemp[newNft.Owner])
        this.nftokenOwnerMapTemp[newNft.Owner] = {};

      this.nftokenOwnerMapTemp[newNft.Owner][newNft.NFTokenID] = newNft;
      this.nftokenOwnerMapChanged = true;

      if(newNft.URI) {
        if(!this.nftokenUriMapTemp[newNft.URI])
          this.nftokenUriMapTemp[newNft.URI] = {};

        this.nftokenUriMapTemp[newNft.URI][newNft.NFTokenID] = newNft;
        this.nftokenUriMapChanged = true;
      }
    }

    public removeNft(burnedNft:NFT) {
      //console.log("burning NFT: " + burnedNft);

      //console.log("nftokenIdMapTemp size BEFORE: " + this.nftokenIdMapTemp.size);
      //console.log("nftokenIssuerMapTemp size BEFORE: " + this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size);

      delete this.nftokenIdMapTemp[burnedNft.NFTokenID];
      this.nftokenIdMapChanged = true;

      if(this.nftokenIdMap[burnedNft.NFTokenID]) {
        console.log("EXISTS IN CURRENT OBJECT");
      }

      if(this.nftokenIdMapTemp[burnedNft.NFTokenID]) {
        console.log("EXISTS IN TEMP OBJECT");
      }

      delete this.nftokenIssuerMapTemp[burnedNft.Issuer][burnedNft.NFTokenID];
      this.nftokenIssuerMapChanged = true;

      delete this.nftokenOwnerMapTemp[burnedNft.Owner][burnedNft.NFTokenID];
      this.nftokenOwnerMapChanged = true;

      if(burnedNft.URI) {
        delete this.nftokenUriMapTemp[burnedNft.URI][burnedNft.NFTokenID];
        this.nftokenUriMapChanged = true;
      }

      //console.log("nftokenIdMapTemp size AFTER: " + this.nftokenIdMapTemp.size);
      //console.log("nftokenIssuerMapTemp size AFTER: " + this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size);
    }

    public changeNftOwner(existingNft:NFT, newOwner: string) {
      if(this.nftokenOwnerMapTemp[existingNft.Owner]) {
        if(this.nftokenOwnerMap[existingNft.Owner][existingNft.NFTokenID]) {
          console.log("EXISTS IN CURRENT OBJECT BEFORE");
        }

        if(this.nftokenOwnerMapTemp[existingNft.Owner][existingNft.NFTokenID]) {
          console.log("EXISTS IN TEMP OBJECT BEFORE");
        }

        delete this.nftokenOwnerMapTemp[existingNft.Owner][existingNft.NFTokenID];
        this.nftokenOwnerMapChanged = true;

        if(this.nftokenOwnerMap[existingNft.Owner][existingNft.NFTokenID]) {
          console.log("EXISTS IN CURRENT OBJECT AFTER");
        }
  
        if(this.nftokenOwnerMapTemp[existingNft.Owner][existingNft.NFTokenID]) {
          console.log("EXISTS IN TEMP OBJECT AFTER");
        }
      }

      existingNft.Owner = newOwner;

      if(!this.nftokenOwnerMapTemp[existingNft.Owner])
        this.nftokenOwnerMapTemp[existingNft.Owner] = {};

      this.nftokenOwnerMapTemp[existingNft.Owner][existingNft.NFTokenID] =  existingNft;
      this.nftokenOwnerMapChanged = true;

      this.nftokenIdMapTemp[existingNft.NFTokenID] = existingNft;
      this.nftokenIdMapChanged = true;

      this.nftokenIssuerMapTemp[existingNft.Issuer][existingNft.NFTokenID] = existingNft;
      this.nftokenIssuerMapChanged = true;

      if(existingNft.URI) {
        if(!this.nftokenUriMapTemp[existingNft.URI]) {
          this.nftokenUriMapTemp[existingNft.URI] = {};
        }

        this.nftokenUriMapTemp[existingNft.URI][existingNft.NFTokenID] = existingNft;
        this.nftokenUriMapChanged = true;
      }
    }

    public async addNFTOffer(newOffer:NFTokenOffer) {

      this.offerIdMapTemp[newOffer.OfferID] = newOffer;
      this.offerIdMapChanged = true;

      if(!this.offerNftIdMapTemp[newOffer.NFTokenID])
        this.offerNftIdMapTemp[newOffer.NFTokenID] = {buy: {}, sell: {}};

      //this is a sell offer!
      if(newOffer.Flags && newOffer.Flags == 1) {
        this.offerNftIdMapTemp[newOffer.NFTokenID].sell[newOffer.OfferID] = newOffer;
      } else { //this is a buy offer!
        this.offerNftIdMapTemp[newOffer.NFTokenID].buy[newOffer.OfferID] = newOffer;
      }
      this.offerNftIdMapChanged = true;

      if(!this.offerAccountMapTemp[newOffer.Owner]) {
        this.offerAccountMapTemp[newOffer.Owner] = {as_destination: {}, as_owner: {}};
      }

      this.offerAccountMapTemp[newOffer.Owner].as_owner[newOffer.OfferID] = newOffer;
      this.offerAccountMapChanged = true;

      if(newOffer.Destination) {
        if(!this.offerAccountMapTemp[newOffer.Destination]) {
          this.offerAccountMapTemp[newOffer.Destination] = {as_destination: {}, as_owner: {}};
        }

        this.offerAccountMapTemp[newOffer.Destination].as_destination[newOffer.OfferID] = newOffer;
        this.offerAccountMapChanged = true;
      }

    }

    public removeNftOffer(deletedOffer:NFTokenOffer) {

      delete this.offerIdMapTemp[deletedOffer.OfferID];
      this.offerIdMapChanged = true;

      if(deletedOffer.Flags && deletedOffer.Flags == 1) {
        delete this.offerNftIdMapTemp[deletedOffer.NFTokenID].sell[deletedOffer.OfferID];
      } else {
        delete this.offerNftIdMapTemp[deletedOffer.NFTokenID].buy[deletedOffer.OfferID];
      }

      this.offerNftIdMapChanged = true;

      if(this.offerAccountMapTemp[deletedOffer.Owner]) {
        delete this.offerAccountMapTemp[deletedOffer.Owner].as_owner[deletedOffer.OfferID];
        this.offerAccountMapChanged = true;
      }

      if(deletedOffer.Destination && this.offerAccountMapTemp[deletedOffer.Destination]) {
        delete this.offerAccountMapTemp[deletedOffer.Destination].as_destination[deletedOffer.OfferID];
        this.offerAccountMapChanged = true;
      }
    }

    public closeInternalStuff(force?:boolean) {

      console.log("start cloning!");

      let start = Date.now();
      if(this.nftokenIdMapChanged || force) {
        this.nftokenIdMap = this.deepClone(this.nftokenIdMapTemp);
        this.nftokenIdMapChanged = false;
      }

      if(this.nftokenIssuerMapChanged || force) {
        this.nftokenIssuerMap = this.deepClone(this.nftokenIssuerMapTemp);
        this.nftokenIssuerMapChanged = false;
      }
      
      if(this.nftokenOwnerMapChanged || force) {
        this.nftokenOwnerMap = this.deepClone(this.nftokenOwnerMapTemp);
        this.nftokenOwnerMapChanged = false;
      }

      if(this.nftokenUriMapChanged || force) {
        this.nftokenUriMap = this.deepClone(this.nftokenUriMapTemp);
        this.nftokenUriMapChanged = false;
      }

      if(this.offerIdMapChanged || force) {
        this.offerIdMap = this.deepClone(this.offerIdMapTemp);
        this.offerIdMapChanged = false;
      }

      if(this.offerNftIdMapChanged || force) {
        this.offerNftIdMap = this.deepClone(this.offerNftIdMapTemp);
        this.offerNftIdMapChanged = false;
      }

      if(this.offerAccountMapChanged || force) {
        this.offerAccountMap =  this.deepClone(this.offerAccountMapTemp);
        this.offerAccountMapChanged = false;
      }

      this.current_ledger_date = this.current_ledger_date_temp;
      this.current_ledger_hash = this.current_ledger_hash_temp;
      this.current_ledger_index = this.current_ledger_index_temp;
      this.current_ledger_time_ms = this.current_ledger_time_ms_temp;

      console.log("close done: " + (Date.now() - start) + " ms.");
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

                this.nftokenIdMapTemp = {};
                this.nftokenIssuerMapTemp = {};
                this.nftokenOwnerMapTemp = {};
                this.nftokenUriMapTemp = {};
                this.offerAccountMapTemp = {};

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

              this.offerIdMapTemp = {};
              this.offerNftIdMapTemp = {};

              for(let i = 0; i < offerArray.length; i++) {
                this.addNFTOffer(offerArray[i]);
              }

          }

          this.closeInternalStuff(true);

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
        this.nftokenIdMapTemp = {};
        this.nftokenIssuerMap = {};
        this.nftokenIssuerMapTemp = {};
        this.nftokenOwnerMap = {};
        this.nftokenOwnerMapTemp = {};
        this.nftokenUriMap = {};
        this.nftokenUriMapTemp = {};
        this.offerIdMap = {};
        this.offerIdMapTemp = {};
        this.offerNftIdMap = {};
        this.offerNftIdMapTemp = {};
        this.offerAccountMap = {};
        this.offerAccountMapTemp = {};
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

    private isNftOfferExpired(offerExpiration: number | undefined) {
      if(!offerExpiration) {
          return false;
      } else {
          let dateNowWithMargin = Date.now(); //add 20 seconds margin!
          return rippleTimeToUnixTime(offerExpiration) < dateNowWithMargin;
      }
  }

  private deepClone(obj): any {
    return klona(obj);
  }

}