import { URIToken } from './util/types';
import { AccountInfoRequest, AccountObjectsRequest, Client, LedgerRequest, LedgerResponse, parseNFTokenID, TransactionMetadata } from 'xrpl';
import * as rippleAddressCodec from 'ripple-address-codec';
import { UriTokenStore } from './uriTokenStore';
import { RippleState } from 'xrpl/dist/npm/models/ledger';

const pm2Lib = require('pm2')

export class LedgerSync {

  pm2Instance:number = process.env.PM2_INSTANCE_ID ? parseInt(process.env.PM2_INSTANCE_ID) : 0;
  mainConnections:number = process.env.MAIN_CONNECTIONS ? parseInt(process.env.MAIN_CONNECTIONS) : 1;
  secondaryConnections:number = process.env.SECONDARY_CONNECTIONS ? parseInt(process.env.SECONDARY_CONNECTIONS) : 1;
  mainNode:string = process.env.MAIN_NODE || 'wss://xahau.network';
  secondaryNode:string = process.env.SECONDRARY_NODE || 'wss://xahau.network';
  localNode:string = process.env.LOCAL_NODE || 'wss://xahau.network';

  clientUrl:string = this.mainNode;

  private static _instance: LedgerSync;

  private client = new Client(this.clientUrl);

  private finishedIteration:boolean = false;

  private uriTokenStore:UriTokenStore;
  private currentKnownLedger: number = 0;

  private constructor() {
    console.log("PM2_INSTANCE_ID: " + process.env.PM2_INSTANCE_ID);
    console.log("MAIN_CONNECTIONS: " + process.env.MAIN_CONNECTIONS);
    console.log("SECONDARY_CONNECTIONS: " + process.env.SECONDARY_CONNECTIONS);
    console.log("MAIN_NODE: " + process.env.MAIN_NODE);
    console.log("SECONDRARY_NODE: " + process.env.SECONDRARY_NODE);

    if(this.pm2Instance >= this.mainConnections) {
      if((this.pm2Instance - this.mainConnections) < this.secondaryConnections) {
        this.clientUrl = this.secondaryNode;
      } else {
        this.clientUrl = this.localNode;
      }
    }
  }

  public static get Instance(): LedgerSync
  {
      // Do you need arguments? Make it a regular static method instead.
      return this._instance || (this._instance = new this());
  }

  public async start(retryCount: number): Promise<void> {

    if(this.client) {
      this.client.removeAllListeners();

      if(this.client.isConnected())
        await this.client.disconnect();
    }

    try {
      this.finishedIteration = false;

      if(retryCount > 5) {
        console.log("COULD NOT CONNECT TO NODE! SWITCHING!")
        if(this.mainConnections > 0 && this.pm2Instance >= this.mainConnections) {
          this.client = new Client(this.mainNode)
        } else {
          this.client = new Client(this.secondaryNode)
        }
        
      } else if(retryCount > 10) {
        //force restart by pm2
        try {
          console.log("RELOADING!")
          pm2Lib.connect(false, (err) => {
            console.log("PM2 CONNECTED!")
            pm2Lib.list((err,list) => {

              let processId = this.getProcessId(list);

              pm2Lib.reload(processId, (err) => {
                if(err) {
                  console.log(err);
                  process.exit(1);
                } else {
                  console.log("RELOAD UNDER WAY")
                }

                pm2Lib.disconnect();
              });
            });
          });
        } catch(err) {
          console.log(err);
          process.exit(1);
        }
      } else {
        this.client = new Client(this.clientUrl)
      }

      this.uriTokenStore = UriTokenStore.Instance;

      await this.uriTokenStore.loadUriTokenDataFromFS();

      //reinitialize client
      this.client.on('disconnected', async ()=> {
        console.log("DISCONNECTED!!! RECONNECTING!")
        this.reset();
      });

      this.client.on('error', async () => {
        console.log("ERROR HAPPENED! Re-Init!");
        this.reset();
      });

      this.client.on('connected',() => {
        console.log("Connected to: " + this.client.url);
      });

      try {
        await this.client.connect();
      } catch(err) {
        this.reset(retryCount);
      }

      const serverInfo = await this.client.request({ command: "server_info" });
      console.log({ serverInfo });

      console.log("start listening for ledgers ...")
      await this.client.request({command: 'subscribe', streams: ['ledger']});

      //get current known ledger and try to catch up
      await this.startListeningOnLedgerClose();
      await this.iterateThroughMissingLedgers(this.localNode);
    } catch(err) {
      console.log(err);
      console.log("UNEXPECTED ERROR HAPPENED! RESET!")
      this.reset();
    }
  }

