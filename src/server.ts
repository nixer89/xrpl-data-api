import { IssuerAccounts } from './issuerAccounts';
import { LedgerData } from './ledgerData';
import { TokenCreation } from './tokenCreation';
import { AccountNames } from "./accountNames";
import { SelfAssessments } from "./selfAssessments";
import { LedgerSync } from "./syncLedger";
import * as fs from 'fs';
import fastifySwagger from "@fastify/swagger";
import Helmet from '@fastify/helmet';
import * as nftApiRoute from './api/nftApi';
import * as offerApiRoute from './api/nftOfferApi';
import * as offerFundedApiRoute from './api/nftOfferFundedApi';
import * as collectionApiRoute from './api/statisticsApi';
import * as tokenAnsMiscApiRoute from './api/tokenAndMiscApi';
import * as scheduler from 'node-schedule';
import { DATA_PATH, REDIS_IP, REDIS_PORT } from './util/config';

require("log-timestamp");

const Redis = require('ioredis')
const redis = new Redis({
  connectionName: 'xrpl-data-api',
  host: REDIS_IP,
  port: REDIS_PORT,
  connectTimeout: 500,
  maxRetriesPerRequest: 1
})

let issuerAccount:IssuerAccounts;
let ledgerData:LedgerData;
let tokenCreation:TokenCreation;
let accountNames:AccountNames;
let selfAssessments:SelfAssessments;
let ledgerSync: LedgerSync;


let tier1LimitIps:string[] = [];
let tier2LimitIps:string[] = [];
let tier3LimitIps:string[] = [];
let tier4LimitIps:string[] = [];
let tier5LimitIpsRaw:string[] = [];
let tier5IpLimitMap:Map<string, number> = new Map();

let tier1LimitKeys:string[] = [];
let tier2LimitKeys:string[] = [];
let tier3LimitKeys:string[] = [];
let tier4LimitKeys:string[] = [];
let tier5LimitKeysRaw:string[] = [];
let tier5KeyLimitMap:Map<string, number> = new Map();

let blocked:string[] = [];

let keyMap:Map<string,number> = new Map();
let blockedMap:Map<string,number> = new Map();

let showHeaders = 0;

const fastify = require('fastify')({ trustProxy: true })

console.log("adding response compression");
fastify.register(require('@fastify/compress'), { encodings: ['gzip', 'deflate', 'br', '*', 'identity'] });


let totalRequests:number = 0;

let kycCounter:number = 0;
let ledgerDataCounter:number = 0;
let tokenCounter:number = 0;
let tokenCreationCounter:number = 0;
let xls14NftCounter:number = 0;

