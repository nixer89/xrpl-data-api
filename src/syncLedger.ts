import { NFT, NFTokenOffer } from './util/types';
import { AccountInfoRequest, AccountObjectsRequest, Client, LedgerRequest, LedgerResponse, parseNFTokenID, TransactionMetadata } from 'xrpl';
import * as rippleAddressCodec from 'ripple-address-codec';
import { NftStore } from './nftokenStore';
import { timeStamp } from 'console';
import { RippleState } from 'xrpl/dist/npm/models/ledger';
import { off } from 'process';

export class LedgerSync {

    pm2Instance:number = process.env.PM2_INSTANCE_ID ? parseInt(process.env.PM2_INSTANCE_ID) : 0;
    mainConnections:number = process.env.MAIN_CONNECTIONS ? parseInt(process.env.MAIN_CONNECTIONS) : 1;
    secondaryConnections:number = process.env.SECONDARY_CONNECTIONS ? parseInt(process.env.SECONDARY_CONNECTIONS) : 1;
    mainNode:string = process.env.MAIN_NODE || 'wss://xrplcluster.com';
    secondaryNode:string = process.env.SECONDRARY_NODE || 'wss://s1.ripple.com';
    localNode:string = process.env.LOCAL_NODE || 'ws://127.0.0.1:6006';

    clientUrl:string = this.mainNode;

    private static _instance: LedgerSync;

    private client = new Client(this.clientUrl);
    private localClient = new Client(this.localNode);

    private finishedIteration:boolean = false;

