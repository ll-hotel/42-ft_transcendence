import * as orm from "drizzle-orm";
import fs from "fs";
import https from "https";
import * as Ws from "ws";
import { db } from "./utils/db/database";
import * as dbM from "./utils/db/methods";
import * as tables from "./utils/db/tables";

export default function(user: tables.User, ws: Ws.WebSocket) {
	if (services.has(user.uuid)) {
		ws.close();
		return;
	}
	db.update(tables.users).set({ isOnline: 1 }).where(orm.eq(tables.users.id, user.id)).prepare().execute().sync();
	ws.on("close", () => {
		setTimeout(async () => {
			if (!services.has(user.uuid)) {
				await dbM.setUserOffline(user.uuid);
			}
		}, 1000);
	});
	services.set(user.uuid, new ClientServices(user.uuid, ws));
}

const agent = new https.Agent({ ca: fs.readFileSync(`/run/secrets/certificate.pem`), rejectUnauthorized: false });

const serviceList = ["auth", "tournament", "chat", "queue", "game"].map(name => {
	return {
		name: name,
		agent,
	};
});

class ClientServices {
	uuid: string;
	conn: Ws.WebSocket;
	services: { [key: string]: Ws.WebSocket | null } = {};

	constructor(uuid: string, conn: Ws.WebSocket) {
		this.uuid = uuid;
		this.conn = conn;
		this.connectServices();
	}

	connectServices(): void {
		this.conn.on("message", (stream) => this.dispatchMessage(stream.toString()));
		this.conn.on("close", () => this.disconnect());
		this.conn.on("error", () => {});
		for (const service of serviceList) {
			this.connectService(service.name, service.agent);
		}
	}
	connectService(name: string, agent: https.Agent) {
		let sock: Ws.WebSocket;
		try {
			sock = new Ws.WebSocket(`wss://${name}-service:8080/websocket?uuid=${this.uuid}`, { agent });
		} catch (error) {
			return console.log(error);
		}
		sock.on("open", () => console.log(`[${this.uuid}] ${name} connected`));
		sock.on("error", () => {});
		sock.on("close", (code) => {
			this.services[name] = null;
			waitClose(sock).then(() => {
				// 1006 = Crash, brutal interruption, terminated.
				if (code == 1006) {
					console.log(`[${this.uuid}] ${name} closed unexpectedly`);
					this.connectService(name, agent);
					return;
				} else if (name == "auth") this.disconnect();
				console.log(`[${this.uuid}] ${name} closed`);
			});
		});
		sock.on("message", (stream) => safeSend(this.conn, stream.toString()));
		this.services[name] = sock;
	}
	dispatchMessage(data: string): void {
		let json;
		try {
			json = JSON.parse(data);
			console.log(`[${this.uuid}] incoming:`, json);
		} catch (error) {
			console.log(`[${this.uuid}] error: ${error}`);
			return;
		}
		let service: Ws.WebSocket | null = null;
		for (const serviceName in this.services) {
			if (serviceName == json.service) {
				service = this.services[serviceName];
				break;
			}
		}
		if (service) {
			safeSend(service, data);
		} else {
			const message = { topic: "unavailable", service: json.service };
			safeSend(this.conn, JSON.stringify(message));
		}
	}
	disconnect(): void {
		for (const name in this.services) {
			if (this.services[name] && this.services[name].readyState == Ws.WebSocket.OPEN) {
				this.services[name].close();
			}
		}
		if (this.conn.readyState == this.conn.OPEN) {
			this.conn.close();
		}
		services.delete(this.uuid);
	}
}

function safeSend(conn: Ws.WebSocket, data: string): void {
	if (conn.readyState == conn.OPEN) {
		conn.send(data, (err) => {
			if (err) console.log(err);
		});
	}
}

function waitClose(conn: Ws.WebSocket): Promise<void> {
	return new Promise(resolve => {
		const timeout = () => {
			if (conn.readyState == conn.CLOSED) {
				resolve();
			} else {
				setTimeout(timeout, 200);
			}
		};
		timeout();
	});
}

const services = new Map<string, ClientServices>();
