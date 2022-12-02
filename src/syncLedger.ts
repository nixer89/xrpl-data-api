import { NFT } from './util/types';
import { Client, LedgerRequest, LedgerResponse, parseNFTokenID, TransactionMetadata } from 'xrpl';
import * as rippleAddressCodec from 'ripple-address-codec';
import { NftStore } from './nftokenStore';


export class LedgerSync {

    private static _instance: LedgerSync;

    private client = new Client("wss://xrplcluster.com");

    private finishedIteration:boolean = false;

    private nftStore:NftStore;
    private currentKnownLedger: number = 0;

    private constructor() { }

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

        if(retryCount > 10) {
          console.log("COULD NOT CONNECT TO NODE! SWITCHING!")
          this.client = new Client("ws://127.0.0.1:6006")
        } else if(retryCount > 20) {
          //force restart by pm2
          process.exit(1);
        } else {
          this.client = new Client("wss://xrplcluster.com")
        }

        this.nftStore = NftStore.Instance;

        await this.nftStore.loadNftDataFromFS();

        //reinitialize client
        this.client.on('disconnected', async ()=> {
          console.log("DISCONNECTED!!! RECONNECTING!")
          this.reset(0);
        });

        this.client.on('error', async () => {
          console.log("ERROR HAPPENED! Re-Init!");
          this.reset(0);
        });

        this.client.on('connected',() => {
          console.log("Connected.")
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
        await this.iterateThroughMissingLedgers("ws://127.0.0.1:6006");
      } catch(err) {
        console.log("UNEXPECTED ERROR HAPPENED! RESET!")
        this.reset(retryCount);
      }
    }

    private async iterateThroughMissingLedgers(clientToUse:string) {

      this.currentKnownLedger = this.nftStore.getCurrentLedgerIndex();

      console.log("STARTING ITERATION AT LEDGER: " + this.currentKnownLedger + " WITH CLIENT: " + clientToUse);

      try {
        //try sync from local node!
        let iterationClient = new Client(clientToUse)

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

      } catch(err) {
        console.log("err 1")
        console.log(err);
        if(err.data.error === 'lgrNotFound') {
          //restart by iterating with xrplcluster.com!
          await this.iterateThroughMissingLedgers("wss://xrplcluster.com");
        } else {
          this.reset(0);
        }
      }

      this.nftStore.closeInternalStuff();

      console.log("FINISHED SYNCING BACK!")
    }

    private async startListeningOnLedgerClose() {

      this.client.on('ledgerClosed', async ledgerClose => {

        try {
          //we have a closed ledger. Request the transactions and try to analyze them!
          if(this.finishedIteration) {
            //console.log("ledger closed! " + ledgerClose.ledger_index);

            if((this.currentKnownLedger+1) == ledgerClose.ledger_index) {

              console.time("analyzeLedger_"+ledgerClose.ledger_index);
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

              console.timeEnd("analyzeLedger_"+ledgerClose.ledger_index);
            } else {
              console.log("something is wrong, reset!");
              this.reset(0);
            }
          } else {
            console.log("Ledger closed but waiting for catch up! current ledger: " + this.currentKnownLedger + " | last closed ledger: " + ledgerClose.ledger_index);
          }
        } catch(err) {
          console.log("err 2")
          console.log(err);

          this.reset(0);
        }
      });     
    }

    private async reset(retryCount:number) {
      try {
        retryCount++;
        this.start(retryCount);

      } catch(err) {
        console.log(err);
        console.log("ERR WHILE RESETTING");
      }
    }

    private analyzeTransaction(transaction:any) {
      if(transaction && transaction.metaData?.TransactionResult == "tesSUCCESS" && (transaction.TransactionType == "NFTokenAcceptOffer" || transaction.TransactionType == "NFTokenCancelOffer" || transaction.TransactionType == "NFTokenCreateOffer" || transaction.TransactionType == "NFTokenBurn" || transaction.TransactionType == "NFTokenMint")) {

        //console.log("analyzing NFT Transaction!")

        if(transaction.TransactionType === "NFTokenMint") { // NEW NFT
          let mintedTokenId = this.getMintedTokenId(transaction.metaData);

          if(mintedTokenId) {

            console.log("minted token: " + mintedTokenId);

            let parsedNft = parseNFTokenID(mintedTokenId);

            let newNftEntry:NFT = {
              NFTokenID: parsedNft.NFTokenID,
              Issuer: transaction.Account,
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
            console.log("burned token: " + burnedTokenId);

            let burnedNft = this.nftStore.getNft(burnedTokenId);
            this.nftStore.removeNft(burnedNft);
          }

        } else { // CHECK FOR OWNER CHANGE!
          let newNftOwner = this.getNewNFTOwnerAddress(transaction.metaData);
          let nftokenId = newNftOwner[0];
          let newOwnerAccount = newNftOwner[1];

          if(nftokenId && newOwnerAccount) {
            console.log("changed nftoken: " + nftokenId + " new owner: " + newOwnerAccount);

            let existingNft = this.nftStore.getNft(nftokenId);

            if(existingNft) {
              existingNft.Owner = newOwnerAccount;
              this.nftStore.addNFT(existingNft);
            } else {
              console.log("THIS SHOULD NEVER HAVE HAPPENED?!?!? NEW NFT NOT POSSIBLE!")
              let parsedNft = parseNFTokenID(nftokenId);

              let newNftEntry:NFT = {
                NFTokenID: parsedNft.NFTokenID,
                Issuer: transaction.Account,
                Owner: transaction.Account,
                Taxon: parsedNft.Taxon,
                TransferFee: parsedNft.TransferFee,
                Flags: parsedNft.Flags,
                Sequence: parsedNft.Sequence,
                URI: transaction.URI
              }

              this.nftStore.addNFT(newNftEntry);
            }
          }
        }
      }
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
}