  private async iterateThroughMissingLedgers(clientToUse:string) {

    this.currentKnownLedger = this.uriTokenStore.getCurrentLedgerIndex();

    console.log("STARTING ITERATION AT LEDGER: " + this.currentKnownLedger + " WITH CLIENT: " + clientToUse);

    let iterationClient:Client;

    try {
      //try sync from local node!
      iterationClient = new Client(clientToUse)

      await iterationClient.connect();

      while(true) {
        let ledgerRequest:LedgerRequest = {
          command: 'ledger',
          ledger_index: this.currentKnownLedger+1,
          transactions: true,
          expand: true              
        }

        let ledgerResponse:LedgerResponse = await iterationClient.request(ledgerRequest);

        if(ledgerResponse?.result) {

          //console.log("analyzing ledger: " + ledgerResponse.result.ledger_index)

          if(!ledgerResponse.result.ledger.closed) { //if we are not closed yet, break and listen for ledger close!
            this.finishedIteration = true;
            break;
          }

          if(ledgerResponse.result.ledger?.transactions) {
            let transactions:any[] = ledgerResponse.result.ledger.transactions;
            transactions = transactions.sort((a,b) => a.metaData.TransactionIndex - b.metaData.TransactionIndex)

            for(let i = 0; i < transactions.length; i++) {
              if(transactions[i] && i == transactions[i].metaData.TransactionIndex) {
                this.analyzeTransaction(transactions[i]);
              } else if(i != transactions[i].metaData.TransactionIndex) {
                console.log("NOT EQUAL TRANSACTION INDEX:")
                console.log("i: " + i);
                console.log(JSON.stringify(transactions));
              }
            }
          } else {
            console.log("WAIT! NO TRANSACTIONS???")
            console.log("ledger: " + this.currentKnownLedger+1);
          }

          this.uriTokenStore.setCurrentLedgerIndex(ledgerResponse.result.ledger_index);
          this.uriTokenStore.setCurrentLedgerHash(ledgerResponse.result.ledger.ledger_hash);
          this.uriTokenStore.setCurrentLedgerCloseTime(ledgerResponse.result.ledger.close_time_human);
          this.uriTokenStore.setCurrentLedgerCloseTimeMs(ledgerResponse.result.ledger.close_time);

          this.currentKnownLedger = ledgerResponse.result.ledger_index;
        } else {
          this.finishedIteration = true;
          break;
        }
      }

      console.log("FINISHED SYNCING BACK!")

    } catch(err) {
      console.log("err 1")
      console.log(err);
      if(err.data.error === 'lgrNotFound') {
        //restart by iterating with xrplcluster.com!
        await this.iterateThroughMissingLedgers(this.mainNode);
      } else {
        this.reset();
      }
    } finally {
      try {
        if(iterationClient && iterationClient.isConnected())
          iterationClient.disconnect();
      } catch(err) {
        console.log("err diconnecting iteration client");
      }
    }
  }

