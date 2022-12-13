import consoleStamp = require("console-stamp");
import { IssuerAccounts } from './issuerAccounts';
import { LedgerData } from './ledgerData';
import { TokenCreation } from './tokenCreation';
import { AccountNames } from "./accountNames";
import { SelfAssessments } from "./selfAssessments";
import { NftStore } from "./nftokenStore";
import { LedgerSync } from "./syncLedger";
import * as fs from 'fs';
import { NftApiReturnObject } from "./util/types";
import fastifySwagger from "@fastify/swagger";
import Helmet from '@fastify/helmet';

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


let tier1LimitIps:string[] = loadIps("tier1");
let tier2LimitIps:string [] = loadIps("tier2");
let tier3LimitIps:string [] = loadIps("tier3");
let tier4LimitIps:string [] = loadIps("tier4");

let tier1LimitKeys:string[] = loadKeys("tier1");
let tier2LimitKeys:string [] = loadKeys("tier2");
let tier3LimitKeys:string [] = loadKeys("tier3");
let tier4LimitKeys:string [] = loadKeys("tier4");

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

const fastify = require('fastify')({ trustProxy: true })

console.log("adding response compression");
fastify.register(require('@fastify/compress'), { encodings: ['gzip', 'deflate', 'br', '*', 'identity'] });



let kycCounter:number = 0;
let allIssuersCounter:number = 0;
let taxonByIssuerCounter:number = 0;
let nftsByIssuerCounter:number = 0;
let nftsByIssuerAndTaxonCounter:number = 0;
let nftDetailsCounter:number = 0;
let nftsByOwnerCounter:number = 0;
let ledgerDataCounter:number = 0;
let tokenCounter:number = 0;
let tokenCreationCounter:number = 0;
let xls14NftCounter:number = 0;
let offerIdCounter:number = 0;
let offerNftCounter:number = 0;
let offerIssuerCounter:number = 0;
let offersByIssuerAndTaxonCounter:number = 0;
let offersByOwnerCounter:number = 0;

