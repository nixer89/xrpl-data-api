import Aedes from 'aedes';
import { createServer, Server } from 'aedes-server-factory';

const port = 1883

require("log-timestamp");


export class AedesServer {

    private static _instance: AedesServer;

    private constructor() { }

    public static get Instance(): AedesServer
    {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    httpServer:Server = null;
    aedes = new Aedes();

    async initAedesServer() {
        this.httpServer = createServer(this.aedes.handle, { ws: true });
        
        this.httpServer.listen(port, '127.0.0.1', () => console.log("Aedes websocket server started on port: " + port));

    }

    async publishMessage(topic: string, message: any) {
        this.aedes.publish({topic: topic, payload: message}, (err) => {
            if(err) {
                console.log("COULD NOT PUBLISH:");
                console.log(err);
            }
        });
    }
}