    private nftStore:NftStore;
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
          process.exit(1);
        } else {
          this.client = new Client(this.clientUrl)
        }

        this.nftStore = NftStore.Instance;

        await this.nftStore.loadNftDataFromFS();

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
        console.log("UNEXPECTED ERROR HAPPENED! RESET!")
        this.reset();
      }
    }

    private async iterateThroughMissingLedgers(clientToUse:string) {

      this.currentKnownLedger = this.nftStore.getCurrentLedgerIndex();

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
              let transactions = ledgerResponse.result.ledger.transactions;

              for(let i = 0; i < transactions.length; i++) {
                if(transactions[i] && typeof(transactions[i]) === 'object') {
                  await this.analyzeTransaction(transactions[i]);
                }
              }
            }

            this.currentKnownLedger = ledgerResponse.result.ledger_index;
          }
        }

        this.nftStore.closeInternalStuff();

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

      this.client.on('ledgerClosed', async ledgerClose => {

        try {
          //we have a closed ledger. Request the transactions and try to analyze them!
          if(this.finishedIteration) {
            //console.log("ledger closed! " + ledgerClose.ledger_index);

            if((this.currentKnownLedger+1) == ledgerClose.ledger_index) {

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
                let transactions = ledgerResponse.result.ledger.transactions;

                //console.log("having transactions: " + transactions.length);

                for(let i = 0; i < transactions.length; i++) {
                  if(transactions[i]) {
                    await this.analyzeTransaction(transactions[i]);
                  }
                }
              }

              this.nftStore.setCurrentLedgerIndex(ledgerResponse.result.ledger_index);
              this.nftStore.setCurrentLedgerHash(ledgerResponse.result.ledger.ledger_hash);
              this.nftStore.setCurrentLedgerCloseTime(ledgerResponse.result.ledger.close_time_human);
              this.nftStore.setCurrentLedgerCloseTimeMs(ledgerResponse.result.ledger.close_time);

              this.nftStore.closeInternalStuff();

              this.currentKnownLedger = this.nftStore.getCurrentLedgerIndex();

              let elapsed = Date.now() - start;

              if(elapsed > 1500){
                console.log("long runnter: " + elapsed + " ms.")
              }

            } else {
              console.log("something is wrong, reset!");
              this.reset();
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
          process.exit(1);
        } else {
          console.log("RESET WITH RETRY COUNTER")
          retryCount++;
          this.start(retryCount);
        }

      } catch(err) {
        console.log(err);
        console.log("ERR WHILE RESETTING. EXIT TOOL!");
        process.exit(1);
      }
    }

    private analyzeTransaction(transaction:any) {
      if(transaction && transaction.metaData?.TransactionResult == "tesSUCCESS" && (transaction.TransactionType == "NFTokenAcceptOffer" || transaction.TransactionType == "NFTokenCancelOffer" || transaction.TransactionType == "NFTokenCreateOffer" || transaction.TransactionType == "NFTokenBurn" || transaction.TransactionType == "NFTokenMint")) {

        //console.log("analyzing NFT Transaction!")

        if(transaction.TransactionType === "NFTokenMint") { // NEW NFT
          let mintedTokenId = this.getMintedTokenId(transaction.metaData);

          if(mintedTokenId) {

            //console.log("minted token: " + mintedTokenId);

            let parsedNft = parseNFTokenID(mintedTokenId);

            let newNftEntry:NFT = {
              NFTokenID: parsedNft.NFTokenID,
              Issuer: parsedNft.Issuer,
              Owner: transaction.Account,
              Taxon: parsedNft.Taxon,
              TransferFee: parsedNft.TransferFee,
              Flags: parsedNft.Flags,
              Sequence: parsedNft.Sequence,
              URI: transaction.URI
            }

            this.nftStore.addNFT(newNftEntry);
          }

        } else if(transaction.TransactionType === "NFTokenBurn") { // BURNED NFT
          let burnedTokenId = this.getBurnedTokenId(transaction.metaData);

          if(burnedTokenId) {
            //console.log("burned token: " + burnedTokenId);

            let burnedNft = this.nftStore.getNft(burnedTokenId);
            this.nftStore.removeNft(burnedNft);
          }

        } else { // CHECK FOR OWNER CHANGE!
          let newNftOwner = this.getNewNFTOwnerAddress(transaction.metaData);
          let nftokenId = newNftOwner[0];
          let newOwnerAccount = newNftOwner[1];

          if(nftokenId && newOwnerAccount) {
            //console.log("changed nftoken: " + nftokenId + " new owner: " + newOwnerAccount);

            let existingNft = this.nftStore.getNft(nftokenId);

            if(existingNft) {
              this.nftStore.changeOwner(existingNft,newOwnerAccount);
            } else {
              console.log("THIS SHOULD NEVER HAVE HAPPENED?!?!? NEW NFT NOT POSSIBLE!")
              
              //restart tool
              process.exit(1);
            }
          }
        }

        if(transaction.TransactionType === "NFTokenCreateOffer") { // NEW NFT
          let createdOffers = this.getCreatedNFTOffers(transaction.metaData);

          if(createdOffers && createdOffers.length > 0) {
            for(let i = 0; i < createdOffers.length; i++) {
              this.nftStore.addNFTOffer(createdOffers[i]);
            }
          }

        } else if(transaction.TransactionType === "NFTokenAcceptOffer" || transaction.TransactionType === "NFTokenCancelOffer") {
          let deletedOffers = this.getDeletedNFTOffers(transaction.metaData);

          if(deletedOffers && deletedOffers.length > 0) {
            for(let i = 0; i < deletedOffers.length; i++) {
              this.nftStore.removeNftOffer(deletedOffers[i]);
            }
          }
        }
      }
    }

    private getCreatedNFTOffers(metaData: TransactionMetadata): NFTokenOffer[] {
      let createdOffers:NFTokenOffer[] = [];

      for (let affectedNodeIndex = 0, k_len = metaData.AffectedNodes.length; affectedNodeIndex < k_len; ++affectedNodeIndex) {
        let affectedNode:any = metaData.AffectedNodes[affectedNodeIndex];
        if(affectedNode?.CreatedNode?.LedgerEntryType === "NFTokenOffer") {
          let node = affectedNode.CreatedNode;

          createdOffers.push({
            Amount: node.NewFields.Amount ? node.NewFields.Amount : "0",
            Flags: node.NewFields.Flags ? node.NewFields.Flags : 0,
            NFTokenID: node.NewFields.NFTokenID,
            OfferID: node.LedgerIndex,
            Owner: node.NewFields.Owner,
            Destination: node.NewFields.Destination ? node.NewFields.Destination : null,
            Expiration: node.NewFields.Expiration ? node.NewFields.Expiration : null,
          });
        }
      }

      return createdOffers;
    }

    private getDeletedNFTOffers(metaData: TransactionMetadata): any[] {
      let deletedOffers:any[] = [];

      for (let affectedNodeIndex = 0, k_len = metaData.AffectedNodes.length; affectedNodeIndex < k_len; ++affectedNodeIndex) {
        let affectedNode:any = metaData.AffectedNodes[affectedNodeIndex];
        if(affectedNode?.DeletedNode?.LedgerEntryType === "NFTokenOffer") {
          let node = affectedNode.DeletedNode;
          deletedOffers.push({OfferID: node.LedgerIndex, Flags: node.FinalFields.Flags, NFTokenID: node.FinalFields.NFTokenID});
        }
      }

      return deletedOffers;
    }

    //analyze meta data to determine new NFToken Owner
    private getNewNFTOwnerAddress(metaData: TransactionMetadata): string[] {
      let analyzedTokens:any[] = this.getPreviousAndFinalTokens(metaData);
      let previousTokens = analyzedTokens[0];
      let finalTokens = analyzedTokens[1];

      let nftokenId:string = null;
      let newOwner:string = null;

      for (let nftokenID of Object.keys(finalTokens)) {
        if(!previousTokens.hasOwnProperty(nftokenID)) {
          console.error(`Previous and final NFToken arrays are not adding up, ${Object.keys(previousTokens).length} <> ${Object.keys(finalTokens).length}!`);
        }
        else {
          if(previousTokens[nftokenID].Owner != finalTokens[nftokenID].Owner) {
            nftokenId = nftokenID;
            newOwner = finalTokens[nftokenID].Owner;
          }
        }
      }

      return [nftokenId, newOwner];
    }

    //anylze meta data to check if NFToken was burned
    private getBurnedTokenId(metaData: TransactionMetadata): string {
      let analyzedTokens:any[] = this.getPreviousAndFinalTokens(metaData);
      let previousTokens = analyzedTokens[0];
      let finalTokens = analyzedTokens[1];

      let burnedTokenId:string = null;

      for (let nftokenID of Object.keys(previousTokens)) {
        if(!finalTokens.hasOwnProperty(nftokenID)) {
          burnedTokenId = nftokenID;
        }
      }

      return burnedTokenId;
    }

    //anylze meta data to check if NFToken was minted
    private getMintedTokenId(metaData: TransactionMetadata): string {
      let analyzedTokens:any[] = this.getPreviousAndFinalTokens(metaData);
      let previousTokens = analyzedTokens[0];
      let finalTokens = analyzedTokens[1];

      let mintedTokenId:string = null;

      for (let nftokenID of Object.keys(finalTokens)) {
        if(!previousTokens.hasOwnProperty(nftokenID)) {
          mintedTokenId = nftokenID;
        }
      }

      return mintedTokenId;
    }

    private getPreviousAndFinalTokens(metaData: TransactionMetadata): any[] {
      let previousTokens = {};
			let finalTokens = {};

      // All affected nodes are iterated and NFTokens extracted, as any change could trigger reorganisation of multiple NFTokenPages
      for (let affectedNodeIndex = 0, k_len = metaData.AffectedNodes.length; affectedNodeIndex < k_len; ++affectedNodeIndex) {
        let affectedNode:any = metaData.AffectedNodes[affectedNodeIndex];
        let node = affectedNode.CreatedNode ? affectedNode.CreatedNode : affectedNode.ModifiedNode ? affectedNode.ModifiedNode : affectedNode.DeletedNode;
        if(node.LedgerEntryType == "NFTokenPage") {
          let pageOwner = rippleAddressCodec.encodeAccountID(Buffer.from(node.LedgerIndex, 'hex').slice(0, 20));

          if(node.NewFields) {
            if(node.NewFields.NFTokens) {
              for (let nftokenIndex = 0, l_len = node.NewFields.NFTokens.length; nftokenIndex < l_len; ++nftokenIndex) {
                if(node.NewFields.NFTokens[nftokenIndex].NFToken) {
                  finalTokens[node.NewFields.NFTokens[nftokenIndex].NFToken.NFTokenID] = node.NewFields.NFTokens[nftokenIndex].NFToken;
                  finalTokens[node.NewFields.NFTokens[nftokenIndex].NFToken.NFTokenID].Owner = pageOwner;
                }
              }
            }
          }
          
          if(affectedNode.ModifiedNode && node.FinalFields) {
            if(node.PreviousFields.NFTokens && node.FinalFields.NFTokens) {
              for (let nftokenIndex = 0, l_len = node.FinalFields.NFTokens.length; nftokenIndex < l_len; ++nftokenIndex) {
                if(node.FinalFields.NFTokens[nftokenIndex].NFToken) {
                  finalTokens[node.FinalFields.NFTokens[nftokenIndex].NFToken.NFTokenID] = node.FinalFields.NFTokens[nftokenIndex].NFToken;
                  finalTokens[node.FinalFields.NFTokens[nftokenIndex].NFToken.NFTokenID].Owner = pageOwner;
                }
              }
            }
          }

          if(affectedNode.DeletedNode && node.FinalFields) {
                            if(node.FinalFields.NFTokens) {
                                for (let nftokenIndex = 0, l_len = node.FinalFields.NFTokens.length; nftokenIndex < l_len; ++nftokenIndex) {
                                    if(node.FinalFields.NFTokens[nftokenIndex].NFToken) {
                                        previousTokens[node.FinalFields.NFTokens[nftokenIndex].NFToken.NFTokenID] = node.FinalFields.NFTokens[nftokenIndex].NFToken;
                                        previousTokens[node.FinalFields.NFTokens[nftokenIndex].NFToken.NFTokenID].Owner = pageOwner;
                                    }
                                }
                            }
                        }
          
          if(node.PreviousFields) {
            if(node.PreviousFields.NFTokens) {
              for (let nftokenIndex = 0, l_len = node.PreviousFields.NFTokens.length; nftokenIndex < l_len; ++nftokenIndex) {
                if(node.PreviousFields.NFTokens[nftokenIndex].NFToken) {
                  previousTokens[node.PreviousFields.NFTokens[nftokenIndex].NFToken.NFTokenID] = node.PreviousFields.NFTokens[nftokenIndex].NFToken;
                  previousTokens[node.PreviousFields.NFTokens[nftokenIndex].NFToken.NFTokenID].Owner = pageOwner;
                }
              }
            }
          }
        }
      }

      return [previousTokens, finalTokens];
    }

    async isOfferFunded(offer: NFTokenOffer): Promise<boolean> {
      let isFunded = false;
      try {
        let availableBalance = 0;
        let offerAmount = 0;
        
        if(typeof(offer.Amount) === 'string') {
          offerAmount = Number(offer.Amount);
          availableBalance = await this.getAvailableBalanceInDrops(offer.Owner)

          console.log("available balance: " + availableBalance);
          console.log("offerAmount: " + offerAmount);

          isFunded = availableBalance >= offerAmount;
        } else {
          isFunded = await this.iouOfferIsFunded(offer.Owner, offer.Amount.issuer, offer.Amount.currency, offer.Amount.value);
        }
      } catch(err) {
        throw "err";
      }

      return isFunded;
    }

    private async iouOfferIsFunded(offerOwner:string, issuer:string, currency:string, minAmount: string) {
      let isFunded = false;

      let ripplestates = await this.getTrustlines(offerOwner);
  
      if(ripplestates && ripplestates.length > 0) {
          let minAmountNumber = Number(minAmount);
          for(let i = 0; i < ripplestates.length; i++) {
              let rippleState = ripplestates[i];
              let balance = Number(rippleState.Balance.value);
  
              if(balance < 0)
                  balance = balance * -1;
  
              if((rippleState.HighLimit.issuer === issuer && rippleState.HighLimit.currency === currency) || (rippleState.LowLimit.issuer === issuer && rippleState.LowLimit.currency === currency)) {
                  //we have correct issuer and currency
                  if(balance >= minAmountNumber) {
                      isFunded = true;
                      break;
                  }
              }
          }
      }
  
      return isFunded;
  }

  private async getTrustlines(account:string) {
    let rippleStates:RippleState[] = [];
    try {
        let accObjectRequest:AccountObjectsRequest = {
            command: 'account_objects',
            account: account,
            limit: 1000,
            type: 'state'
        }

        let accObjectResponse = await this.localClient.request(accObjectRequest);

        if(accObjectResponse && accObjectResponse.result) {
            let objects = accObjectResponse.result.account_objects;

            if(objects && objects.length > 0) { 
                for(let i = 0; i < objects.length; i++) {
                    let rippleState = objects[i];

                    if(rippleState.LedgerEntryType === 'RippleState') {
                        rippleStates.push(rippleState);
                    }
                }
            }
        }

        //console.log("getting trustlines took: " + (Date.now()-start)+ " ms.");
    } catch(err) {
        console.log(err);
        console.log(JSON.stringify(err));
    }

    return rippleStates;
}

    private async getAvailableBalanceInDrops(address: string): Promise<number> {
      let balance = 0;

      try {

        if(!this.localClient.isConnected()) {
          try {
              console.log("connecting local api...")
              this.localClient = new Client(this.localNode);
              await this.localClient.connect();
              console.log("api is connected: " + this.localClient.isConnected());
          } catch(err) {
              console.log("api is connected: " + this.localClient.isConnected());
              console.log(err);

              try {
                if(!this.localClient.isConnected()) {
                  this.localClient = new Client(this.mainNode);
                  await this.localClient.connect();
                }
              } catch(err) {
                console.log("giving up, could not connect to node.")
                throw "err";
              }
          }
        }    

        let ownAccountInfoRequest:AccountInfoRequest = {
            command: 'account_info',
            account: address                    
        }
    
        let accountInfoResponse = await this.localClient.request(ownAccountInfoRequest);
    
        if(accountInfoResponse?.result?.account_data) {
            let accountInfo = accountInfoResponse.result.account_data;
    
            balance = Number(accountInfo.Balance);
            balance = balance - 10000000; //deduct acc reserve
            balance = balance - (accountInfo.OwnerCount * 2000000); //deduct owner count
            
        } else {
          balance = 0;
        }
      } catch(err) {
        throw "err";
      }

      return balance;
  }
}