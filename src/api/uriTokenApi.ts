import { UriTokenStore } from "../uriTokenStore";
import { UriTokenApiReturnObject } from "../util/types";

let uirTokenStore: UriTokenStore = UriTokenStore.Instance;

export async function registerRoutes(fastify, opts, done) {

    fastify.get('/api/v1/uritoken/all/issuers', async (request, reply) => {
        try {
          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));

          let allIssuers = uirTokenStore.getAllIssuers();

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

          let returnValue:UriTokenApiReturnObject = {
            info: {
              ledger_index: uirTokenStore.getCurrentLedgerIndex(),
              ledger_hash: uirTokenStore.getCurrentLedgerHash(),
              ledger_close: uirTokenStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: uirTokenStore.getCurrentLedgerCloseTimeMs()
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

    fastify.get('/api/v1/uritoken/issuer/:issuer', async (request, reply) => {
        try {
          if(!request.params.issuer) {
            reply.code(400).send('Please provide an issuer. Calls without issuer are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let uriTokensByIssuer = uirTokenStore.findUriTokenByIssuer(request.params.issuer);

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(limit) {

              if(!skip)
                skip = 0;
  
                uriTokensByIssuer = uriTokensByIssuer.slice(skip, skip+limit);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

          let returnValue:UriTokenApiReturnObject = {
            info: {
              ledger_index: uirTokenStore.getCurrentLedgerIndex(),
              ledger_hash: uirTokenStore.getCurrentLedgerHash(),
              ledger_close: uirTokenStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: uirTokenStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuer: request.params.issuer,
              uritokens: uriTokensByIssuer
            }
          }

          //console.log("xls20_nfts_by_issuer"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by issuer");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });  

    fastify.get('/api/v1/uritoken/uritokenid/:uritokenid', async (request, reply) => {
        try {
          if(!request.params.uritokenid) {
            reply.code(400).send('Please provide a uritokenid. Calls without uritokenid are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let uritoken = uirTokenStore.findUriTokenById(request.params.uritokenid);

          let returnValue:UriTokenApiReturnObject = {
            info: {
              ledger_index: uirTokenStore.getCurrentLedgerIndex(),
              ledger_hash: uirTokenStore.getCurrentLedgerHash(),
              ledger_close: uirTokenStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: uirTokenStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              uritokenid: request.params.uritokenid,
              uritoken: uritoken
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

    fastify.get('/api/v1/uritoken/owner/:owner', async (request, reply) => {
        try {
          if(!request.params.owner) {
            reply.code(400).send('Please provide an owner. Calls without owner are not allowed');
          }

          //let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let uriTokenByOwner = uirTokenStore.findUriTokensByOwner(request.params.owner);

          //check limit and skip
          try {
            let limit:number = Number(request.query.limit);
            let skip:number = Number(request.query.skip);

            if(limit) {

              if(!skip)
                skip = 0;
  
                uriTokenByOwner = uriTokenByOwner.slice(skip, skip+limit);
            }

          } catch(err) {
            console.log(err);
            //do nothing more if it fails
          }

          let returnValue:UriTokenApiReturnObject = {
            info: {
              ledger_index: uirTokenStore.getCurrentLedgerIndex(),
              ledger_hash: uirTokenStore.getCurrentLedgerHash(),
              ledger_close: uirTokenStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: uirTokenStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              owner: request.params.owner,
              uritokens: uriTokenByOwner
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

    fastify.post('/api/v1/uritoken/uri', async (request, reply) => {
      try {
        if(!request.body.uri) {
          reply.code(400).send('Please provide a uri. Calls without uri are not allowed');
        }

        if(!isHex(request.body.uri)) {
          reply.code(400).send('Invalid URI. Only HEX is allowed.');
        }

        //let start = Date.now();
        //console.log("request params: " + JSON.stringify(request.params));
        let uriTokensByUri = uirTokenStore.findUriTokensByUri(request.body.uri);

        //check limit and skip
        try {
          let limit:number = Number(request.query.limit);
          let skip:number = Number(request.query.skip);

          if(limit) {

            if(!skip)
              skip = 0;

              uriTokensByUri = uriTokensByUri.slice(skip, skip+limit);
          }

        } catch(err) {
          console.log(err);
          //do nothing more if it fails
        }

        let returnValue:UriTokenApiReturnObject = {
          info: {
            ledger_index: uirTokenStore.getCurrentLedgerIndex(),
            ledger_hash: uirTokenStore.getCurrentLedgerHash(),
            ledger_close: uirTokenStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: uirTokenStore.getCurrentLedgerCloseTimeMs()
          },
          data: {
            uri: request.body.uri,
            uritokens: uriTokensByUri
          }
        }

        //console.log("xls20_nfts_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

        return returnValue;
      } catch(err) {
        console.log("error resolving uritokens by URI");
        console.log(err);
        reply.code(500).send('Error occured. Please check your request.');
      }
  });

  done()
}

function isHex(string: string): boolean {
  return string && /^[0-9A-Fa-f]*$/.test(string);
}