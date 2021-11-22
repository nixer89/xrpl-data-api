import * as config from './util/config'
import * as fetch from 'node-fetch';
import * as scheduler from 'node-schedule';
import consoleStamp = require("console-stamp");
import * as fs from 'fs';
import { IssuerVerification } from './util/types';

consoleStamp(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

export class AccountNames {

    private static _instance: AccountNames;

    private bithompServiceNames:Map<string, IssuerVerification> = new Map();
    private xrpscanUserNames:Map<string, IssuerVerification> = new Map();
    private bithompUserNames:Map<string, IssuerVerification> = new Map();
    private kycMap:Map<string, boolean> = new Map();
    private kycDistributorMap:Map<string, string> = new Map();

    private constructor() {
        //init kyc distributor account
        
        //ChorusX
        this.kycDistributorMap.set("rKk7mu1dNB25fsPEJ4quoQd5B8QmaxewKi", "rhmaAYX86K1drGCxaenoYH2GSBTReja7XH");

        //PALEOCOIN
        this.kycDistributorMap.set("rPfuLd1XmVyxkggAiT9fpLQU81GLb6UDZg", "rMuhg6cHRnNr4g4LnHrXvTrra6D47EG5wp");

        //FSE
        this.kycDistributorMap.set("rs1MKY54miDtMFEGyNuPd3BLsXauFZUSrj", "rNP3mFp8QGe1yXYMdypU7B5rXM1HK9VbDK");

        //SSE
        this.kycDistributorMap.set("rMDQTunsjE32sAkBDbwixpWr8TJdN5YLxu", "rNP3mFp8QGe1yXYMdypU7B5rXM1HK9VbDK");

        //XUM coin
        this.kycDistributorMap.set("r465PJyGWUE8su1oVoatht6cXZJTg1jc2m", "rGiMPyitoCRm4JpRyaTCzysHrifRQUVFs3");

        //Calorie Token
        this.kycDistributorMap.set("rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY", "rUWHYEdNVA7aMCqP5a4WLqtqPAAYd58K83");

        //Hadalite
        this.kycDistributorMap.set("rHiPGSMBbzDGpoTPmk2dXaTk12ZV1pLVCZ", "rwKgwydb7NRHNS8gVpG6QEP2tYqPhroYrK");
        
        //Hada
        this.kycDistributorMap.set("rsR5JSisuXsbipP6sGdKdz5agjxn8BhHUC", "rwKgwydb7NRHNS8gVpG6QEP2tYqPhroYrK");

        //SEC
        this.kycDistributorMap.set("rDN4Ux1WFJJsPCdqdfZgrDZ2icxdAmg2w", "rh3uXD4W3xb2EHCVkMHtNsRYuWgCexS5m8");

        //CCN
        this.kycDistributorMap.set("rG1bDjT25WyvPz757YC9NqdRKyz9ywF8e8", "rEzza37GjHsctYj8XgzRZaXfxt9tC53xST");

        //XPUNK
        this.kycDistributorMap.set("rHEL3bM4RFsvF8kbQj3cya8YiDvjoEmxLq", "rnakpaiPo3ELjETRZxGmyRjcfTgvkRbF4q");

        //SCS
        this.kycDistributorMap.set("rHYr9XNQJf1Kury1wGkht7Hrb9d43PqSMw", "r9h9mkbZWxbWStY2JSaTgyZXJ93ctSUzyB");

        //ZEN
        this.kycDistributorMap.set("rD2C8cVUEdu1o6hiaouxzMpZELRYnVZnh4", "rPgJHaF44SXda465SJV8qphsgZNZ8QVHvn");

        //Equilibrium
        this.kycDistributorMap.set("rpakCr61Q92abPXJnVboKENmpKssWyHpwu", "r4j8qfTo2pBV7YLJMn5Uyga13vYBvikEc6");

        //LOVE
        this.kycDistributorMap.set("rDpdyF9LtYpwRdHZs8sghaPscE8rH9sgfs", "raebqdbssZx9bJaLFo3FtBRYu6UGqSQQv9");

        //AFA
        this.kycDistributorMap.set("ratAFAXeeKaVuAxuWB9W1LuXD5m7Aqf2BH", "ratAFANfrYBBcJetey1ogtafrUfwjWsxi6");
    }

    public static get Instance(): AccountNames
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        try {
            await this.loadBithompUserNamesFromFS();
            await this.loadKycDataFromFS();

            await this.getServiceNames();

            scheduler.scheduleJob("reloadServiceNames", {hour: 12, minute: 0, second: 0}, () => this.getServiceNames());
            scheduler.scheduleJob("loadBithompUserNamesFromFS", "*/10 * * * *", () => this.loadBithompUserNamesFromFS());
            scheduler.scheduleJob("loadKycDataFromFS", "*/10 * * * *", () => this.loadKycDataFromFS());
        } catch(err) {
            console.log("ERROR INITIALIZING ACCOUNT NAMES");
        }
    }

    public async getServiceNames(): Promise<void> {
        try {
            //load bithomp services
            await this.loadBithompServiceNames();
            //load xrpscan services
            await this.loadXRPScanNames();
        } catch(err) {
            console.log(err);
            console.log("ERROR INITIALIZING SERVICE NAMES");
        }
    }

    public async loadBithompServiceNames() :Promise<void> {
        try {
            console.log("load service names from bithomp");
            let bithompResponse:any = await fetch.default("https://bithomp.com/api/v2/services/addresses", {headers: { "x-bithomp-token": config.BITHOMP_TOKEN }})
            
            if(bithompResponse && bithompResponse.ok) {
                let knownServices:any = await bithompResponse.json();
                if(knownServices && knownServices.addresses) {
                    let addresses:any = knownServices.addresses;
                    let mainName:string = knownServices.name;
                    let domain:string = knownServices.domain;
                    let twitter:string = knownServices.socialAccounts && knownServices.socialAccounts.twitter;

                    for (var address in addresses) {
                        if (addresses.hasOwnProperty(address)) {
                            let name:string = addresses[address].name;
                            name = name ? name : mainName;
                            if(name) {
                                this.bithompServiceNames.set(address, {resolvedBy: "Bithomp", account: address, username: name, domain: domain, twitter: twitter, verified: true});
                            }
                        }
                    }
                }
            }

            console.log("bithomp service names: " + this.bithompServiceNames.size);
        } catch(err) {
            console.log("err retrieving addresse from bithomp");
            console.log(err);
        }
    }

    private async loadXRPScanNames() :Promise<void> {
        try {
            console.log("load xrpscan names");
            let xrpscanResponse:any = await fetch.default("https://api.xrpscan.com/api/v1/names/well-known")
            
            if(xrpscanResponse && xrpscanResponse.ok) {
                let knownServices:any[] = await xrpscanResponse.json();
                if(knownServices) {
                    for(let i = 0; i < knownServices.length; i++) {
                        let address:string = knownServices[i].account;
                        let name:string = knownServices[i].name;
                        let domain:string = knownServices[i].domain;
                        let twitter:string = knownServices[i].twitter;
                        let verified:boolean = knownServices[i].verified;

                        if(address && name && address.length > 0 && name.length > 0) {
                            this.xrpscanUserNames.set(address, {resolvedBy: "XRPScan", account: address, username: name, domain: domain, twitter: twitter, verified: verified});
                        }
                    }
                }
            }

            console.log("xrpscan names: " + this.xrpscanUserNames.size);
        } catch(err) {
            console.log("err retrieving addresse from xrpscan");
            console.log(err);
        }
    }

    getUserName(xrplAccount:string): string {
        if(this.xrpscanUserNames.has(xrplAccount) && this.xrpscanUserNames.get(xrplAccount) != null && this.xrpscanUserNames.get(xrplAccount).username.trim().length > 0)
            return this.xrpscanUserNames.get(xrplAccount).username + "_[XRPScan]";

        else if(this.bithompServiceNames.has(xrplAccount) && this.bithompServiceNames.get(xrplAccount) != null && this.bithompServiceNames.get(xrplAccount).username.trim().length > 0)
            return this.bithompServiceNames.get(xrplAccount).username + "_[Bithomp]";
        
        else if(this.bithompUserNames.has(xrplAccount) && this.bithompUserNames.get(xrplAccount) != null && this.bithompUserNames.get(xrplAccount).username.trim().length > 0)
            return this.bithompUserNames.get(xrplAccount).username + "_[Bithomp]";

        else
            //try to resolve user name - seems like it is a new one!
            return null
    }

    getAccountData(xrplAccount:string): IssuerVerification {
        if(this.xrpscanUserNames.has(xrplAccount) && this.xrpscanUserNames.get(xrplAccount) != null)
            return this.xrpscanUserNames.get(xrplAccount);

        else if(this.bithompServiceNames.has(xrplAccount) && this.bithompServiceNames.get(xrplAccount) != null)
            return this.bithompServiceNames.get(xrplAccount);
        
        else if(this.bithompUserNames.has(xrplAccount) && this.bithompUserNames.get(xrplAccount) != null)
            return this.bithompUserNames.get(xrplAccount);

        else
            //try to resolve user name - seems like it is a new one!
            return null
    }

    getKycData(xrplAccount:string): boolean {
        //first check the issuer account KYC status
        if(this.kycMap && this.kycMap.has(xrplAccount) && this.kycMap.get(xrplAccount) != null && this.kycMap.get(xrplAccount))
            return this.kycMap.get(xrplAccount)
        //now check distributor account KYC status
        else if(this.kycDistributorMap && this.kycDistributorMap.has(xrplAccount) && this.kycDistributorMap.get(xrplAccount) != null)
            return this.kycMap.get(this.kycDistributorMap.get(xrplAccount))
        
        //nothing found, no KYC!
        else
            return false;
    }

    private async loadBithompUserNamesFromFS(): Promise<void> {
        console.log("loading bithomp user names from FS");
        try {
            if(fs.existsSync("./../bithompUserNames.js")) {
                let bithompNames:any = JSON.parse(fs.readFileSync("./../bithompUserNames.js").toString());
                //console.log(JSON.stringify(bithompNames));
                if(bithompNames) {
                    for (var account in bithompNames) {
                        if (bithompNames.hasOwnProperty(account)) {
                            this.bithompUserNames.set(account, bithompNames[account] != null ? bithompNames[account] : "");
                        }
                    }

                    console.log("loaded " + this.bithompUserNames.size + " user names from file system");
                }
            } else {
                console.log("bithomp user name file does not exist yet.")
            }
        } catch(err) {
            console.log("error reading bithomp user names from FS");
            console.log(err);
            this.bithompUserNames.clear();
        }
    }

    private async loadKycDataFromFS(): Promise<void> {
        console.log("loading kyc data from FS");
        try {
            if(fs.existsSync("./../kycData.js")) {
                let kycData:any = JSON.parse(fs.readFileSync("./../kycData.js").toString());
                //console.log(JSON.stringify(bithompNames));
                if(kycData) {
                    for (var account in kycData) {
                        if (kycData.hasOwnProperty(account)) {
                            this.kycMap.set(account, kycData[account]);
                        }
                    }

                    console.log("loaded " + this.kycMap.size + " kyc data from file system");
                }
            } else {
                console.log("kyc data file does not exist yet.")
            }
        } catch(err) {
            console.log("error reading kyc data file from FS");
            console.log(err);
            this.kycMap.clear();
        }
    }
}