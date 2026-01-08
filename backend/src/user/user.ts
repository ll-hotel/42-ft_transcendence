import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authGuard, } from "../security/authGuard";
import { MESSAGE, STATUS } from "../shared";
import { db } from "../db/database";
import { matches, users } from "../db/tables";
import { eq, or, and, desc } from "drizzle-orm";
import { comparePassword, hashPassword } from "../security/hash";
import { generate2FASecret, generateQRCode } from "../security/2fa";

const REGEX_USERNAME = /^[a-zA-Z0-9]{3,24}$/;
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class User {
	static setup(app: FastifyInstance) {
		app.get("/api/me", { preHandler: authGuard }, User.getMe);
		app.get("/api/users", { preHandler: authGuard }, User.getUser);
		app.get("/api/user/history", { preHandler: authGuard }, User.getHistory);

		app.patch("/api/user/profile", { preHandler: authGuard }, User.updateProfile);
		app.patch("/api/user/password", { preHandler: authGuard }, User.updatePassword);
		app.patch("/api/user/2fa", { preHandler: authGuard }, User.update2fa);
	}

	static async getMe(req: FastifyRequest, rep: FastifyReply) {
		if (!req.user) {
			return (rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized }));
		}
		rep.code(STATUS.success).send({
			displayName: req.user.displayName,
			username: req.user.username,
			avatar: req.user.avatar
		});
	}

	static async getUser(req: FastifyRequest, rep: FastifyReply) {
		const { displayName } = req.query as { displayName?: string };

		if (!displayName || REGEX_USERNAME.test(displayName) === false)
			return (rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName }));

		const usr = await db.select({
			uuid: users.uuid,
			displayName: users.displayName,
			avatar: users.avatar,
			isOnline: users.isOnline,

		})
			.from(users).where(eq(users.displayName, displayName));

		if (usr.length === 0)
			return rep.code(STATUS.not_found).send({ message: MESSAGE.user_notfound });

		return rep.code(STATUS.success).send({ user: usr[0] });
	}

	static async getallUsers(req: FastifyRequest, rep: FastifyReply) {

		const allUsers = await db.select({
			uuid: users.uuid,
			displayName: users.displayName,
			avatar: users.avatar,
			isOnline: users.isOnline,

		})
			.from(users);

		if (allUsers.length === 0)
			return rep.code(STATUS.not_found).send({ message: MESSAGE.no_users });

		return rep.code(STATUS.success).send({ users: allUsers });
	}



	static async updateProfile(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user;
		const { displayName, avatar } = req.body as { displayName?: string, avatar?: string };
		const data: any = {}

		if (!displayName && !avatar)
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_fields })

		if (displayName) {
			if (REGEX_USERNAME.test(displayName) === false)
				return (rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName }));
			const exists = await db.select().from(users).where(eq(users.displayName, displayName));
			if (exists.length != 0)
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.displayName_taken });
			data.displayName = displayName;
		}
		if (avatar)
			data.avatar = avatar;

		await db.update(users).set(data).where(eq(users.id, usr!.id));

		return rep.code(STATUS.success).send({ message: "Profile updated" });
	}

	static async updatePassword(req: FastifyRequest, rep: FastifyReply) {
		const usrId = req.user!.id;
		const { currentPassword, newPassword } = req.body as { currentPassword: string, newPassword: string };

		if (!currentPassword || !newPassword)
			return rep.code(STATUS.bad_request).send({ message: "Missing password" });
		if (REGEX_PASSWORD.test(newPassword) === false)
			return rep.code(STATUS.bad_request).send({ message: "Invalid new password" });

		const [usr] = await db.select().from(users).where(eq(users.id, usrId));

		if (await comparePassword(currentPassword, usr.password) === false)
			return rep.code(STATUS.bad_request).send({ message: "Current password is incorrect" })

		if (await comparePassword(newPassword, usr.password) === true)
			return rep.code(STATUS.bad_request).send({ message: "New password cannot be same as old one" });

		const hashed = await hashPassword(newPassword);
		await db.update(users).set({ password: hashed }).where(eq(users.id, usrId));

		rep.code(STATUS.success).send({ message: "Password updated" });
	}

	static async update2fa(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const { enable } = req.body as { enable: boolean };

		// add password check ?

		if (enable) {
			if (usr.twofaEnabled === 1)
				return rep.code(STATUS.bad_request).send({ message: "2FA is arleady enabled" });
			const secret = generate2FASecret(usr.username);
			if (!secret.otpauth_url)
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.fail_gen2FAurl });
			const qrCode = await generateQRCode(secret.otpauth_url);
			await db.update(users).set({ twofaKey: secret.base32, twofaEnabled: 1 }).where(eq(users.id, usr.id));

			return rep.code(STATUS.success).send({ message: "2FA enabled", qrCode });
		}
		else {
			await db.update(users).set({ twofaKey: null, twofaEnabled: 0 }).where(eq(users.id, usr.id));
			return rep.code(STATUS.success).send({ message: "2FA disabled" });
		}
	}

	static async getHistory(req: FastifyRequest, rep:FastifyReply) {
		const usr = req.user!;
		const matchesList = await db.select().from(matches).where(and(
			(or(eq(matches.player2Id, usr.id), eq(matches.player1Id, usr.id),
			eq(matches.status, "ended"))))).limit(5).orderBy(desc(matches.endedAt));

		return rep.code(STATUS.success).send(matchesList);
	}
}

export async function getUserIdByUsername(username: string): Promise<number | null> {
	const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
	return user ? user.id : null;
}

export default function(fastify: FastifyInstance) {
	User.setup(fastify);
}
