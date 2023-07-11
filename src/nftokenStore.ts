import * as fs from 'fs';
import { rippleTimeToUnixTime } from 'xrpl';
import { DATA_PATH } from './util/config';
import { AccountOffersrMapEntry, FloorPriceProperty, MarketPlaceStats, NFT, NftCollectionInfo, NFTokenOffer, NFTokenOfferMapEntry, NFTokenOfferReturnObject } from './util/types';

export class NftStore {

    private static _instance: NftStore;

    private nftokenIdMap:Map<string, NFT> = new Map();
    private nftokenIdMapTemp:Map<string, NFT> = new Map();
    private nftokenIdMapChanged:boolean = false;

    private nftokenIssuerMap:Map<string, Map<string, NFT>> = new Map();
    private nftokenIssuerMapTemp:Map<string, Map<string, NFT>> = new Map();
    private nftokenIssuerMapChanged:boolean = false;

    private nftokenOwnerMap:Map<string, Map<string, NFT>> = new Map();
    private nftokenOwnerMapTemp:Map<string, Map<string, NFT>> = new Map();
    private nftokenOwnerMapChanged:boolean = false;

    private nftokenUriMap:Map<string, Map<string, NFT>> = new Map();
    private nftokenUriMapTemp:Map<string, Map<string, NFT>> = new Map();
    private nftokenUriMapChanged:boolean = false;

    private offerIdMap: Map<string, NFTokenOffer> = new Map();
    private offerIdMapTemp: Map<string, NFTokenOffer> = new Map();
    private offerIdMapChanged:boolean = false;

    private offerNftIdMap: Map<string, NFTokenOfferMapEntry> = new Map();
    private offerNftIdMapTemp: Map<string, NFTokenOfferMapEntry> = new Map();
    private offerNftIdMapChanged:boolean = false;

