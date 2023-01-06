import { AccountNames } from "../accountNames";
import { IssuerAccounts } from "../issuerAccounts";
import { LedgerData } from "../ledgerData";
import { TokenCreation } from "../tokenCreation";

let issuerAccount:IssuerAccounts = IssuerAccounts.Instance;
let ledgerData:LedgerData = LedgerData.Instance;
let accountNames:AccountNames = AccountNames.Instance;
let tokenCreation:TokenCreation = TokenCreation.Instance;

export async function registerRoutes(fastify, opts, done) {

  fastify.get('/api/v1/tokens', async (request, reply) => {
    try {
      //let start = Date.now();
      //console.log("request params: " + JSON.stringify(request.params));
      let issuers = issuerAccount.getLedgerTokensV1();

      let returnValue = {
        ledger_index: issuerAccount.getLedgerIndex(),
        ledger_hash: issuerAccount.getLedgerHash(),
        ledger_close: issuerAccount.getLedgerCloseTime(),
        ledger_close_ms: issuerAccount.getLedgerCloseTimeMs(),
        issuers: issuers
      }

      //console.log("tokens_"+request.hostname + ": " + (Date.now()-start) + " ms")

      return returnValue;
    } catch(err) {
      console.log("error resolving tokens");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  fastify.get('/api/v1/nfts', async (request, reply) => {
    try {
      //let start = Date.now();
      //console.log("request params: " + JSON.stringify(request.params));
      let issuers = issuerAccount.getLedgerNftsV1();

      let returnValue = {
        ledger_index: issuerAccount.getLedgerIndex(),
        ledger_hash: issuerAccount.getLedgerHash(),
        ledger_close: issuerAccount.getLedgerCloseTime(),
        ledger_close_ms: issuerAccount.getLedgerCloseTimeMs(),
        issuers: issuers
      }

      //console.log("nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

      return returnValue;
    } catch(err) {
      console.log("error resolving nfts");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  fastify.get('/api/v1/ledgerdata', async (request, reply) => {
    try {
      //console.time("ledgerdata");
      let ledgerDataObjects: any[] = await ledgerData.getLedgerDataV1();
      //console.log("ledgerDataObjects: " + JSON.stringify(ledgerDataObjects));

      let returnValue = {
        ledger_index: issuerAccount.getLedgerIndex(),
        ledger_hash: issuerAccount.getLedgerHash(),
        ledger_close: issuerAccount.getLedgerCloseTime(),
        ledger_close_ms: issuerAccount.getLedgerCloseTimeMs(),
        ledger_size: ledgerDataObjects[0],
        sizeType: "B",
        ledger_data: ledgerDataObjects[1]
      }

      //console.timeEnd("ledgerdata");

      return returnValue;
    } catch(err) {
      console.log("error resolving ledgerdata");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  fastify.get('/api/v1/kyc/:account', async (request, reply) => {
    if(!request.params.account) {
      reply.code(200).send('Please provide an account. Calls without account are not allowed');
  } else {
      try {
          //console.time("kyc");
          let returnValue = {
            account: request.params.account,
            kyc: accountNames.getKycData(request.params.account)
          }
          //console.timeEnd("kyc");

          return returnValue;
      } catch(err) {
        console.log("error resolving kyc");
        console.log(err);
        reply.code(500).send('Error occured. Please check your request.');
      }
  }
  });

  fastify.get('/api/v1/tokencreation', async (request, reply) => {

    try {
      //console.time("tokencreation");
      //console.log("query: " + JSON.stringify(request.query));
      let issuer:string = request.query.issuer;
      let currency:string = request.query.currency;

      let returnValue = await tokenCreation.getTokenCreationDate(issuer, currency);

      //console.timeEnd("tokencreation");

      return returnValue;
    } catch(err) {
      console.log("error resolving token creation");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

    done()
}