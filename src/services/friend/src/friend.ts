import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from './utils/db/database';
import { friends, users } from './utils/db/tables';
import { eq, and, or} from 'drizzle-orm';
import { authGuard } from './utils/security/authGuard';
import { STATUS, MESSAGE, schema} from './utils/http-reply';


export async function tcheckFriends(user_1 : number, user_2: number) :Promise<boolean>
	{
		const res = await db.select({id:friends.id }).from(friends).where(and(
			eq(friends.status, "accepted"), or( and(
				eq(friends.senderId, user_1), eq(friends.receiverId, user_2)), and(
				eq(friends.senderId,user_2), eq(friends.receiverId, user_1))))).limit(1);
				return res.length > 0;
	}

class friend {
	setup(app: FastifyInstance) {
		app.post("/api/friend/request", {preHandler: authGuard, schema: schema.body({displayName: "string"}, ["displayName"])}, this.sendRequest);

		app.patch("/api/friend/accept", {preHandler: authGuard, schema: schema.body({displayName: "string"}, ["displayName"])}, this.acceptRequest);
		app.patch("/api/friend/decline", {preHandler: authGuard, schema: schema.body({displayName: "string"}, ["displayName"])}, this.declineRequest);

		app.get("/api/friend", {preHandler: authGuard}, this.getFriends);
		app.get("/api/friend/requests", {preHandler: authGuard}, this.getPendingRequests);
		app.get("/api/friend/status", {preHandler: authGuard, schema: schema.query({displayName: "string"}, ["displayName"])}, this.getFriendStatus);
		app.delete("/api/friend/remove", {preHandler: authGuard, schema: schema.body({displayName: "string"}, ["displayName"])}, this.removeFriend);

		app.post("/api/friend/block", {preHandler: authGuard, schema: schema.body({ displayName:"string"}, ["displayName"]) }, this.blockUser);
		app.post("/api/friend/unblock", {preHandler: authGuard, schema: schema.body({ displayName:"string"}, ["displayName"]) }, this.unBlockUser);
		app.post("/api/friend/blockedme", {preHandler: authGuard, schema: schema.body({ displayName:"string"}, ["displayName"]) }, this.userBlockedMe);
		app.post("/api/friend/isblocked", {preHandler: authGuard, schema: schema.body({ displayName:"string"}, ["displayName"]) }, this.isBlocked);
	}

	async sendRequest(req: FastifyRequest, rep: FastifyReply)
	{
		const usr = req.user!;
		const {displayName} = req.body as {displayName: string};

		if (!displayName)
				return rep.code(STATUS.bad_request).send({message: "Missing displayName"});
		if (displayName === usr.displayName)
				return rep.code(STATUS.bad_request).send({message: "You cannot add yourself"});
		
		const [targetUser] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!targetUser)
			return rep.code(STATUS.not_found).send({message : MESSAGE.user_notfound});

		const [isBlocked] = await db.select().from(friends).where(and(
			or(
				and(eq(friends.senderId, usr.id), eq(friends.receiverId, targetUser.id)),
				and(eq(friends.receiverId, usr.id), eq(friends.senderId, targetUser.id)),
			),
			eq(friends.status, "block"),
		));
		if (isBlocked)
			return rep.code(STATUS.bad_request).send({message: "Friend request failed"});

		const mutualRequest = await db.select().from(friends).where(
			and(eq(friends.senderId, targetUser.id), eq(friends.receiverId, usr.id), eq(friends.status, "pending")));
		if (mutualRequest.length > 0) {
			await db.update(friends).set({status : "accepted"}).where(eq(friends.id, mutualRequest[0].id));
			return rep.code(STATUS.success).send({message : "Friend request auto accepted (mutual request)"});
		}

