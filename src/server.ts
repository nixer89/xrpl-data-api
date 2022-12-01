import consoleStamp = require("console-stamp");
import { IssuerAccounts } from './issuerAccounts';
import { LedgerData } from './ledgerData';
import { TokenCreation } from './tokenCreation';
import { AccountNames } from "./accountNames";
import { SelfAssessments } from "./selfAssessments";
import { NftStore } from "./nftokenStore";
import { LedgerSync } from "./syncLedger";
import { TIER_1_LIMIT, TIER_2_LIMIT, TIER_3_LIMIT, TIER_4_LIMIT} from './util/config';

const Redis = require('ioredis')
const redis = new Redis({
  connectionName: 'xrpl-data-api',
  host: '127.0.0.1',
  port: 6379,
  connectTimeout: 500,
  maxRetriesPerRequest: 1
})

let issuerAccount:IssuerAccounts;
let ledgerData:LedgerData;
let tokenCreation:TokenCreation;
let accountNames:AccountNames;
let selfAssessments:SelfAssessments;
let nftStore: NftStore;
let ledgerSync: LedgerSync;


let tier1Limit:string[] = TIER_1_LIMIT.split(',')
let tier2Limit:string [] = TIER_2_LIMIT.split(',')
let tier3Limit:string [] = TIER_3_LIMIT.split(',')
let tier4Limit:string [] = TIER_4_LIMIT.split(',')

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

const fastify = require('fastify')({ trustProxy: true })

console.log("adding response compression");
fastify.register(require('@fastify/compress'), { encodings: ['gzip', 'deflate', 'br', '*', 'identity'] });

console.log("adding some security headers");
fastify.register(require('@fastify/helmet'));

let kycCounter:number = 0;