// Run the server!
const start = async () => {

  const data:any = fs.readFileSync('./open-api-spec/xrpl-data-api.json', 'utf8').toString();

  if(!fs.existsSync(DATA_PATH))
    fs.mkdirSync(DATA_PATH);

  issuerAccount = IssuerAccounts.Instance;
  ledgerData = LedgerData.Instance;
  tokenCreation = TokenCreation.Instance;
  accountNames = AccountNames.Instance;
  selfAssessments = SelfAssessments.Instance;
  ledgerSync = LedgerSync.Instance;

    console.log("starting server");
    try {
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

          let callerIp = req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
                      || req.headers['x-real-ip'] // nginx
                      || req.headers['x-client-ip'] // apache
                      || req.headers['x-forwarded-for'] // use this only if you trust the header
                      || req.ip // fallback to default

          let limit = 10;

          //console.log(req.url);
          //console.log(req.method);

          let calls = 1;
          if(keyMap.has(key)) {
            calls = keyMap.get(key);
            calls++;
          }

          keyMap.set(key,calls);

          if(calls%100 == 0) {
            if(key != callerIp)
              console.log(key + " already called: " + calls + " times from ip " + callerIp);
            else
              console.log(key + " already called: " + calls + " times.");
          }

          //TIER 1 LIMIT
          for(let i = 0; i < tier1LimitIps.length; i++) {
            if(tier1LimitIps[i] != null && tier1LimitIps[i].length > 0 && key.startsWith(tier1LimitIps[i])) {
              limit = 60;
              i = tier1LimitIps.length;
            }
          }

          if(tier1LimitKeys != null && tier1LimitKeys.includes(key)) {
            limit = 60;
          }

          //TIER 2 LIMIT
          for(let j = 0; j < tier2LimitIps.length; j++) {
            if(tier2LimitIps[j] != null && tier2LimitIps[j].length > 0 && key.startsWith(tier2LimitIps[j])) {
              limit = 600;
              j = tier2LimitIps.length;
            }
          }

          if(tier2LimitKeys != null && tier2LimitKeys.includes(key)) {
            limit = 600;
          }

          //TIER 3 LIMIT
          for(let k = 0; k < tier3LimitIps.length; k++) {
            if(tier3LimitIps[k] != null && tier3LimitIps[k].length > 0 && key.startsWith(tier3LimitIps[k])) {
              limit = 1200;
              k = tier3LimitIps.length;
            }
          }

          if(tier3LimitKeys != null && tier3LimitKeys.includes(key)) {
            limit = 1200;
          }

          //TIER 4 LIMIT
          for(let l = 0; l < tier4LimitIps.length; l++) {
            if(tier4LimitIps[l] != null && tier4LimitIps[l].length > 0 && key.startsWith(tier4LimitIps[l])) {
              limit = 2400;
              l = tier4LimitIps.length;
            }
          }

          if(tier4LimitKeys != null && tier4LimitKeys.includes(key)) {
            limit = 2400;
          }

          //TIER 5 LIMIT
          if(tier5IpLimitMap.has(key)) {
            limit = tier5IpLimitMap.get(key);
          }

          if(tier5KeyLimitMap.has(key)) {
            limit = tier5KeyLimitMap.get(key);
          }

          //BLOCKED LIST
          for(let m = 0; m < blocked.length; m++) {
            if(blocked[m] != null && blocked[m].length > 0 && key.startsWith(blocked[m])) {
              limit = 0;
              m = blocked.length;
            }
          }

          if(limit == 0) {
            console.log("blocked: " + key);
          }

          return limit;
        },
        timeWindow: '1 minute',
        keyGenerator: function(req) {
          return req.headers['x-api-key']
          || req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
          || req.headers['x-real-ip'] // nginx
          || req.headers['x-client-ip'] // apache
          || req.headers['x-forwarded-for'] // use this only if you trust the header
          || req.ip // fallback to default
        }
      });

      await fastify.setErrorHandler(function (error, req, reply) {
        if (reply.statusCode === 429) {
  
          let key = req.headers['x-api-key']
                || req.headers['cf-connecting-ip'] // cloudflare originally connecting IP
                || req.headers['x-real-ip'] // nginx
                || req.headers['x-client-ip'] // apache
                || req.headers['x-forwarded-for'] // use this only if you trust the header
                || req.ip // fallback to default


          let blocks = 1;

          if(blockedMap.has(key)) {
            blocks = blockedMap.get(key);
            blocks++;
          }

          blockedMap.set(key,blocks);

          if(blocks%100 == 0) {
            console.log(key + " already blocked: " + blocks + " times.");
          }

          let isBlocked = false;

          for(let m = 0; m < blocked.length; m++) {
            if(blocked[m] != null && blocked[m].length > 0 && key.startsWith(blocked[m])) {
              isBlocked = true;
              m = blocked.length;
            }
          }

          if(!isBlocked) {
            console.log("RATE LIMIT | " + key + " | " + req.headers['cf-connecting-ip'] + " | " + req.routerPath + " | " + JSON.stringify(req.params));
            error.message = 'You are sending too many requests in a short period of time. Please calm down and try again later. Check https://api.xrpldata.com/docs for API limits and contact us throught the listed channels in the docs if you need elevated limits.'
          } else {
            showHeaders++;

            if(showHeaders < 10) {
              console.log(JSON.stringify(req.headers));
            }

            error.message = 'Please contact us to request elevated limits: @XrplServices (on twitter)'
          }
        }
        reply.send(error)
      });

      

    console.log("declaring routes");
    await fastify.register(tokenAnsMiscApiRoute.registerRoutes);
    await fastify.register(nftApiRoute.registerRoutes);
    await fastify.register(offerApiRoute.registerRoutes);
    await fastify.register(offerFundedApiRoute.registerRoutes);
    await fastify.register(collectionApiRoute.registerRoutes);
    console.log("finished declaring routes");

    /**
    await fastify.addHook('onRequest', (request, reply, done) => {
      request['start'] = Date.now();
      done()
    });

    await fastify.addHook('onSend', async (request, reply, payload) => {
      if(request['start']) {
        let responseTime = Date.now() - request['start'];
        console.log("responseTime: " + responseTime + " ms.")
      }

      return payload;
    });
     */
      
    console.log("declaring 200er reponse")
    fastify.get('/api', async (request, reply) => {
      reply.code(200).send('I am alive!'); 
    });

    try {
      await fastify.listen({ port: 4002, host: '0.0.0.0' });

      console.log("http://0.0.0.0:4002/");

      process.send('ready');

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
  if(fs.existsSync("/home/api-limits/api-ips/"+tierName)) {
    let tier:string = fs.readFileSync("/home/api-limits/api-ips/"+tierName).toString();

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

function loadBlocked(): string[] {
  if(fs.existsSync("/home/api-limits/api-blocked/blocked")) {
    let blocked:string = fs.readFileSync("/home/api-limits/api-blocked/blocked").toString();

    //console.log(tierName + ": " + tier);
    if(blocked && blocked.trim().length > 0)
      return blocked.split(',');
    else
      return [];
  } else {
    return [];
  }
}

function loadApiKeys(): void {
  tier1LimitIps = loadIps("tier1");
  tier2LimitIps = loadIps("tier2");
  tier3LimitIps = loadIps("tier3");
  tier4LimitIps = loadIps("tier4");
  tier5LimitIpsRaw = loadIps("tier5");

  for(let i = 0; i < tier5LimitIpsRaw.length; i++) {
    let keyValue:string[] = tier5LimitIpsRaw[i].split("=");

    tier5IpLimitMap.set(keyValue[0], Number(keyValue[1]));
  }

  tier1LimitKeys = loadKeys("tier1");
  tier2LimitKeys = loadKeys("tier2");
  tier3LimitKeys = loadKeys("tier3");
  tier4LimitKeys = loadKeys("tier4");
  tier5LimitKeysRaw = loadKeys("tier5");

  for(let i = 0; i < tier5LimitKeysRaw.length; i++) {
    let keyValue:string[] = tier5LimitKeysRaw[i].split("=");

    tier5KeyLimitMap.set(keyValue[0], Number(keyValue[1]));
  }

  blocked = loadBlocked();
}

console.log("running server");
start();