  private async startListeningOnLedgerClose() {

    let waitingForNextClose = false;

    this.client.on('ledgerClosed', async ledgerClose => {

      try {
        //we have a closed ledger. Request the transactions and try to analyze them!
        if(this.finishedIteration) {
          //console.log("ledger closed! " + ledgerClose.ledger_index);

          if((this.currentKnownLedger+1) == ledgerClose.ledger_index) {

            if(waitingForNextClose) {
              console.log("BACK IN SYNC. GOT CORRECT LEDGER: " + ledgerClose.ledger_index);
              waitingForNextClose = false;
            }

            let start = Date.now();
            let ledgerRequest:LedgerRequest = {
              command: 'ledger',
              ledger_index: ledgerClose.ledger_index,
              transactions: true,
              accounts: false,
              binary: false,
              owner_funds: false,
              queue: false,
              full: false,
              expand: true
            }

            let ledgerResponse:LedgerResponse = await this.client.request(ledgerRequest);

            if(ledgerResponse?.result?.ledger?.transactions) {
              let transactions:any[] = ledgerResponse.result.ledger.transactions;
              transactions = transactions.sort((a,b) => a.metaData.TransactionIndex - b.metaData.TransactionIndex)

              //console.log("having transactions: " + transactions.length);

              for(let i = 0; i < transactions.length; i++) {
                if(transactions[i] && i == transactions[i].metaData.TransactionIndex) {

                  this.analyzeTransaction(transactions[i]);
                  
                } else if(i != transactions[i].metaData.TransactionIndex) {
                  console.log("NOT EQUAL TRANSACTION INDEX:")
                  console.log("i: " + i);
                  console.log(JSON.stringify(transactions));
                }
              }
            }

            this.uriTokenStore.setCurrentLedgerIndex(ledgerResponse.result.ledger_index);
            this.uriTokenStore.setCurrentLedgerHash(ledgerResponse.result.ledger.ledger_hash);
            this.uriTokenStore.setCurrentLedgerCloseTime(ledgerResponse.result.ledger.close_time_human);
            this.uriTokenStore.setCurrentLedgerCloseTimeMs(ledgerResponse.result.ledger.close_time);

            this.currentKnownLedger = this.uriTokenStore.getCurrentLedgerIndex();

            let elapsed = Date.now() - start;

            if(elapsed > 2500) {
              console.log("long runner: " + elapsed + " ms.")
            }

            if(elapsed > 3500) {
              console.log("MORE THAN 3.5 SECONDS ELAPSED TO FETCH LEDGER")
              this.reset();
            }

          } else {
            console.log("WRONG EXPECTED LEDGER NUMBER. EXPECTED: " + (this.currentKnownLedger+1) + " | GOT: " + ledgerClose.ledger_index);

            //sometimes my local node is a bit faster than remote nodes. so they report a closed ledger I already have process. just wait for the next one and don't reset.
            if(this.currentKnownLedger != ledgerClose.ledger_index) {
              //only reset if we are not 1 before the expected ledger!
              this.reset();
            } else {
              waitingForNextClose = true;
              console.log("WAITING FOR THE NEXT CLOSE");
            }
          }
        } else {
          console.log("Ledger closed but waiting for catch up! current ledger: " + this.currentKnownLedger + " | last closed ledger: " + ledgerClose.ledger_index);
        }
      } catch(err) {
        console.log("err 2")
        console.log(err);

        this.reset();
      }
    });     
  }

  private async reset(retryCount?:number) {
    try {

      if(retryCount == undefined) {
        console.log("EXECUTING HARD RESET!");
        //hard reset
        try {
          console.log("RELOADING!")
          pm2Lib.connect(false, err => {
            console.log("PM2 CONNECTED");
            pm2Lib.list((err,list) => {

              let processId = this.getProcessId(list);

              pm2Lib.reload(processId, (err) => {
                if(err) {
                  console.log(err);
                  process.exit(1);
                } else {
                  console.log("RELOAD UNDER WAY");
                }

                pm2Lib.disconnect();
              });
            });
          });
        } catch(err) {
          console.log(err);
          process.exit(1);
        }
      } else {
        console.log("RESET WITH RETRY COUNTER")
        retryCount++;
        this.start(retryCount);
      }

    } catch(err) {
      console.log(err);
      console.log("ERR WHILE RESETTING. EXIT TOOL!");
      try {
        console.log("RELOADING!")
        pm2Lib.connect(false, (err) => {
          console.log("PM2 CONNECTED.")
          pm2Lib.list((err,list) => {

            let processId = this.getProcessId(list);

            pm2Lib.reload(processId, (err) => {
              if(err) {
                console.log(err);
                process.exit(1);
              } else {
                console.log("RELOAD UNDER WAY")
              }

              pm2Lib.disconnect();
            });
          });
        });
      } catch(err) {
        console.log(err);
        process.exit(1);
      }
    }
  }

