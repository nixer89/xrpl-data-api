import consoleStamp = require("console-stamp");
import { IssuerAccounts } from './issuerAccounts';
import { LedgerData } from './ledgerData';
import { TokenCreation } from './tokenCreation';
import { AccountNames } from "./accountNames";
import * as fetch from 'node-fetch';

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
        cache: 10000,
        skipOnError: true,
        max: async (req, key) => {
          if(key.startsWith("76.201.20") 
            || key.startsWith("76.201.21")
            || key.startsWith("76.201.22")
            || key.startsWith("76.201.23")
            || key.startsWith("120.29.68"))
            {
              return 30;    
            } else {
              return 5
            }
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
  
          console.log("RATE LIMIT HIT BY: " + ip);
          
          error.message = 'You are sending too many requests in a short period of time. Please calm down and try again later :-)'
        }
        reply.send(error)
      });

      fastify.get('/api/v1/tokens', async (request, reply) => {
        try {
          console.time("tokens");
          let tokenResponse = await fetch.default("https://api.xrpldata.com/api/v1/tokens");
          console.timeEnd("tokens");
          
          if(tokenResponse && tokenResponse.ok) {
            return tokenResponse.json();
          } else {
            console.log("GOT ERROR RESPONSE FROM REDIRECT API TOKENS");
            reply.code(200).send('Error occured. Please check your request.');
          }
        } catch(err) {
          console.log("error resolving tokens");
          console.log(err);
          reply.code(200).send('Error occured. Please check your request.');
        }
      });

      fastify.get('/api/v1/ledgerdata', async (request, reply) => {
        try {
          console.time("ledgerdata");
          let ledgerDataResponse = await fetch.default("https://api.xrpldata.com/api/v1/ledgerdata")
          console.timeEnd("ledgerdata");

          if(ledgerDataResponse && ledgerDataResponse.ok) {
            return ledgerDataResponse.json();
          } else {
            console.log("GOT ERROR RESPONSE FROM REDIRECT API LEDGERDATA");
            reply.code(200).send('Error occured. Please check your request.');
          }
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
              console.time("kyc");
              let kycResponse = await fetch.default("https://api.xrpldata.com/api/v1/kyc/"+request.params.account)
              console.timeEnd("kyc");
              
              if(kycResponse && kycResponse.ok) {
                return kycResponse.json();
              } else {
                console.log("GOT ERROR RESPONSE FROM REDIRECT API KYC");
                reply.code(200).send('Error occured. Please check your request.');
              }
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
              let tokenCreationResponse = await fetch.default("https://api.xrpldata.com/api/v1/tokencreation")
              console.timeEnd("tokencreation");
              
              if(tokenCreationResponse && tokenCreationResponse.ok) {
                return tokenCreationResponse.json();
              } else {
                console.log("GOT ERROR RESPONSE FROM REDIRECT API TOKENCREATION");
                reply.code(200).send('Error occured. Please check your request.');
              }
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