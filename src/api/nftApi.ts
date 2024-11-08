import { NftStore } from "../nftokenStore";
import { NftApiReturnObject } from "../util/types";

let nftStore: NftStore = NftStore.Instance;

export async function registerRoutes(fastify, opts, done) {

    fastify.get('/api/v1/xls20-nfts/all/issuers', async (request, reply) => {
        try {
          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));

          let allIssuers = nftStore.getAllIssuers();

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(limit) {

              if(!skip)
                skip = 0;

              allIssuers = allIssuers.slice(skip, skip+limit);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuers: allIssuers
            }
          }

          //console.log("xls20_nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.get('/api/v1/xls20-nfts/issuer/:issuer', async (request, reply) => {
        try {
          if(!request.params.issuer) {
            reply.code(400).send('Please provide an issuer. Calls without issuer are not allowed');
          }

          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.findNftsByIssuer(request.params.issuer);

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(nftIssuers.length > 500_000 && (!limit || limit > 500_000)) {
              limit = 500_000;
            }

            if(limit) {
              let origLength = nftIssuers.length;

              if(!skip)
                skip = 0;
  
              nftIssuers = nftIssuers.slice(skip, skip+limit);

              reply.header('x-total-count', origLength);
              reply.header('x-last-index-returned', skip+limit);
              reply.header('x-max-limit', 500_000);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuer: request.params.issuer,
              nfts: nftIssuers
            }
          }

          console.log("xls20_nfts_by_issuer"+request.hostname + ": " + (Date.now()-start) + " ms")

          reply.code(200).send(returnValue);

        } catch(err) {
          console.log("error resolving nfts by issuer");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.get('/api/v1/xls20-nfts/issuer/:issuer/taxon/:taxon', async (request, reply) => {
        try {
          if(!request.params.issuer || !request.params.taxon) {
            reply.code(400).send('Please provide an issuer and taxon. Calls without issuer and taxon are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.findNftsByIssuerAndTaxon(request.params.issuer, request.params.taxon);

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(limit) {

              if(!skip)
                skip = 0;
  
                nftIssuers = nftIssuers.slice(skip, skip+limit);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

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
              nfts: nftIssuers
            }
          }

          //console.log("xls20_nfts_by_issuer_and_taxon"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by issuer and taxon");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.get('/api/v1/xls20-nfts/taxon/:issuer', async (request, reply) => {
        try {
          if(!request.params.issuer) {
            reply.code(400).send('Please provide an issuer. Calls without issuer are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let taxons = nftStore.findTaxonsByIssuer(request.params.issuer);

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(limit) {

              if(!skip)
                skip = 0;
  
                taxons = taxons.slice(skip, skip+limit);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuer: request.params.issuer,
              taxons: taxons
            }
          }

          //console.log("xls20_nfts_by_issuer_and_taxon"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving taxons by issuer");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.get('/api/v1/xls20-nfts/nft/:nftokenid', async (request, reply) => {
        try {
          if(!request.params.nftokenid) {
            reply.code(400).send('Please provide a nftokenid. Calls without nftokenid are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nft = nftStore.findNftokenById(request.params.nftokenid);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              nftokenid: request.params.nftokenid,
              nft: nft
            }
          }

          //console.log("xls20_nfts_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by nftokenid");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.get('/api/v1/xls20-nfts/owner/:owner', async (request, reply) => {
        try {
          if(!request.params.owner) {
            reply.code(400).send('Please provide an owner. Calls without owner are not allowed');
          }

          //let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let nftsOwner = nftStore.findNFTsByOwner(request.params.owner);

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(limit) {

              if(!skip)
                skip = 0;
  
                nftsOwner = nftsOwner.slice(skip, skip+limit);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              owner: request.params.owner,
              nfts: nftsOwner
            }
          }

          //console.log("xls20_nfts_by_owner_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.post('/api/v1/xls20-nfts/uri', async (request, reply) => {
      try {
        if(!request.body.uri) {
          reply.code(400).send('Please provide a uri. Calls without uri are not allowed');
        }

        if(!isHex(request.body.uri)) {
          reply.code(400).send('Invalid URI. Only HEX is allowed.');
        }

        //let start = Date.now();
        //console.log("request params: " + JSON.stringify(request.params));
        let nftsArray = nftStore.findNftokenByUri(request.body.uri);

        //check limit and skip
        try {
          let limit:number = Number(request.query.limit);
          let skip:number = Number(request.query.skip);

          if(limit) {

            if(!skip)
              skip = 0;

              nftsArray = nftsArray.slice(skip, skip+limit);
          }

        } catch(err) {
          console.log(err);
          //do nothing more if it fails
        }

        let returnValue:NftApiReturnObject = {
          info: {
            ledger_index: nftStore.getCurrentLedgerIndex(),
            ledger_hash: nftStore.getCurrentLedgerHash(),
            ledger_close: nftStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
          },
          data: {
            uri: request.body.uri,
            nfts: nftsArray
          }
        }

        //console.log("xls20_nfts_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

        return returnValue;
      } catch(err) {
        console.log("error resolving nfts by nftokenid");
        console.log(err);
        reply.code(500).send('Error occured. Please check your request.');
      }
  });

  done()
}

function isHex(string: string): boolean {
  return string && /^[0-9A-Fa-f]*$/.test(string);
}