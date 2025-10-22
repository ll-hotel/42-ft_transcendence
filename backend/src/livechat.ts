import { FastifyInstance, FastifyRequest } from "fastify";

export function liveChatModule(fastify: FastifyInstance) {
	fastify.get("/api/chat", { websocket: true }, wsConnected);
}

type ChatRoom = {
	owner_uuid: string;
	users: WebSocket[];
};

type Chat = {
	rooms: ChatRoom[];
};

const chat: Chat = {
	rooms: [],
};

function wsConnected(ws: WebSocket, req: FastifyRequest) {
	ws.addEventListener("close", () => {
	});
	ws.addEventListener("message", (message) => {
		console.log(message.data);
	});
	ws.send("connected");
}
