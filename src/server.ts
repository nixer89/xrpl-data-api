import consoleStamp = require("console-stamp");
import { IssuerAccounts } from './issuerAccounts';
import { LedgerData } from './ledgerData';
import { TokenCreation } from './tokenCreation';
import { AccountNames } from "./accountNames";

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
let accountNames: AccountNames;

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

const fastify = require('fastify')()

console.log("adding response compression");
fastify.register(require('fastify-compress'), { encodings: ['gzip', 'deflate', 'br', '*', 'identity'] });

console.log("adding some security headers");
fastify.register(require('fastify-helmet'));

// Run the server!
const start = async () => {

  issuerAccount = IssuerAccounts.Instance;
  ledgerData = LedgerData.Instance;
  tokenCreation = TokenCreation.Instance;
  accountNames = AccountNames.Instance;

    console.log("starting server");
    try {
      await accountNames.init();
      await tokenCreation.init();
      await issuerAccount.init();
      await ledgerData.init();
      

      //init routes
      console.log("adding cors");

      fastify.register(require('fastify-cors'), {
        origin: "*",
        methods: 'GET, OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'Referer']
      });

      await fastify.register(require('fastify-rate-limit'), {
        global: true,
        redis: redis,
        skipOnError: true,
        max: 5,
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

          console.log(JSON.stringify(req));
  
          let ip = req.headers['x-real-ip'] // nginx
                || req.headers['x-client-ip'] // apache
                || req.headers['x-forwarded-for'] // use this only if you trust the header
                || req.ip // fallback to default
  
          console.log("RATE LIMIT HIT BY: " + ip);
          
          error.message = 'You are sending too many requests in a short period of time. Please calm down and try again later :-)'
        }
        reply.send(error)
      });

      fastify.get('/api/v1/tokens', async (request, reply) => {
        try {
          console.time("tokens");
          //console.log("request params: " + JSON.stringify(request.params));
          let issuers = issuerAccount.getLedgerTokensV1();

          let returnValue = {
            ledger_index: issuerAccount.getLedgerIndex(),
            ledger_hash: issuerAccount.getLedgerHash(),
            ledger_close: issuerAccount.getLedgerCloseTime(),
            ledger_close_ms: issuerAccount.getLedgerCloseTimeMs(),
            issuers: issuers
          }

          console.timeEnd("tokens");

          return returnValue;
        } catch(err) {
          console.log("error resolving tokens");
          console.log(err);
          reply.code(200).send('Error occured. Please check your request.');
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
          reply.code(200).send('Error occured. Please check your request.');
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
            reply.code(200).send('Error occured. Please check your request.');
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
          reply.code(200).send('Error occured. Please check your request.');
        }
      });
      
    console.log("declaring 200er reponse")
    fastify.get('/api', async (request, reply) => {
      reply.code(200).send('I am alive!'); 
    });

    try {
      await fastify.listen(4002, '0.0.0.0');

      console.log("http://localhost:4002/");

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