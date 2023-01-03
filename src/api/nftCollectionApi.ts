import { NftStore } from "../nftokenStore";
import { NftApiReturnObject } from "../util/types";

let nftStore: NftStore = NftStore.Instance;

export async function registerRoutes(fastify, opts, done) {

    fastify.get('/api/v1/xls20-nfts/collection/info/issuer/:issuer', async (request, reply) => {
        try {
          if(!request.params.issuer) {
            reply.code(400).send('Please provide an issuer. Calls without issuer are not allowed');
          }

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let collectionInfo = nftStore.getCollectionInfo(request.params.issuer, null);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              issuer: request.params.issuer,
              collection_info: collectionInfo
            }
          }

          //console.log("xls20_offers_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving collection info by issuer");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
    });

    fastify.get('/api/v1/xls20-nfts/collection/info/issuer/:issuer/taxon/:taxon', async (request, reply) => {
      try {
        if(!request.params.issuer || !request.params.taxon) {
          reply.code(400).send('Please provide an issuer and taxon. Calls without issuer and taxon are not allowed');
        }

        //let start = Date.now();
        //console.log("request params: " + JSON.stringify(request.params));
        let collectionInfo = nftStore.getCollectionInfo(request.params.issuer, request.params.taxon);

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
            collection_info: collectionInfo
          }
        }

        //console.log("xls20_offers_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

        return returnValue;
      } catch(err) {
        console.log("error resolving collection info by issuer and taxon");
        console.log(err);
        reply.code(500).send('Error occured. Please check your request.');
      }
    });

    done()
}