import { AccountNames } from "../accountNames";
import { IssuerAccounts } from "../issuerAccounts";
import { LedgerData } from "../ledgerData";
import { NftStore } from "../nftokenStore";
import { SupplyInfo } from "../supplyInfo";
import { TokenCreation } from "../tokenCreation";
import { SupplyInfoType } from "../util/types";
import { WHITELIST_IP } from '../util/config';

const pm2Lib = require('pm2')

let issuerAccount:IssuerAccounts = IssuerAccounts.Instance;
let ledgerData:LedgerData = LedgerData.Instance;
let accountNames:AccountNames = AccountNames.Instance;
let tokenCreation:TokenCreation = TokenCreation.Instance;
let nftStore: NftStore = NftStore.Instance;
let supplyInfo: SupplyInfo = SupplyInfo.Instance;

export async function registerRoutes(fastify, opts, done) {

  console.log("declaring 200er reponse")
    fastify.get('/api', { config: {
      rateLimit: {
        timeWindow: '1 minute',
        max: 60,
        keyGenerator: function(req) {
          return req.headers['x-api-key']
          || req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
          || req.headers['x-real-ip'] // nginx
          || req.headers['x-client-ip'] // apache
          || req.headers['x-forwarded-for'] // use this only if you trust the header
          || req.ip // fallback to default
        }
      }
    }
  }, async (request, reply) => {
      let diff = -1;
      try {
        let currentLedgerCloseTimeMs = nftStore.getCurrentLedgerCloseTimeMs();
        let currentTimeMs = Date.now();
        diff = currentTimeMs - (currentLedgerCloseTimeMs ? (currentLedgerCloseTimeMs+946684800)*1000 : 0) ;
        let pm2Instance:number = process.env.PM2_INSTANCE_ID ? parseInt(process.env.PM2_INSTANCE_ID) : 0;
        //console.log("diff: " + diff);

        if(diff > -4000 && diff < 15000) { //difference should not be more than 5 seconds!
          reply.code(200).send('I am in sync!');
        } else {
          console.log("NO SYNC DIFF: " + diff);
          reply.code((400+pm2Instance)).send('I am NOT in sync!');
          try {
            console.log("RELOADING!")
            pm2Lib.connect(err => {
              console.log("PM CONNECTED");
              pm2Lib.list((err,list) => {
                console.log(list);
              });
              pm2Lib.reload(process.env.PM2_INSTANCE_ID, (err) => {
                if(err) {
                  console.log(err);
                  process.exit(1);
                } else {
                  "PM2 RELOAD UNDER WAY"
                }
              });
            });
          } catch(err) {
            console.log(err);
            process.exit(1);
          }
        }
      } catch(err) {
        console.log("ERROR DIFF: " + diff);
        reply.code(500).send('Some error happened!');
        try {
          console.log("RELOADING!")
          pm2Lib.connect(false, err => {

            if(err) {
              console.log(err);
            } else {
              console.log("PM CONNECTED");
              pm2Lib.list((err,list) => {
                console.log(list);
              });
              pm2Lib.reload(process.env.PM2_INSTANCE_ID, (err) => {
                if(err) {
                  console.log(err);
                  process.exit(1);
                } else {
                  "PM2 RELOAD UNDER WAY"
                }
              });
            }
          });
        } catch(err) {
          console.log(err);
          process.exit(1);
        }
      }
  });

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

  fastify.get('/api/v1/supply_info', async (request, reply) => {
    try {

      let callIP = request.headers['x-api-key']
      || request.headers['cf-connecting-ip'] // cloudflare originally connecting IP
      || request.headers['x-real-ip'] // nginx
      || request.headers['x-client-ip'] // apache
      || request.headers['x-forwarded-for'] // use this only if you trust the header
      || request.ip // fallback to default

      console.log("supply info call IP: " + callIP);

      if(WHITELIST_IP === callIP) {

        let supplyInfoResponse:SupplyInfoType = supplyInfo.getSupplyInfo();

        if(supplyInfoResponse) {
          return supplyInfoResponse
        } else {
          return null;
        }
      } else {
        reply.code(404).send({"message":"Route GET:/api/v1/supply_info not found","error":"Not Found","statusCode":404});
      }

      //console.timeEnd("ledgerdata");

    } catch(err) {
      console.log("error getting supply info");
      console.log(err);
      reply.code(500).send('Error occured. Please check your request.');
    }
  });

  done()
}