    private offerAccountMap:Map<string,AccountOffersrMapEntry> = new Map();
    private offerAccountMapTemp:Map<string,AccountOffersrMapEntry> = new Map();
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
      if(this.nftokenOwnerMap.has(ownerAccount))
        return Array.from(this.nftokenOwnerMap.get(ownerAccount).values());
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
      if(this.nftokenUriMap.has(uri))
        return Array.from(this.nftokenUriMap.get(uri).values());
      else
        return [];
    }

    public findOfferById(offerId: string): NFTokenOffer {
      if(this.offerIdMap.has(offerId))
        return this.offerIdMap.get(offerId)
      else
        return null;
    }

    public findOffersByNft(nftokenId: string, nftOwner: string): NFTokenOfferReturnObject {
      if(this.offerNftIdMap.has(nftokenId)) {
        return {
          NFTokenID: nftokenId,
          NFTokenOwner: nftOwner,
          buy: Array.from(this.offerNftIdMap.get(nftokenId).buy.values()),
          sell: Array.from(this.offerNftIdMap.get(nftokenId).sell.values())
        }
      } else
        return {
          NFTokenID: nftokenId,
          NFTokenOwner: nftOwner,
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
      let nftsFromIssuer = this.findNFtsByOwner(nftOwnerAddress);

      return this.findAllOffersFromNfts(nftsFromIssuer);
    }

    public findAllOffersFromNfts(nfts:NFT[]): NFTokenOfferReturnObject[] {
      if(nfts && nfts.length > 0) {
        let returnArray:NFTokenOfferReturnObject[] = [];
        for(let i = 0; i < nfts.length; i++) {
          let offerObject:NFTokenOfferReturnObject = this.findOffersByNft(nfts[i].NFTokenID, nfts[i].Owner);
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

      let offersFromOwner = Array.from(this.offerAccountMap.get(ownerAddress).as_owner.values());

      if(offersFromOwner && offersFromOwner.length > 0)
        return offersFromOwner;
      else
        return [];
    }

    public findOffersByOfferDestination(destinationAddress: string): NFTokenOffer[] {
      //first get all NFT from an issuer
      //let offersWithDestination = Array.from(this.offerIdMap.values()).filter(offer => offer.Destination && offer.Destination === destinationAddress);

      let offersWithDestination = Array.from(this.offerAccountMap.get(destinationAddress).as_destination.values());

      if(offersWithDestination && offersWithDestination.length > 0)
        return offersWithDestination;
      else
        return [];
    }

    public getCollectionInfo(issuer:string, taxon: number): NftCollectionInfo {
      let collectionNfts:NFT[] = [];
      let collectionOffers:NFTokenOfferReturnObject[] = [];
      
      if(taxon) {
        collectionNfts = this.findNftsByIssuerAndTaxon(issuer,taxon);
        collectionOffers = this.findOffersByIssuerAndTaxon(issuer, taxon);
      } else {
        collectionNfts = this.findNftsByIssuer(issuer);
        collectionOffers = this.findOffersByIssuer(issuer);
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

          if(amount > 0 && !this.isNftOfferExpired(singleSellOffer.Expiration) && singleSellOffer.Owner === this.findNftokenById(collectionOffers[i].NFTokenID).Owner) {

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

      this.nftokenIdMapTemp.set(newNft.NFTokenID, newNft);
      this.nftokenIdMapChanged = true;

      if(!this.nftokenIssuerMapTemp.has(newNft.Issuer))
        this.nftokenIssuerMapTemp.set(newNft.Issuer, new Map());

      this.nftokenIssuerMapTemp.get(newNft.Issuer).set(newNft.NFTokenID, newNft);
      this.nftokenIssuerMapChanged = true;

      if(!this.nftokenOwnerMapTemp.has(newNft.Owner))
        this.nftokenOwnerMapTemp.set(newNft.Owner, new Map());

      this.nftokenOwnerMapTemp.get(newNft.Owner).set(newNft.NFTokenID, newNft);
      this.nftokenOwnerMapChanged = true;

      if(newNft.URI) {
        if(!this.nftokenUriMapTemp.has(newNft.URI))
          this.nftokenUriMapTemp.set(newNft.URI, new Map());

        this.nftokenUriMapTemp.get(newNft.URI).set(newNft.NFTokenID, newNft);
        this.nftokenUriMapChanged = true;
      }
    }

    public removeNft(burnedNft:NFT) {
      //console.log("burning NFT: " + burnedNft);

      //console.log("nftokenIdMapTemp size BEFORE: " + this.nftokenIdMapTemp.size);
      //console.log("nftokenIssuerMapTemp size BEFORE: " + this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size);

      this.nftokenIdMapTemp.delete(burnedNft.NFTokenID);
      this.nftokenIdMapChanged = true;

      this.nftokenIssuerMapTemp.get(burnedNft.Issuer).delete(burnedNft.NFTokenID);
      this.nftokenIssuerMapChanged = true;

      if(this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size <= 0) {
        this.nftokenIssuerMapTemp.delete(burnedNft.Issuer)
      }

      this.nftokenOwnerMapTemp.get(burnedNft.Owner).delete(burnedNft.NFTokenID);
      this.nftokenOwnerMapChanged = true;

      if(this.nftokenOwnerMapTemp.get(burnedNft.Owner).size <= 0) {
        this.nftokenOwnerMapTemp.delete(burnedNft.Owner);
      }

      if(burnedNft.URI) {
        this.nftokenUriMapTemp.get(burnedNft.URI).delete(burnedNft.NFTokenID);
        this.nftokenUriMapChanged = true;

        if(this.nftokenUriMapTemp.get(burnedNft.URI).size <= 0) {
          this.nftokenUriMapTemp.delete(burnedNft.URI);
        }
      }

      //console.log("nftokenIdMapTemp size AFTER: " + this.nftokenIdMapTemp.size);
      //console.log("nftokenIssuerMapTemp size AFTER: " + this.nftokenIssuerMapTemp.get(burnedNft.Issuer).size);
    }

    public changeNftOwner(existingNft:NFT, newOwner: string) {
      if(this.nftokenOwnerMapTemp.has(existingNft.Owner)) {
        this.nftokenOwnerMapTemp.get(existingNft.Owner).delete(existingNft.NFTokenID)
        this.nftokenOwnerMapChanged = true;
      }

      if(this.nftokenOwnerMapTemp.get(existingNft.Owner).size <= 0) {
        this.nftokenOwnerMapTemp.delete(existingNft.Owner);
      }

      if(this.offerAccountMapTemp.has(existingNft.Owner) && this.offerNftIdMapTemp.has(existingNft.NFTokenID)) {
        //move offers
        let allBuyOffersForNft = Array.from(this.offerNftIdMapTemp.get(existingNft.NFTokenID).buy.values());
        let allSellOffersForNft = Array.from(this.offerNftIdMapTemp.get(existingNft.NFTokenID).sell.values());

        if(!this.offerAccountMapTemp.has(newOwner)) {
          this.offerAccountMapTemp.set(newOwner, {as_destination: new Map(), as_owner: new Map(), for_owned_NFTs: new Map()})
        }

        for(let i = 0; i < allBuyOffersForNft.length; i++) {
          let success = this.offerAccountMapTemp.get(existingNft.Owner).for_owned_NFTs.delete(allBuyOffersForNft[i].OfferID);
          this.offerAccountMapChanged = true;

          if(!success) {
            console.log("BUY OFFER DIDN'T EXIST. COULD NOT MOVE. SOMETHING IS WRONG!")
          }
          this.offerAccountMapTemp.get(newOwner).for_owned_NFTs.set(allBuyOffersForNft[i].OfferID, allBuyOffersForNft[i]);
        }

        for(let j = 0; j < allSellOffersForNft.length; j++) {
          let success = this.offerAccountMapTemp.get(existingNft.Owner).for_owned_NFTs.delete(allSellOffersForNft[j].OfferID);
          this.offerAccountMapChanged = true;

          if(!success) {
            console.log("SELL OFFER DIDN'T EXIST. COULD NOT MOVE. SOMETHING IS WRONG!")
          }

          this.offerAccountMapTemp.get(newOwner).for_owned_NFTs.set(allSellOffersForNft[j].OfferID, allSellOffersForNft[j]);
        }
      }

      existingNft.Owner = newOwner;

      if(!this.nftokenOwnerMapTemp.has(existingNft.Owner))
        this.nftokenOwnerMapTemp.set(existingNft.Owner, new Map());

      this.nftokenOwnerMapTemp.get(existingNft.Owner).set(existingNft.NFTokenID, existingNft);
      this.nftokenOwnerMapChanged = true;

      this.nftokenIdMapTemp.set(existingNft.NFTokenID, existingNft);
      this.nftokenIdMapChanged = true;

      this.nftokenIssuerMapTemp.get(existingNft.Issuer).set(existingNft.NFTokenID, existingNft);
      this.nftokenIssuerMapChanged = true;

      if(existingNft.URI) {
        if(!this.nftokenUriMapTemp.has(existingNft.URI)) {
          this.nftokenUriMapTemp.set(existingNft.URI, new Map());
        }

        this.nftokenUriMapTemp.get(existingNft.URI).set(existingNft.NFTokenID, existingNft);
        this.nftokenUriMapChanged = true;
      }
    }

    public async addNFTOffer(newOffer:NFTokenOffer) {

      this.offerIdMapTemp.set(newOffer.OfferID, newOffer);
      this.offerIdMapChanged = true;

      if(!this.offerNftIdMapTemp.has(newOffer.NFTokenID))
        this.offerNftIdMapTemp.set(newOffer.NFTokenID, {buy: new Map(), sell: new Map()});

      //this is a sell offer!
      if(newOffer.Flags && newOffer.Flags == 1) {
        this.offerNftIdMapTemp.get(newOffer.NFTokenID).sell.set(newOffer.OfferID, newOffer);
      } else { //this is a buy offer!
        this.offerNftIdMapTemp.get(newOffer.NFTokenID).buy.set(newOffer.OfferID, newOffer);
      }
      this.offerNftIdMapChanged = true;

      let nft = this.nftokenIdMap.get(newOffer.NFTokenID);

      if(!this.offerAccountMapTemp.has(newOffer.Owner)) {
        this.offerAccountMapTemp.set(newOffer.Owner, {as_destination: new Map(), as_owner: new Map(), for_owned_NFTs: new Map()})
      }

      this.offerAccountMapTemp.get(newOffer.Owner).as_owner.set(newOffer.OfferID, newOffer);
      this.offerAccountMapChanged = true;

      if(newOffer.Destination) {
        if(!this.offerAccountMapTemp.has(newOffer.Destination)) {
          this.offerAccountMapTemp.set(newOffer.Destination, {as_destination: new Map(), as_owner: new Map(), for_owned_NFTs: new Map()})
        }

        this.offerAccountMapTemp.get(newOffer.Destination).as_destination.set(newOffer.OfferID, newOffer);
        this.offerAccountMapChanged = true;
      }

      if(nft) {
        if(!this.offerAccountMapTemp.has(nft.Owner)) {
          this.offerAccountMapTemp.set(nft.Owner, {as_destination: new Map(), as_owner: new Map(), for_owned_NFTs: new Map()})
        }

        this.offerAccountMapTemp.get(nft.Owner).for_owned_NFTs.set(newOffer.OfferID, newOffer);
        this.offerAccountMapChanged = true;
      } else {
        console.log("NFT FOR OFFER NOT FOUND?")
        console.log("OfferID: " + newOffer.OfferID);
        console.log("NFTokenID: " + newOffer.NFTokenID)
      }
    }

    public removeNftOffer(deletedOffer:NFTokenOffer) {

      this.offerIdMapTemp.delete(deletedOffer.OfferID);
      this.offerIdMapChanged = true;

      if(deletedOffer.Flags && deletedOffer.Flags == 1) {
        this.offerNftIdMapTemp.get(deletedOffer.NFTokenID).sell.delete(deletedOffer.OfferID);
      } else {
        this.offerNftIdMapTemp.get(deletedOffer.NFTokenID).buy.delete(deletedOffer.OfferID);
      }

      this.offerNftIdMapChanged = true;

      if(this.offerAccountMapTemp.has(deletedOffer.Owner)) {
        this.offerAccountMapTemp.get(deletedOffer.Owner).as_owner.delete(deletedOffer.OfferID)
        this.offerAccountMapChanged = true;
      }

      if(deletedOffer.Destination && this.offerAccountMapTemp.has(deletedOffer.Destination)) {
        this.offerAccountMapTemp.get(deletedOffer.Destination).as_destination.delete(deletedOffer.OfferID)
        this.offerAccountMapChanged = true;
      }

      let nft = this.nftokenIdMap.get(deletedOffer.NFTokenID);

      if(nft) {
        if(this.offerAccountMapTemp.has(nft.Owner)) {
          this.offerAccountMapTemp.get(nft.Owner).for_owned_NFTs.delete(deletedOffer.OfferID);
          this.offerAccountMapChanged = true;
        }
      }
    }

    public closeInternalStuff(force?:boolean) {

      if(this.nftokenIdMapChanged || force) {
        this.nftokenIdMap = new Map(this.nftokenIdMapTemp)
        this.nftokenIdMapChanged = false;
      }

      if(this.nftokenIssuerMapChanged || force) {
        this.nftokenIssuerMap = new Map(this.nftokenIssuerMapTemp);
        this.nftokenIssuerMapChanged = false;
      }
      
      if(this.nftokenOwnerMapChanged || force) {
        this.nftokenOwnerMap = new Map(this.nftokenOwnerMapTemp);
        this.nftokenOwnerMapChanged = false;
      }

      if(this.nftokenUriMapChanged || force) {
        this.nftokenUriMap = new Map(this.nftokenUriMapTemp);
        this.nftokenUriMapChanged = false;
      }

      if(this.offerIdMapChanged || force) {
        this.offerIdMap = new Map(this.offerIdMapTemp);
        this.offerIdMapChanged = false;
      }

      if(this.offerNftIdMapChanged || force) {
        this.offerNftIdMap = new Map(this.offerNftIdMapTemp);
        this.offerNftIdMapChanged = false;
      }

      if(this.offerAccountMapChanged || force) {
        this.offerAccountMap = new Map(this.offerAccountMapTemp);
        this.offerAccountMapChanged = false;
      }

      this.current_ledger_date = this.current_ledger_date_temp;
      this.current_ledger_hash = this.current_ledger_hash_temp;
      this.current_ledger_index = this.current_ledger_index_temp;
      this.current_ledger_time_ms = this.current_ledger_time_ms_temp;
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

                this.nftokenIdMapTemp = new Map();
                this.nftokenIssuerMapTemp = new Map();
                this.nftokenOwnerMapTemp = new Map();
                this.nftokenUriMapTemp = new Map();

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

              this.offerIdMapTemp = new Map();
              this.offerNftIdMapTemp = new Map();

              for(let i = 0; i < offerArray.length; i++) {
                this.addNFTOffer(offerArray[i]);
              }

          }

          this.closeInternalStuff(true);

          console.log("NFTs loaded!");
          console.log("nftokenIdMap: " + this.nftokenIdMap.size);
          console.log("nftokenIssuerMap: " + this.nftokenIssuerMap.size);
          console.log("nftokenOwnerMap: " + this.nftokenOwnerMap.size);
          console.log("nftokenUriMap: " + this.nftokenUriMap.size);
          console.log("offerIdMap: " + this.offerIdMap.size);
          console.log("offerNftIdMap: " + this.offerNftIdMap.size);

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
        this.nftokenOwnerMap = new Map();
        this.nftokenOwnerMapTemp = new Map();
        this.nftokenUriMap = new Map();
        this.nftokenUriMapTemp = new Map();
        this.offerIdMapTemp = new Map();
        this.offerNftIdMapTemp = new Map();
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
}