		const [friendExists] =  await db.select().from(friends).where(or(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, targetUser.id)),
			and(eq(friends.senderId, targetUser.id), eq(friends.receiverId, usr.id)),
		));
		if (friendExists) {
			if (friendExists.status === "accepted")
				return rep.code(STATUS.bad_request).send({message: "You are already friends"});
			if (friendExists.status === "pending")
				return rep.code(STATUS.bad_request).send({message: "Request already sent"});
			if (friendExists.status === "declined") {
				await db.update(friends).set({status: "pending", senderId: usr.id, receiverId: targetUser.id}).where(eq(friends.id, friendExists.id));
				return rep.code(STATUS.success).send({message: "Friend request sent"});
			}
		}

		await db.insert(friends).values({
			senderId: usr.id,
			receiverId: targetUser.id,
			status: "pending",
		});

		return rep.code(STATUS.success).send({message: "Friend request sent"});
	}

	async acceptRequest(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const {displayName} = req.body as {displayName: string};

		if (!displayName)
				return rep.code(STATUS.bad_request).send({message: "Missing displayName"});

		const [sender] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!sender)
			return rep.code(STATUS.not_found).send({message: MESSAGE.user_notfound});

		const [request] = await db.select().from(friends).where(and(
			eq(friends.senderId, sender.id),
			eq(friends.receiverId, usr.id),
			eq(friends.status, "pending")
		));
		if (!request)
			return rep.code(STATUS.not_found).send({message: "No pending request found"});
		await db.update(friends).set({status: "accepted"}).where(eq(friends.id, request.id));

		return rep.code(STATUS.success).send({message: "Friend request accepted"});
	}

	async declineRequest(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const {displayName} = req.body as {displayName: string};

		if (!displayName)
				return rep.code(STATUS.bad_request).send({message: "Missing displayName"});

		const [sender] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!sender)
			return rep.code(STATUS.not_found).send({message: MESSAGE.user_notfound});

		const [request] = await db.select().from(friends).where(and(
			eq(friends.senderId, sender.id),
			eq(friends.receiverId, usr.id),
			eq(friends.status, "pending")
		));
		if (!request)
			return rep.code(STATUS.not_found).send({message: "No pending request found"});
		await db.update(friends).set({status: "declined"}).where(eq(friends.id, request.id));

		return rep.code(STATUS.success).send({message: "Friend request declined"});
	}

	async getFriends(req: FastifyRequest, rep:FastifyReply) {
		const usr = req.user!;

		const result = await db.select({
			displayName: users.displayName,
			avatar: users.avatar,
			isOnline: users.isOnline,
			username: users.username,
			uuid: users.uuid,
		})
		.from(friends).innerJoin(users, or(eq(users.id, friends.senderId), eq(users.id, friends.receiverId)))
		.where(and(
			or(eq(friends.senderId, usr.id), eq(friends.receiverId, usr.id)), 
			eq(friends.status, "accepted")));

		const friendsList = result.filter(f => f.displayName !== usr.displayName);

		return rep.code(STATUS.success).send({friends: friendsList});
	}

	async getPendingRequests(req: FastifyRequest, rep: FastifyReply)
	{
		const usr = req.user!;

		const pending = await db.select({
			requestFrom: users.displayName,
			avatar: users.avatar,

		})
		.from(friends).innerJoin(users, eq(users.id, friends.senderId))
		.where(and(eq(friends.receiverId, usr.id), eq(friends.status, "pending")));

		return rep.code(STATUS.success).send({requests: pending});
	}

	async removeFriend(req: FastifyRequest, rep: FastifyReply)
	{
		const usr = req.user!;
		const {displayName} = req.body as {displayName: string};

		if (!displayName)
			return rep.code(STATUS.bad_request).send({message: "Missing displayName"})
		const [target] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!target)
			return rep.code(STATUS.not_found).send({message: MESSAGE.user_notfound});

		const [friendExists] =  await db.select().from(friends).where(or(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, target.id)),
			and(eq(friends.senderId, target.id), eq(friends.receiverId, usr.id)),
			eq(friends.status, "accepted")
		));
		if (!friendExists)
			return rep.code(STATUS.bad_request).send({message: "You are not friend with this user"});

		await db.delete(friends)
		.where(or(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, target.id)),
			and(eq(friends.senderId, target.id), eq(friends.receiverId, usr.id))
		));

		return rep.code(STATUS.success).send({message: "Friend removed"});
	}
	
	async blockUser(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const { displayName } = req.body as { displayName: string };

		const [targetUsr] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!targetUsr)
			return rep.code(STATUS.bad_request).send({ message: "User not found" });

		await db.delete(friends)
		.where(or(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, targetUsr.id)),
			and(eq(friends.senderId, targetUsr.id), eq(friends.receiverId, usr.id))
		));

		await db.insert(friends).values({
			senderId: usr.id,
			receiverId: targetUsr.id,
			status: "block",
		});

		return rep.code(STATUS.success).send({ message: "User blocked" });
	}

	async unBlockUser(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		const { displayName } = req.body as { displayName: string };

		const [targetUsr] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!targetUsr)
			return rep.code(STATUS.bad_request).send({ message: "User not found" });

		await db.delete(friends)
		.where(or(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, targetUsr.id)),
			and(eq(friends.senderId, targetUsr.id), eq(friends.receiverId, usr.id))
		));

		return rep.code(STATUS.success).send({ message: "User unblocked" });
	}

	async isBlocked(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		let blocked = false;

		const { displayName } = req.body as { displayName: string };

		const [targetUsr] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!targetUsr)
			return rep.code(STATUS.bad_request).send({ message: "User not found" });

		const [isBlocked] = await db.select().from(friends).where(and(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, targetUsr.id)),
			eq(friends.status, "block")
		));

		if (!isBlocked)
			return rep.code(STATUS.success).send({ blocked });
		blocked = true;
		return rep.code(STATUS.success).send({ blocked });
	}

	async userBlockedMe(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		let blocked = false;

		const { displayName } = req.body as { displayName: string };

		const [targetUsr] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!targetUsr)
			return rep.code(STATUS.bad_request).send({ message: "User not found" });

		const [isBlocked] = await db.select().from(friends).where(and(
			and(eq(friends.receiverId, usr.id), eq(friends.senderId, targetUsr.id)),
			eq(friends.status, "block")
		));

		if (!isBlocked)
			return rep.code(STATUS.success).send({ blocked });
		blocked = true;
		return rep.code(STATUS.success).send({ blocked });
	}

	async getFriendStatus(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const {displayName} = req.query as {displayName: string};
		let status = "not sent";

		if (!displayName)
			return rep.code(STATUS.bad_request).send({message: "Missing displayName"})
		const [target] = await db.select().from(users).where(eq(users.displayName, displayName));
		if (!target)
			return rep.code(STATUS.not_found).send({message: MESSAGE.user_notfound});

		if(await tcheckFriends(usr.id, target.id))
			return rep.code(STATUS.success).send({status : "accepted"});

		const [friendExists] = await db.select().from(friends).where(or(
			and(eq(friends.senderId, usr.id), eq(friends.receiverId, target.id)),
			and(eq(friends.senderId, target.id), eq(friends.receiverId, usr.id))));
		
		if (friendExists)
		{
			if (friendExists.status == "pending")
			{
				if (friendExists.senderId === usr.id)
					status = "pending_out";
				else
					status = "pending_in";
			}
			else status = friendExists.status;
		}

		return rep.code(STATUS.success).send({status: status});
	}
}


const service = new friend();
export const friendService = service;
