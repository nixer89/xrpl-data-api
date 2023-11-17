import * as fs from 'fs';
import * as scheduler from 'node-schedule';
import { DATA_PATH } from './util/config';

export class HookData {

    private static _instance: HookData;

    private Hook: any[] = [];
    private HookDefinition: any[] = [];
    private HookState: any[] = [];

    private current_ledger_index: number;
    private current_ledger_date: string;
    private current_ledger_time_ms: number;
    private current_ledger_hash: string;

    private constructor() { }

    public static get Instance(): HookData
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init(): Promise<void> {
        await this.loadHookDataFromFs();

        scheduler.scheduleJob("loadHookDataFromFs", "*/10 * * * *", () => this.loadHookDataFromFs());
    }

    public getHooks() {
        return this.Hook;
    }

    public getHookDefinitions() {
      return this.HookDefinition;
    }

    public getHookStates() {
      return this.HookState;
    }

    private setHook(hooks: any[]): void{
      this.Hook = hooks;
    }

    private setHookDefinition(hookDefinition: any[]): void{
      this.HookDefinition = hookDefinition;
    }

    private setHookState(hookState: any[]): void{
      this.HookState = hookState;
    }

    private async loadHookDataFromFs(): Promise<void> {
      try {
        console.log("loading ledger data from FS");
        console.log("checking: " + DATA_PATH+"hooks/hook.js");
        if(fs.existsSync(DATA_PATH+"hooks/hook.js")) {
            let hooksData = JSON.parse(fs.readFileSync(DATA_PATH+"hooks/hook.js").toString());
            if(hooksData) {
                //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
                this.setCurrentLedgerIndex(hooksData.ledger_index);
                this.setCurrentLedgerHash(hooksData.ledger_hash);
                this.setCurrentLedgerCloseTime(hooksData.ledger_close);
                this.setCurrentLedgerCloseTimeMs(hooksData.ledger_close_ms);
                this.setHook(hooksData.hooks);
            }

            console.log("Hooks loaded: " + this.getHooks().length);
        } else {
          console.log("hooksData file does not exist yet.")
        }

        if(fs.existsSync(DATA_PATH+"hooks/hookDefinitions.js")) {
          let hooksDedfinitionData = JSON.parse(fs.readFileSync(DATA_PATH+"hooks/hookDefinitions.js").toString());
          if(hooksDedfinitionData) {
              //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
              this.setHookDefinition(hooksDedfinitionData.hookDefinitions);
          }

          console.log("HookDefinitions loaded: " + this.getHookDefinitions().length);
        } else {
          console.log("hooksDefinitionData file does not exist yet.")
        }

        if(fs.existsSync(DATA_PATH+"hooks/hookStates.js")) {
          let hooksStateData = JSON.parse(fs.readFileSync(DATA_PATH+"hooks/hookStates.js").toString());
          if(hooksStateData) {
              //console.log("ledger data loaded: " + JSON.stringify(ledgerData));
              this.setHookState(hooksStateData.hookStates);
          }

          console.log("HookState loaded: " + this.getHookStates().length);
        } else {
          console.log("hooksStateData file does not exist yet.")
        }
      } catch(err) {
        console.log("error reading hooks data from FS");
        console.log(err);
      }  
    }

    public getCurrentLedgerIndex(): number {
      return this.current_ledger_index;
    }

    public setCurrentLedgerIndex(index:number): void {
        this.current_ledger_index = index;
    }

    public getCurrentLedgerHash(): string {
        return this.current_ledger_hash;
    }

    public setCurrentLedgerHash(hash:string): void {
        this.current_ledger_hash = hash;
    }

    public getCurrentLedgerCloseTime(): string {
        return this.current_ledger_date;
    }

    public setCurrentLedgerCloseTime(closeTime: string): void {
        this.current_ledger_date = closeTime;
    }

    public getCurrentLedgerCloseTimeMs(): number {
        return this.current_ledger_time_ms;
    }

    public setCurrentLedgerCloseTimeMs(closeTimeInMs: number): void {
        this.current_ledger_time_ms = closeTimeInMs;
    }
}