import { NftStore } from "../nftokenStore";
import { LedgerSync } from "../syncLedger";
import { NftApiReturnObject, NFTokenOffer } from "../util/types";

let nftStore: NftStore = NftStore.Instance;
let ledgerSync: LedgerSync = LedgerSync.Instance;

export async function registerRoutes(fastify, opts, done) {

    fastify.get('/api/v1/xls20-nfts/offers/nft/:nftokenid', async (request, reply) => {
        try {
          if(!request.params.nftokenid) {
            reply.code(400).send('Please provide a nftokenid. Calls without nftokenid are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nft = nftStore.findNftokenById(request.params.nftokenid);
          let offers = nftStore.findOffersByNft(request.params.nftokenid, nft ? nft.Owner : null);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              nftokenid: request.params.nftokenid,
              offers: offers
            }
          }

          //console.log("xls20_offers_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving offers by nftokenid");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offer/id/:offerid', async (request, reply) => {
        try {
          if(!request.params.offerid) {
            reply.code(400).send('Please provide an offerid. Calls without offerid are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let offer = nftStore.findOfferById(request.params.offerid);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              offerid: request.params.offerid,
              offer: offer
            }
          }

          //console.log("xls20_offer_by_offerid"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving offers by nftokenid");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/issuer/:issuer', async (request, reply) => {
        try {
          if(!request.params.issuer) {
            reply.code(400).send('Please provide an issuer. Calls without issuer are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByIssuer(request.params.issuer);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuer: request.params.issuer,
              offers: offers
            }
          }

          //console.log("xls20_offers_by_issuer"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving offers by issuer");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/issuer/:issuer/taxon/:taxon', async (request, reply) => {
        try {
          if(!request.params.issuer || !request.params.taxon) {
            reply.code(400).send('Please provide an issuer and taxon. Calls without issuer and taxon are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByIssuerAndTaxon(request.params.issuer, request.params.taxon);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuer: request.params.issuer,
              taxon: request.params.taxon,
              offers: offers
            }
          }

          //console.log("xls20_offers_by_issuer_and_taxon"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by issuer and taxon");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/owner/:owner', async (request, reply) => {
        try {

          let ip = request.headers['cf-connecting-ip'] // cloudflare originally connecting IP
                || request.headers['x-real-ip'] // nginx
                || request.headers['x-client-ip'] // apache
                || request.headers['x-forwarded-for'] // use this only if you trust the header
                || request.ip // fallback to default

          console.log("OLD OFFERS BY NFT OWNER METHOD FROM: " + ip);
          if(!request.params.owner) {
            reply.code(400).send('Please provide an NFT owner address. Calls without the NFT Owner Address are not allowed');
          }

         // let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByNftOwner(request.params.owner);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              nftowner: request.params.owner,
              offers: offers,
              message: "THE '/owner' ENDPOINT WILL BE REMOVED SOON BECAUSE ITS NAME HAS CHANGED! PLEASE USE THE NEW ENDPOINT NAME: '/nftowner'. IT DOES EXACTLY THE SAME :-) "
            }
          }

          //console.log("xls20_offers_by_nft_owner_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/nftowner/:nftowner', async (request, reply) => {
        try {
          if(!request.params.nftowner) {
            reply.code(400).send('Please provide an NFT owner address. Calls without the NFT Owner Address are not allowed');
          }

         // let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByNftOwner(request.params.nftowner);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              nftowner: request.params.nftowner,
              offers: offers
            }
          }

          //console.log("xls20_offers_by_nft_owner_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/offerowner/:offerowner', async (request, reply) => {
        try {
          if(!request.params.offerowner) {
            reply.code(400).send('Please provide an offer owner account. Calls without offer owner account are not allowed');
          }

          //let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByOfferOwner(request.params.offerowner);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              offerowner: request.params.offerowner,
              offers: offers
            }
          }

          //console.log("xls20_offers_by_offer_owner_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/offerdestination/:offerdestination', async (request, reply) => {
        try {
          if(!request.params.offerdestination) {
            reply.code(400).send('Please provide an offerdestination. Calls without destination are not allowed');
          }

          let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByOfferDestination(request.params.offerdestination);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              offerdestination: request.params.offerdestination,
              offers: offers
            }
          }

          //console.log("xls20_offers_by_destination_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/all/account/:xrplaccount', async (request, reply) => {
        try {
          if(!request.params.xrplaccount) {
            reply.code(400).send('Please provide an xrplaccount. Calls without destination are not allowed');
          }

          let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let offersByOwner = nftStore.findOffersByOfferOwner(request.params.xrplaccount);
          let offersByOwnedNFTs = nftStore.findOffersByNftOwner(request.params.xrplaccount);
          let offersByDestination = nftStore.findOffersByOfferDestination(request.params.xrplaccount);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              xrplaccount: request.params.xrplaccount,
              offers_owned: offersByOwner,
              offers_for_own_nfts: offersByOwnedNFTs,
              offers_as_destination: offersByDestination
            }
          }

          //console.log("xls20_offers_by_destination_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offer/funded/:offerid', async (request, reply) => {
        try {
          if(!request.params.offerid) {
            reply.code(400).send('Please provide an offerid. Calls without offerid are not allowed');
          }

          try {
            let start = Date.now();
            let offer = nftStore.findOfferById(request.params.offerid);

            let returnValue:NftApiReturnObject;

            if(!offer) {
              console.log("no offer found: " + (Date.now()-start) + " ms.");
              returnValue = {
                info: {
                  ledger_index: nftStore.getCurrentLedgerIndex(),
                  ledger_hash: nftStore.getCurrentLedgerHash(),
                  ledger_close: nftStore.getCurrentLedgerCloseTime(),
                  ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
                },
                data: {
                  offerid: request.params.offerid,
                  error: "Offer not found!"
                }
              }
            } else {
              let isFunded = await ledgerSync.isOfferFunded(offer);
              console.log("offer is funded: " + (Date.now()-start) + " ms.");

              returnValue = {
                info: {
                  ledger_index: nftStore.getCurrentLedgerIndex(),
                  ledger_hash: nftStore.getCurrentLedgerHash(),
                  ledger_close: nftStore.getCurrentLedgerCloseTime(),
                  ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
                },
                data: isFunded
              }
            }
            
          } catch(err) {
            reply.code(500).send('Internal Error. Please try again.');
          }
        } catch(err) {
          console.log("error checking funded offers");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.post('/api/v1/xls20-nfts/offers/funded', async (request, reply) => {
        try {
          if(!request.body.offers) {
            reply.code(400).send('Please provide offers in the body. Calls without offers are not allowed');
          }

          try {
            let start = Date.now();
            let offersToCheck:string[] = request.body.offers;

            let offerObjects:NFTokenOffer[] = [];

            for(let i = 0; i < offersToCheck.length; i++) {
              let offer = nftStore.findOfferById(offersToCheck[i]);
              if(offer) {
                offerObjects.push(offer);
              }
            }

            if(offerObjects.length > 20) {
              reply.code(500).send('Too many Offers to check. Max 20 allowed!');
              return;
            }

            let offerPromises:any[] = [];

            for(let i = 0; i < offerObjects.length; i++) {
              offerPromises.push(ledgerSync.isOfferFunded(offerObjects[i]));
            }

            let checkedOffers = await Promise.all(offerPromises);

            console.log("offers are funded: " + (Date.now()-start) + " ms.");
            let returnValue:NftApiReturnObject = {
              info: {
                ledger_index: nftStore.getCurrentLedgerIndex(),
                ledger_hash: nftStore.getCurrentLedgerHash(),
                ledger_close: nftStore.getCurrentLedgerCloseTime(),
                ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
              },
              data: {
                offers: checkedOffers
              }
            }

            return returnValue;
            
          } catch(err) {
            reply.code(500).send('Internal Error. Please try again.');
          }
        } catch(err) {
          console.log("error checking funded offers");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

    done()
}