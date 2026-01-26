import * as orm from "drizzle-orm";
import { db } from "./utils/db/database";
import * as dbM from "./utils/db/methods";
import * as tables from "./utils/db/tables";
import clientSocketPool from "./utils/socket";

export default function(user: tables.User, websocket: WebSocket) {
	const isNewClient = clientSocketPool.clients.get(user.uuid) === undefined;

	clientSocketPool.connect(user.uuid, websocket);

	db.update(tables.users).set({ isOnline: 1 }).where(orm.eq(tables.users.id, user.id)).prepare().execute();

	if (isNewClient === false) {
		return;
	}
	clientSocketPool.addListener(user.uuid, "disconnect", () => {
		setTimeout(() => {
			if (clientSocketPool.isOnline(user.uuid)) {
				return;
			}
			dbM.removeUserFromTournaments(user.uuid);
			dbM.setUserOffline(user.uuid);
		}, 2000);
	});
	services.set(user.uuid, new ClientServices(user.uuid));
}

class ClientServices {
	uuid: string;
	services: { [key: string]: WebSocket | null } = {};

	constructor(uuid: string) {
		this.uuid = uuid;
		this.connectServices();
	}

	connectServices(): void {
		clientSocketPool.addListener(this.uuid, "message", (json) => this.dispatchMessage(json));
		clientSocketPool.addListener(this.uuid, "disconnect", () => {
			for (const name in this.services) {
				this.services[name]?.close();
			}
		});
		// this.connect("chat");
		this.connectService("tournament");
		// this.connect("queue");
		// this.connect("game");
	}
	connectService(name: string) {
		try {
			this.services[name] = new WebSocket(
				`https://${name}-service:8080/api/${name}/websocket`,
			);
			const ws = this.services[name];
			ws.addEventListener("close", () => {
				this.services[name] = null;
				this.connectService(name);
			});
			ws.addEventListener("message", (event) => clientSocketPool.sendRaw(this.uuid, event));
		} catch (error) {
			if (error) console.log(error);
		}
	}
	dispatchMessage(message: MessageEvent): void {
		let json;
		try {
			json = JSON.parse(message.data);
		} catch {
			return;
		}
		let service: WebSocket | null = null;
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
			clientSocketPool.send(this.uuid, message);
		}
	}
}

const services = new Map<string, ClientServices>();