  private analyzeTransaction(transaction:any) {

    if(transaction && transaction.metaData?.TransactionResult == "tesSUCCESS" && (transaction.TransactionType == "URITokenMint" || transaction.TransactionType == "URITokenCreateSellOffer" || transaction.TransactionType == "URITokenCancelSellOffer" || transaction.TransactionType == "URITokenBuy" || transaction.TransactionType == "URITokenBurn")) {

      //console.log("analyzing NFT Transaction!")

      if(transaction.TransactionType === "URITokenMint") { // update / set URI Token
        let newUriToken:URIToken = this.getMintedUriToken(transaction.metaData);

        if(newUriToken) {
          //fix for missing amount in meta data
          if(transaction.Amount) {
            newUriToken.Amount = transaction.Amount;
          }
          //console.log("minted token: " + mintedTokenId);
          this.uriTokenStore.addUriToken(newUriToken);
        }

      } else if(transaction.TransactionType === "URITokenBurn") { // BURNED NFT
        let burnedTokenId = this.getBurnedTokenId(transaction.metaData);

        if(burnedTokenId) {
          //console.log("burned token: " + burnedTokenId);

          let burnedNft = this.uriTokenStore.getUriToken(burnedTokenId);
          this.uriTokenStore.removeNft(burnedNft);
        }
                  
      } else { // CHECK Properties OWNER CHANGE!

        if(transaction.metaData.AffectedNodes) {
          for(let i = 0; i < transaction.metaData.AffectedNodes.length; i++) {
            let affectedNode = transaction.metaData.AffectedNodes[i];
  
            if(affectedNode && 'ModifiedNode' in affectedNode && affectedNode.ModifiedNode.LedgerEntryType === 'URIToken') {
              //we have a created URI Token. Build the ledger object!
  
              let modifiedNode = affectedNode.ModifiedNode;

              let uriTokenId = modifiedNode.LedgerIndex;

              //resolve current token
              let currentUriToken = this.uriTokenStore.getUriToken(uriTokenId);

              if(currentUriToken) {

                let finalFields = modifiedNode.FinalFields;
                let newFields = modifiedNode.NewFields;

                let oldOwner:string = null;

                for (let finalKey in finalFields) {
                  if (finalFields.hasOwnProperty(finalKey)) {
                      if("Owner" === finalKey) {
                        oldOwner = finalFields[finalKey];
                      }

                      currentUriToken[finalKey] = finalFields[finalKey];
                  }
                }

                for (let newKey in newFields) {
                  if (newFields.hasOwnProperty(newKey)) {
                      if("Owner" === newKey) {
                        oldOwner = newFields[newKey];
                      }

                      currentUriToken[newKey] = newFields[newKey];
                  }
                }
    
                this.uriTokenStore.changeProperties(currentUriToken, oldOwner);
              } else {
                console.log("THIS SHOULD NEVER HAVE HAPPENED?!?!? NEW NFT NOT POSSIBLE!")
            
                //restart tool
                try {
                  console.log("RELOADING!")
                  pm2Lib.connect(false, (err) => {
                    console.log("PM CONNECTED")
                    pm2Lib.list((err,list) => {
                      let processId = this.getProcessId(list);

                      pm2Lib.reload(processId, (err) => {
                        if(err) {
                          console.log(err);
                          process.exit(1);
                        } else {
                          console.log("RELOAD UNDER WAY")
                        }
                        
                        pm2Lib.disconnect();
                      });
                    });
                  });
                } catch(err) {
                  console.log(err);
                  process.exit(1);
                }
              }
            }
          }
        }
      }
    }
  }

  //anylze meta data to check if NFToken was burned
  private getBurnedTokenId(metaData: TransactionMetadata): string {
    let burnedTokenId:string = null;

    if(metaData.AffectedNodes) {
      for(let i = 0; i < metaData.AffectedNodes.length; i++) {
        let affectedNode = metaData.AffectedNodes[i];

        if(affectedNode && 'DeletedNode' in affectedNode && affectedNode.DeletedNode.LedgerEntryType === 'URIToken') {
          //we have a created URI Token. Build the ledger object!

          burnedTokenId = affectedNode.DeletedNode.LedgerIndex;

          break;
        }
      }
    }

    return burnedTokenId;
  }

  //anylze meta data to check if NFToken was minted
  private getMintedUriToken(metaData: TransactionMetadata): URIToken {
    let newUriToken:URIToken = null;
    if(metaData.AffectedNodes) {
      for(let i = 0; i < metaData.AffectedNodes.length; i++) {
        let affectedNode = metaData.AffectedNodes[i];

        if(affectedNode && 'CreatedNode' in affectedNode && affectedNode.CreatedNode.LedgerEntryType === 'URIToken') {
          //we have a created URI Token. Build the ledger object!

          let createdNode:any = affectedNode.CreatedNode;

          newUriToken = {
            URITokenID: createdNode.LedgerIndex,
            Issuer: createdNode.NewFields.Issuer,
            Owner: createdNode.NewFields.Owner,
            URI: createdNode.NewFields.URI,
            Destination: createdNode.NewFields.Destination,
            Digest: createdNode.Digest,
            Amount: createdNode.Amount
          };

          break;
        }
      }
    }

    return newUriToken;
  }

  
  private getProcessId(list:any[]): number {
    let processId=-1;
    if(list) {
      for(let i = 0; i < list.length; i++) {
        let singleProcess = list[i];

        if(singleProcess && singleProcess.name === 'xrpl-data-api') {
          let pm2Env = singleProcess.pm2_env;

          if(pm2Env && pm2Env.PM2_INSTANCE_ID === this.pm2Instance) {// same instance, get pm2_id
            processId = pm2Env.pm_id;
            break;
          }
        }
      }
    }

    console.log("found id: " + processId);

    return processId;
  }
}