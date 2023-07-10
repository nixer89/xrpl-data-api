import { NftStore } from "../nftokenStore";
import { LedgerSync } from "../syncLedger";
import { NftApiReturnObject, NFTokenOffer, NFTokenOfferFundedStatus } from "../util/types";
import * as scheduler from 'node-schedule';
import * as fs from 'fs';

let nftStore: NftStore = NftStore.Instance;
let ledgerSync: LedgerSync = LedgerSync.Instance;

let tier1LimitKeys:string[] = [];
let tier2LimitKeys:string[] = [];
let tier3LimitKeys:string[] = [];
let tier4LimitKeys:string[] = [];
let tier5LimitKeysRaw:string[] = [];
let tier5KeyLimitMap:Map<string, number> = new Map();

let keyMap:Map<string,number> = new Map();

export async function registerRoutes(fastify, opts, done) {

  loadApiKeys();

  scheduler.scheduleJob("loadApiKeys1", {minute: 0, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys2", {minute: 5, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys3", {minute: 10, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys4", {minute: 15, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys5", {minute: 50, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys6", {minute: 25, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys7", {minute: 60, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys8", {minute: 35, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys9", {minute: 40, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys10", {minute: 45, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys11", {minute: 50, second: 0}, () => loadApiKeys());
  scheduler.scheduleJob("loadApiKeys12", {minute: 55, second: 0}, () => loadApiKeys());

      fastify.get('/api/v1/xls20-nfts/funded/offer/:offerid',{
        config: {
          rateLimit: {
            timeWindow: '1 minute',
            max: async (req, key) => {

              let callerIp = req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
                          || req.headers['x-real-ip'] // nginx
                          || req.headers['x-client-ip'] // apache
                          || req.headers['x-forwarded-for'] // use this only if you trust the header
                          || req.ip // fallback to default

              let limit = 0;
    
              let calls = 1;
              if(keyMap.has(key)) {
                calls = keyMap.get(key);
                calls++;
              }
    
              keyMap.set(key,calls);

              let logKey = key;

              if(logKey && logKey.length > 24) {
                logKey = logKey.substring(24);
              }
    
              if(calls%100 == 0) {
                if(key != callerIp)
                  console.log("FUNDED OFFERS: " + logKey + " already called: " + calls + " times from ip " + callerIp);
                else
                  console.log("FUNDED OFFERS: " + logKey + " already called: " + calls + " times.");
              }
    
              //TIER 1 LIMIT
              if(tier1LimitKeys != null && tier1LimitKeys.includes(key)) {
                  limit = 20;
              }
    
              //TIER 2 LIMIT
              if(tier2LimitKeys != null && tier2LimitKeys.includes(key)) {
                limit = 40;
              }
    
              //TIER 3 LIMIT
              if(tier3LimitKeys != null && tier3LimitKeys.includes(key)) {
                limit = 80;
              }
    
              //TIER 4 LIMIT
              if(tier4LimitKeys != null && tier4LimitKeys.includes(key)) {
                limit = 160;
              }
    
              //TIER 5 LIMIT
              if(tier5KeyLimitMap.has(key)) {
                limit = 160
              }
    
              if(limit == 0) {
                console.log("blocked on 'GET FUNDED OFFER' api: " + key);
              }
    
              return limit;
            },
            keyGenerator: function(req) {
              return req.headers['x-api-key']
              || req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
              || req.headers['x-real-ip'] // nginx
              || req.headers['x-client-ip'] // apache
              || req.headers['x-forwarded-for'] // use this only if you trust the header
              || req.ip // fallback to default
            },
            errorResponseBuilder: function (request, context) {
              return {
                code: 401,
                error: 'Unauthorized',
                message: `To use this endpoint, please provide a valid API key in your request!`
              }
            }
          }
        }
      }, async (request, reply) => {
        try {
          if(!request.params.offerid) {
            reply.code(400).send('Please provide an offerid. Calls without offerid are not allowed');
          }

          try {
            let start = Date.now();

            let returnValue:NftApiReturnObject;

            let offerStatus:NFTokenOfferFundedStatus = await ledgerSync.isOfferFunded(null, request.params.offerid);

            let diff = Date.now() - start;

            if(diff > 200) {
              console.log("offer is funded: " + diff + " ms.");
            }

            returnValue = {
              info: {
                ledger_index: nftStore.getCurrentLedgerIndex(),
                ledger_hash: nftStore.getCurrentLedgerHash(),
                ledger_close: nftStore.getCurrentLedgerCloseTime(),
                ledger_close_ms: nftStore.getCurrentLedgerCloseTimeMs()
              },
              data: offerStatus
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

      fastify.post('/api/v1/xls20-nfts/funded/offers', {
        config: {
          rateLimit: {
            timeWindow: '1 minute',
            max: async (req, key) => {

              let callerIp = req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
                          || req.headers['x-real-ip'] // nginx
                          || req.headers['x-client-ip'] // apache
                          || req.headers['x-forwarded-for'] // use this only if you trust the header
                          || req.ip // fallback to default
    
              let limit = 0;
    
              //console.log(req.url);
              //console.log(req.method);
    
              let calls = 1;
              if(keyMap.has(key)) {
                calls = keyMap.get(key);
                calls++;
              }
    
              keyMap.set(key,calls);

              let logKey = key;

              if(logKey && logKey.length > 24) {
                logKey = logKey.substring(24);
              }
    
              if(calls%100 == 0) {
                if(key != callerIp)
                  console.log("FUNDED OFFERS: " + logKey + " already called: " + calls + " times from ip " + callerIp);
                else
                  console.log("FUNDED OFFERS: " + logKey + " already called: " + calls + " times.");
              }
    
              //TIER 1 LIMIT
              if(tier1LimitKeys != null && tier1LimitKeys.includes(key)) {
                  limit = 20;
              }
    
              //TIER 2 LIMIT
              if(tier2LimitKeys != null && tier2LimitKeys.includes(key)) {
                limit = 40;
              }
    
              //TIER 3 LIMIT
              if(tier3LimitKeys != null && tier3LimitKeys.includes(key)) {
                limit = 80;
              }
    
              //TIER 4 LIMIT
              if(tier4LimitKeys != null && tier4LimitKeys.includes(key)) {
                limit = 160;
              }
    
              //TIER 5 LIMIT
              if(tier5KeyLimitMap.has(key)) {
                limit = 160;
              }
    
              if(limit == 0) {
                console.log("blocked on 'POST FUNDED OFFER' api: " + key);
              }
    
              return limit;
            },
            keyGenerator: function(req) {
              return req.headers['x-api-key']
              || req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
              || req.headers['x-real-ip'] // nginx
              || req.headers['x-client-ip'] // apache
              || req.headers['x-forwarded-for'] // use this only if you trust the header
              || req.ip // fallback to default
            },
            errorResponseBuilder: function (request, context) {
              return {
                code: 401,
                error: 'Unauthorized',
                message: `To use this endpoint, please provide a valid API key in your request!`
              }
            }
          }
        }
      }, async (request, reply) => {
        try {
          if(!request.body.offers) {
            reply.code(400).send('Please provide offers in the body. Calls without offers are not allowed');
          }

          try {
            let start = Date.now();
            let offersToCheck:string[] = request.body.offers;

            if(!offersToCheck || offersToCheck.length > 20) {
              reply.code(400).send('Too many Offers to check. Max 20 allowed!');
              return;
            }

            let checkedOffers:NFTokenOfferFundedStatus[] = await ledgerSync.areOffersFunded(offersToCheck)

            let diff = Date.now()-start;

            if(diff > 200) {
              console.log("offers ( " + offersToCheck.length + " ) are funded: " + diff + " ms.");
            }

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

function loadKeys(tierName:string): string[] {
  if(fs.existsSync("/home/api-limits/api-keys/"+tierName)) {
    let tier:string = fs.readFileSync("/home/api-limits/api-keys/"+tierName).toString();

    //console.log(tierName + ": " + tier);
    if(tier && tier.trim().length > 0)
      return tier.split(',');
    else
      return [];
  } else {
    return [];
  }
}

function loadApiKeys(): void {
  tier1LimitKeys = loadKeys("tier1");
  tier2LimitKeys = loadKeys("tier2");
  tier3LimitKeys = loadKeys("tier3");
  tier4LimitKeys = loadKeys("tier4");
  tier5LimitKeysRaw = loadKeys("tier5");

  for(let i = 0; i < tier5LimitKeysRaw.length; i++) {
    let keyValue:string[] = tier5LimitKeysRaw[i].split("=");

    tier5KeyLimitMap.set(keyValue[0], Number(keyValue[1]));
  }
}