// Run the server!
const start = async () => {

  issuerAccount = IssuerAccounts.Instance;
  ledgerData = LedgerData.Instance;
  tokenCreation = TokenCreation.Instance;
  accountNames = AccountNames.Instance;
  selfAssessments = SelfAssessments.Instance;
  nftStore = NftStore.Instance;
  ledgerSync = LedgerSync.Instance;

    console.log("starting server");
    try {
      await accountNames.init();
      await tokenCreation.init();
      await issuerAccount.init();
      await ledgerData.init();
      await selfAssessments.init();

      //sync back to current ledger
      await ledgerSync.start();

      //init routes
      console.log("adding cors");

      fastify.register(require('@fastify/cors'), {
        origin: "*",
        methods: 'GET, OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'Referer']
      });

      await fastify.register(require('@fastify/rate-limit'), {
        global: true,
        redis: redis,
        skipOnError: true,
        max: async (req, key) => {
          let limit = 10;

          for(let i = 0; i < tier1Limit.length; i++) {
            if(key.startsWith(tier1Limit[i])) {
              limit = 60;
              break;
            }
          }

          for(let i = 0; i < tier2Limit.length; i++) {
            if(key.startsWith(tier2Limit[i])) {
              limit = 300;
              break;
            }
          }

          for(let i = 0; i < tier3Limit.length; i++) {
            if(key.startsWith(tier3Limit[i])) {
              limit = 600;
              break;
            }
          }

          for(let i = 0; i < tier4Limit.length; i++) {
            if(key.startsWith(tier4Limit[i])) {
              limit = 1200;
              break;
            }
          }

          return limit;
        },
        timeWindow: '1 minute',
        keyGenerator: function(req) {
          return req.headers['x-real-ip'] // nginx
          || req.headers['x-client-ip'] // apache
          || req.headers['x-forwarded-for'] // use this only if you trust the header
          || req.ip // fallback to default
        }
      });

      await fastify.setErrorHandler(function (error, req, reply) {
        if (reply.statusCode === 429) {
  
          let ip = req.headers['x-real-ip'] // nginx
                || req.headers['x-client-ip'] // apache
                || req.headers['x-forwarded-for'] // use this only if you trust the header
                || req.ip // fallback to default
  
          console.log("RATE LIMIT HIT BY: " + ip + " from " + req.hostname + " to: " + req.routerPath);
          
          error.message = 'You are sending too many requests in a short period of time. Please calm down and try again later :-)'
        }
        reply.send(error)
      });

      fastify.get('/api/v1/tokens', async (request, reply) => {
        try {
          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let issuers = issuerAccount.getLedgerTokensV1();

          let returnValue = {
            ledger_index: issuerAccount.getLedgerIndex(),
            ledger_hash: issuerAccount.getLedgerHash(),
            ledger_close: issuerAccount.getLedgerCloseTime(),
            ledger_close_ms: issuerAccount.getLedgerCloseTimeMs(),
            issuers: issuers
          }

          console.log("tokens_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving tokens");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/nfts', async (request, reply) => {
        try {
          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let issuers = issuerAccount.getLedgerNftsV1();

          let returnValue = {
            ledger_index: issuerAccount.getLedgerIndex(),
            ledger_hash: issuerAccount.getLedgerHash(),
            ledger_close: issuerAccount.getLedgerCloseTime(),
            ledger_close_ms: issuerAccount.getLedgerCloseTimeMs(),
            issuers: issuers
          }

          console.log("nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts', async (request, reply) => {
        try {
          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.getAllNfts();

          let returnValue = {
            ledger_index: nftStore.getCurrentLedgerIndex(),
            ledger_hash: nftStore.getCurrentLedgerHash(),
            ledger_close: nftStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs(),
            nfts: nftIssuers.nfts
          }

          console.log("xls20_nfts_"+request.hostname + ": " + (Date.now()-start) + " ms")

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.findNftsByIssuer(request.params.issuer);

          let returnValue = {
            ledger_index: nftStore.getCurrentLedgerIndex(),
            ledger_hash: nftStore.getCurrentLedgerHash(),
            ledger_close: nftStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs(),
          }

          returnValue[request.params.issuer] = nftIssuers;

          console.log("xls20_nfts_by_issuer"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by issuer");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/issuer/:issuer/taxon/:taxon', async (request, reply) => {
        try {
          if(!request.params.issuer || !request.params.taxon) {
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.findNftsByIssuerAndTaxon(request.params.issuer, request.params.taxon);

          let returnValue = {
            ledger_index: nftStore.getCurrentLedgerIndex(),
            ledger_hash: nftStore.getCurrentLedgerHash(),
            ledger_close: nftStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs(),
          }

          returnValue[request.params.issuer] = nftIssuers;

          console.log("xls20_nfts_by_issuer_and_taxon"+request.hostname + ": " + (Date.now()-start) + " ms")

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let taxons = nftStore.findTaxonsByIssuer(request.params.issuer);

          let returnValue = {
            ledger_index: nftStore.getCurrentLedgerIndex(),
            ledger_hash: nftStore.getCurrentLedgerHash(),
            ledger_close: nftStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs(),
          }

          returnValue[request.params.issuer] = taxons;

          console.log("xls20_nfts_by_issuer_and_taxon"+request.hostname + ": " + (Date.now()-start) + " ms")

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

          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nft = nftStore.findNftokenById(request.params.nftokenid);

          let returnValue = {
            ledger_index: nftStore.getCurrentLedgerIndex(),
            ledger_hash: nftStore.getCurrentLedgerHash(),
            ledger_close: nftStore.getCurrentLedgerCloseTime(),
            ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs(),
            nft: nft
          }

          console.log("xls20_nfts_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by nftokenid");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/ledgerdata', async (request, reply) => {
        try {
          console.time("ledgerdata");
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

          console.timeEnd("ledgerdata");

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
              kycCounter++;

              if(kycCounter%1000 == 0)
                console.log("KYC: " + kycCounter);

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

          console.time("tokencreation");
          //console.log("query: " + JSON.stringify(request.query));
          let issuer:string = request.query.issuer;
          let currency:string = request.query.currency;

          let returnValue = await tokenCreation.getTokenCreationDate(issuer, currency);

          console.timeEnd("tokencreation");

          return returnValue;
        } catch(err) {
          console.log("error resolving token creation");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });
      
    console.log("declaring 200er reponse")
    fastify.get('/api', async (request, reply) => {
      reply.code(200).send('I am alive!'); 
    });

    try {
      await fastify.listen({ port: 4002, host: '0.0.0.0' });

      console.log("http://0.0.0.0:4002/");

      fastify.ready(err => {
        if (err) throw err
      });
    } catch(err) {
      console.log('Error starting server:', err)
    }    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

console.log("running server");
start();