// Run the server!
const start = async () => {

  const data:any = fs.readFileSync('./open-api-spec/xrpl-data-api.json', 'utf8').toString();

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
      await ledgerSync.start(0);

      //init routes
      console.log("adding cors");

      fastify.register(require('@fastify/cors'), {
        origin: "*",
        methods: 'GET, OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'Referer']
      });

      console.log("register swagger docs...")
      await fastify.register(fastifySwagger, {
        mode: 'static',
        specification: {
          document: JSON.parse(data)
        },
        routePrefix: '/docs',
        exposeRoute: true,
        staticCSP: true,
        uiConfig: {
          defaultModelsExpandDepth: -1
        }
      });

      fastify.register(Helmet, instance => {
        return {
          crossOriginEmbedderPolicy: false,
          contentSecurityPolicy: {
            directives: {
              ...Helmet.contentSecurityPolicy.getDefaultDirectives(),
              "form-action": ["'self'"],
              "img-src": ["'self'", "data:", "validator.swagger.io"],
              "script-src": ["'self'"].concat(instance.swaggerCSP.script),
              "style-src": ["'self'", "https:"].concat(instance.swaggerCSP.style)
            }
          }
        }
      })

      await fastify.register(require('@fastify/rate-limit'), {
        global: true,
        redis: redis,
        skipOnError: true,
        max: async (req, key) => {
          let limit = 10;

          for(let i = 0; i < tier1LimitIps.length; i++) {
            if(tier1LimitIps[i] != null && tier1LimitIps[i].length > 0 && key.startsWith(tier1LimitIps[i])) {
              limit = 60;
              i = tier1LimitIps.length;
            }
          }

          if(tier1LimitKeys != null && tier1LimitKeys.includes(key)) {
            limit = 60;
          }

          for(let j = 0; j < tier2LimitIps.length; j++) {
            if(tier2LimitIps[j] != null && tier2LimitIps[j].length > 0 && key.startsWith(tier2LimitIps[j])) {
              limit = 300;
              j = tier2LimitIps.length;
            }
          }

          if(tier2LimitKeys != null && tier2LimitKeys.includes(key)) {
            limit = 300;
          }

          for(let k = 0; k < tier3LimitIps.length; k++) {
            if(tier3LimitIps[k] != null && tier3LimitIps[k].length > 0 && key.startsWith(tier3LimitIps[k])) {
              limit = 600;
              k = tier3LimitIps.length;
            }
          }

          if(tier3LimitKeys != null && tier3LimitKeys.includes(key)) {
            limit = 600;
          }

          for(let l = 0; l < tier4LimitIps.length; l++) {
            if(tier4LimitIps[l] != null && tier4LimitIps[l].length > 0 && key.startsWith(tier4LimitIps[l])) {
              limit = 1200;
              l = tier4LimitIps.length;
            }
          }

          if(tier4LimitKeys != null && tier4LimitKeys.includes(key)) {
            limit = 1200;
          }

          if(limit > 10)
            console.log("limit: " + limit + " for key: " + key);

          return limit;
        },
        timeWindow: '1 minute',
        keyGenerator: function(req) {
          return req.headers['x-api-key']
          || req.headers['x-real-ip'] // nginx
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
          
          error.message = 'You are sending too many requests in a short period of time. Please calm down and try again later or contact us to request elevated limits: @XrplServices (on twitter)'
        }
        reply.send(error)
      });

      fastify.get('/api/v1/tokens', async (request, reply) => {
        try {
          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          tokenCounter++;

          if(tokenCounter%1000 == 0)
            console.log("tokenCounter: " + tokenCounter);

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
          xls14NftCounter++;

          if(xls14NftCounter%1000 == 0)
            console.log("xls14NftCounter: " + xls14NftCounter);

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

      fastify.get('/api/v1/xls20-nfts/all/issuers', async (request, reply) => {
        try {
          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));

          allIssuersCounter++;

          if(allIssuersCounter%1000 == 0)
            console.log("allNftsCounter: " + allIssuersCounter);

          let allIssuers = nftStore.getAllIssuers();

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          nftsByIssuerCounter++;

          if(nftsByIssuerCounter%1000 == 0)
            console.log("nftsByIssuerCounter: " + nftsByIssuerCounter);

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.findNftsByIssuer(request.params.issuer);

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

          //console.log("xls20_nfts_by_issuer"+request.hostname + ": " + (Date.now()-start) + " ms")

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

          nftsByIssuerAndTaxonCounter++;

          if(nftsByIssuerAndTaxonCounter%1000 == 0)
            console.log("nftsByIssuerAndTaxonCounter: " + nftsByIssuerAndTaxonCounter);

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let nftIssuers = nftStore.findNftsByIssuerAndTaxon(request.params.issuer, request.params.taxon);

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          taxonByIssuerCounter++;

          if(taxonByIssuerCounter%1000 == 0)
            console.log("taxonByIssuerCounter: " + taxonByIssuerCounter);

          //let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let taxons = nftStore.findTaxonsByIssuer(request.params.issuer);

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

          nftDetailsCounter++;

          if(nftDetailsCounter%1000 == 0)
            console.log("nftDetailsCounter: " + nftDetailsCounter);

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          nftsByOwnerCounter++;

          if(nftsByOwnerCounter%1000 == 0)
            console.log("nftsByOwnerCounter: " + nftsByOwnerCounter);

          let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let nftsOwner = nftStore.findNFtsByOwner(request.params.owner);

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

          console.log("xls20_nfts_by_owner_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/nft/:nftokenid', async (request, reply) => {
        try {
          if(!request.params.nftokenid) {
            reply.code(400).send('Please provide a nftokenid. Calls without nftokenid are not allowed');
          }

          offerNftCounter++;

          if(offerNftCounter%1000 == 0)
            console.log("offerNftCounter: " + offerNftCounter);

          let start = Date.now();
          //console.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByNft(request.params.nftokenid);

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

          console.log("xls20_offers_by_nftokenid"+request.hostname + ": " + (Date.now()-start) + " ms")

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
            reply.code(400).send('Please provide a offerid. Calls without offerid are not allowed');
          }

          offerIdCounter++;

          if(offerIdCounter%1000 == 0)
            console.log("offerIdCounter: " + offerIdCounter);

          let start = Date.now();
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

          console.log("xls20_offer_by_offerid"+request.hostname + ": " + (Date.now()-start) + " ms")

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          offerIssuerCounter++;

          if(offerIssuerCounter%1000 == 0)
            console.log("offerIssuerCounter: " + offerIssuerCounter);

          let start = Date.now();
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

          console.log("xls20_offers_by_issuer"+request.hostname + ": " + (Date.now()-start) + " ms")

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
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          offersByIssuerAndTaxonCounter++;

          if(offersByIssuerAndTaxonCounter%1000 == 0)
            console.log("offersByIssuerAndTaxonCounter: " + offersByIssuerAndTaxonCounter);

          let start = Date.now();
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

          console.log("xls20_offers_by_issuer_and_taxon"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by issuer and taxon");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/xls20-nfts/offers/owner/:owner', async (request, reply) => {
        try {
          if(!request.params.owner) {
            reply.code(400).send('Please provide a issuer. Calls without issuer are not allowed');
          }

          offersByOwnerCounter++;

          if(offersByOwnerCounter%1000 == 0)
            console.log("offersByOwnerCounter: " + offersByOwnerCounter);

          let start = Date.now();
          //onsole.log("request params: " + JSON.stringify(request.params));
          let offers = nftStore.findOffersByOwner(request.params.owner);

          let returnValue:NftApiReturnObject = {
            info: {
              ledger_index: nftStore.getCurrentLedgerIndex(),
              ledger_hash: nftStore.getCurrentLedgerHash(),
              ledger_close: nftStore.getCurrentLedgerCloseTime(),
              ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
            },
            data: {
              owner: request.params.owner,
              offers: offers
            }
          }

          console.log("xls20_offers_by_owner_"+request.hostname + ": " + (Date.now()-start) + " ms")

          return returnValue;
        } catch(err) {
          console.log("error resolving nfts by owner");
          console.log(err);
          reply.code(500).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/ledgerdata', async (request, reply) => {
        try {
          //console.time("ledgerdata");
          let ledgerDataObjects: any[] = await ledgerData.getLedgerDataV1();
          //console.log("ledgerDataObjects: " + JSON.stringify(ledgerDataObjects));

          ledgerDataCounter++;

          if(ledgerDataCounter%1000 == 0)
            console.log("ledgerDataCounter: " + ledgerDataCounter);

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

          tokenCreationCounter++;

          if(tokenCreationCounter%1000 == 0)
            console.log("tokenCreationCounter: " + tokenCreationCounter);

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

function loadIps(tierName:string): string[] {
  if(fs.existsSync("/home/api-ips/"+tierName)) {
    let tier:string = fs.readFileSync("/home/api-ips/"+tierName).toString();

    //console.log(tierName + ": " + tier);
    if(tier && tier.trim().length > 0)
      return tier.split(',');
    else
      return [];
  } else {
    return [];
  }
}

function loadKeys(tierName:string): string[] {
  if(fs.existsSync("/home/api-tiers/"+tierName)) {
    let tier:string = fs.readFileSync("/home/api-tiers/"+tierName).toString();

    //console.log(tierName + ": " + tier);
    if(tier && tier.trim().length > 0)
      return tier.split(',');
    else
      return [];
  } else {
    return [];
  }
}

console.log("running server");
start();