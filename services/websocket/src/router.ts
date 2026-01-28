import * as orm from "drizzle-orm";
import fs from "fs";
import https from "https";
import * as WebSocket from "ws";
import { db } from "./utils/db/database";
import * as dbM from "./utils/db/methods";
import * as tables from "./utils/db/tables";
import socketPool from "./utils/socket";

export default function(user: tables.User, ws: WebSocket.WebSocket) {
	const isNewClient = socketPool.clients.get(user.uuid) === undefined;

	socketPool.connect(user.uuid, ws);

	db.update(tables.users).set({ isOnline: 1 }).where(orm.eq(tables.users.id, user.id)).prepare().execute();

	if (isNewClient === false) {
		return;
	}
	socketPool.addListener(user.uuid, "disconnect", () => {
		setTimeout(() => {
			if (socketPool.isOnline(user.uuid)) {
				return;
			}
			dbM.setUserOffline(user.uuid);
		}, 1000);
	});
	services.set(user.uuid, new ClientServices(user.uuid));
}

const serviceList = ["tournament", "chat", "queue", "game"].map(name => {
	return {
		name: name,
		agent: new https.Agent({ ca: fs.readFileSync(`/run/cert/${name}/certificate.pem`), rejectUnauthorized: false }),
	};
});

class ClientServices {
	uuid: string;
	services: { [key: string]: WebSocket.WebSocket | null } = {};

	constructor(uuid: string) {
		this.uuid = uuid;
		this.connectServices();
	}

	connectServices(): void {
		socketPool.addListener(this.uuid, "message", (json) => this.dispatchMessage(json));
		socketPool.addListener(this.uuid, "disconnect", () => {
			for (const name in this.services) {
				this.services[name]?.close();
			}
			services.delete(this.uuid);
		});
		for (const service of serviceList) {
			this.connectService(service.name, service.agent);
		}
	}
	connectService(name: string, agent: https.Agent) {
		let sock: WebSocket.WebSocket;
		try {
			sock = new WebSocket.WebSocket(`wss://${name}-service:8080/websocket?uuid=${this.uuid}`, { agent });
		} catch (error) {
			return console.log(error);
		}
		sock.on("error", (error) => {
			console.log(error);
		});
		sock.on("close", (code, reason) => {
			console.log("Service " + name + " closed connection: code " + code + ": reason: " + reason);
			this.services[name] = null;
			this.connectService(name, agent);
		});
		sock.on("message", (data) => {
			socketPool.sendRaw(this.uuid, data.toString());
		});
		this.services[name] = sock;
	}
	dispatchMessage(message: MessageEvent): void {
		let json;
		try {
			json = JSON.parse(message.data);
		} catch {
			return;
		}
		let service: WebSocket.WebSocket | null = null;
		for (const serviceName in this.services) {
			if (serviceName == json.topic) {
				service = this.services[serviceName];
				break;
			}
		}
		if (service) {
			service.send(message.data);
		} else {
			const message = { topic: "unavailable", service: json.topic };
			socketPool.send(this.uuid, message);
		}
	}
}

const services = new Map<string, ClientServices>();
