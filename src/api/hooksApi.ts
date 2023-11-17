import { HookData } from "../hookData";

let hooksData: HookData = HookData.Instance;

export async function registerRoutes(fastify, opts, done) {

  fastify.get('/api/v1/hook/hooks', async (request, reply) => {
    try {
      //let start = Date.now();
      //console.log("request params: " + JSON.stringify(request.params));

      let allHooks = hooksData.getHooks();

      //check limit and skip
      try {
        let limit:number = Number(request.query.limit);
        let skip:number = Number(request.query.skip);

        if(limit) {

          if(!skip)
            skip = 0;

            allHooks = allHooks.slice(skip, skip+limit);
        }

      } catch(err) {
        console.log(err);
        //do nothing more if it fails
      }

      let returnValue = {
        info: {
          ledger_index: hooksData.getCurrentLedgerIndex(),
          ledger_hash: hooksData.getCurrentLedgerHash(),
          ledger_close: hooksData.getCurrentLedgerCloseTime(),
          ledger_close_ms: hooksData.getCurrentLedgerCloseTimeMs()
        },
        data: {
          hooks: allHooks
        }
      }

      //console.log("xls20_nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

      return returnValue;
    } catch(err) {
      console.log("error resolving hook data");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  fastify.get('/api/v1/hook/hookdefinitions', async (request, reply) => {
    try {
      //let start = Date.now();
      //console.log("request params: " + JSON.stringify(request.params));

      let allHookDefinitions = hooksData.getHookDefinitions();

      //check limit and skip
      try {
        let limit:number = Number(request.query.limit);
        let skip:number = Number(request.query.skip);

        if(limit) {

          if(!skip)
            skip = 0;

            allHookDefinitions = allHookDefinitions.slice(skip, skip+limit);
        }

      } catch(err) {
        console.log(err);
        //do nothing more if it fails
      }

      let returnValue = {
        info: {
          ledger_index: hooksData.getCurrentLedgerIndex(),
          ledger_hash: hooksData.getCurrentLedgerHash(),
          ledger_close: hooksData.getCurrentLedgerCloseTime(),
          ledger_close_ms: hooksData.getCurrentLedgerCloseTimeMs()
        },
        data: {
          hookdefinitions: allHookDefinitions
        }
      }

      //console.log("xls20_nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

      return returnValue;
    } catch(err) {
      console.log("error resolving hook data");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  fastify.get('/api/v1/hook/hookstates', async (request, reply) => {
    try {
      //let start = Date.now();
      //console.log("request params: " + JSON.stringify(request.params));

      let allHookStates = hooksData.getHookStates();

      //check limit and skip
      try {
        let limit:number = Number(request.query.limit);
        let skip:number = Number(request.query.skip);

        if(limit) {

          if(!skip)
            skip = 0;

            allHookStates = allHookStates.slice(skip, skip+limit);
        }

      } catch(err) {
        console.log(err);
        //do nothing more if it fails
      }

      let returnValue = {
        info: {
          ledger_index: hooksData.getCurrentLedgerIndex(),
          ledger_hash: hooksData.getCurrentLedgerHash(),
          ledger_close: hooksData.getCurrentLedgerCloseTime(),
          ledger_close_ms: hooksData.getCurrentLedgerCloseTimeMs()
        },
        data: {
          hookstates: allHookStates
        }
      }

      //console.log("xls20_nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

      return returnValue;
    } catch(err) {
      console.log("error resolving hook data");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  done()
}
