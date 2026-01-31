import fs from "fs";
import sharp from "sharp";

import { randomBytes } from "crypto";
import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "./utils/db/database";
import * as tables from "./utils/db/tables";
import { MESSAGE, schema, STATUS } from "./utils/http-reply";
import { generate2FASecret, generateQRCode, verify2FAToken } from "./utils/security/2fa";
import { authGuard as preHandler } from "./utils/security/authGuard";
import { comparePassword, hashPassword } from "./utils/security/hash";

const REGEX_USERNAME = /^(?=[a-zA-Z].*)[a-zA-Z0-9-]{3,24}$/;
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class User {
	static setup(app: FastifyInstance) {
		app.get("/api/user/me", { preHandler }, User.getMe);
		app.get(
			"/api/user",
			{ preHandler, schema: schema.query({ displayName: "string", username: "string" }) },
			User.getUser,
		);
		app.get("/api/user/all", { preHandler }, User.getallUsers);
		app.get("/api/user/me/history", { preHandler }, User.getMyHistory);
		app.get(
			"/api/user/history",
			{ preHandler, schema: schema.query({ displayName: "string" }, ["displayName"]) },
			User.getUserHistory,
		);
		app.get("/api/user/me/stats", { preHandler }, User.getMyStat);
		app.get(
			"/api/user/stats",
			{ preHandler, schema: schema.query({ displayName: "string" }, ["displayName"]) },
			User.getUserStat,
		);

		app.patch(
			"/api/user/profile",
			{ preHandler, schema: schema.body({ displayName: "string" }, ["displayName"]) },
			User.updateProfile,
		);
		app.patch("/api/user/password", {
			preHandler,
			schema: schema.body({ currentPassword: "string", newPassword: "string" }, [
				"currentPassword",
				"newPassword",
			]),
		}, User.updatePassword);
		app.patch(
			"/api/user/twofa",
			{ preHandler, schema: schema.body({ enable: "boolean" }, ["enable"]) },
			User.updateTwofa,
		);
		app.post(
			"/api/user/twofa/activate",
			{ preHandler, schema: schema.body({ code: "string" }) },
			User.activateTwofa,
		);

		app.post("/api/user/updateAvatar", { preHandler }, User.updateAvatar);
	}

	static async updateAvatar(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;

		if (!req.isMultipart()) {
			return rep.code(STATUS.bad_request).send({ message: "Request is not multipart" });
		}

		const uploadedFile = await req.file();
		if (!uploadedFile) {
			return rep.code(STATUS.bad_request).send({ message: "No file uploaded" });
		}

		const randomKey = randomBytes(32).toString("hex");

		const buffer = await uploadedFile.toBuffer();
		try {
			await sharp(buffer).resize(751, 751, { fit: "cover" }).png().toFile("./uploads/" + randomKey + ".png");
		} catch {
			return rep.code(STATUS.bad_request).send({ message: "Invalid image file" });
		}

		const imgTypes = ["image/png", "image/jpeg", "image/webp"];
		if (!imgTypes.includes(uploadedFile.mimetype)) {
			return rep.code(STATUS.bad_request).send({ message: "Invalid image file " });
		}

		const otherUserAvatar = await db.select().from(tables.users).where(orm.eq(tables.users.avatar, usr.avatar));
		if (usr.avatar !== `default_pp.png` && otherUserAvatar.length < 2) {
			fs.unlink(usr.avatar, () => {});
		}

		const newAvatar = "uploads/" + randomKey + ".png";

		await db.update(tables.users).set({ avatar: newAvatar }).where(orm.eq(tables.users.id, usr.id));

		return rep.code(STATUS.success).send({ message: `avatar updated`, file: randomKey + ".png" });
	}

	static async getMe(req: FastifyRequest, rep: FastifyReply) {
		if (!req.user) {
			return rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });
		}
		rep.code(STATUS.success).send({
			displayName: req.user.displayName,
			// id: req.user.id,
			username: req.user.username,
			avatar: req.user.avatar,
			uuid: req.user.uuid,
			twofa: req.user.twofaEnabled == tables.TwofaState.enabled,
		});
	}

	static async getUser(req: FastifyRequest, rep: FastifyReply) {
		const { displayName, username } = req.query as { displayName?: string, username?: string };

		if (displayName) {
			if (REGEX_USERNAME.test(displayName) === false) {
				return (rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName }));
			}

			const [user] = await db.select({
				uuid: tables.users.uuid,
				username: tables.users.username,
				displayName: tables.users.displayName,
				avatar: tables.users.avatar,
				isOnline: tables.users.isOnline,
			}).from(tables.users).where(orm.eq(tables.users.displayName, displayName));

			if (user == undefined) {
				return rep.code(STATUS.not_found).send({ message: MESSAGE.user_notfound });
			}

			return rep.code(STATUS.success).send({ user });
		}
		if (username) {
			if (REGEX_USERNAME.test(username) === false) {
				return (rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName }));
			}

			const [user] = await db.select({
				uuid: tables.users.uuid,
				username: tables.users.username,
				displayName: tables.users.displayName,
				avatar: tables.users.avatar,
				isOnline: tables.users.isOnline,
			}).from(tables.users).where(orm.eq(tables.users.username, username));

			if (user == undefined) {
				return rep.code(STATUS.not_found).send({ message: MESSAGE.user_notfound });
			}

			return rep.code(STATUS.success).send({ user });
		}
		return rep.code(STATUS.bad_request).send({ message: "Missing displayName or username" });
	}

	static async getallUsers(_req: FastifyRequest, rep: FastifyReply) {
		const allUsers = await db.select({
			uuid: tables.users.uuid,
			displayName: tables.users.displayName,
			avatar: tables.users.avatar,
			isOnline: tables.users.isOnline,
		})
			.from(tables.users);

		if (allUsers.length === 0) {
			return rep.code(STATUS.not_found).send({ message: MESSAGE.not_found });
		}

		return rep.code(STATUS.success).send({ users: allUsers });
	}

	static async updateProfile(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user;
		const { displayName } = req.body as { displayName: string };
		const data: any = {};

		if (!displayName) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_fields });
		}

		if (displayName) {
			if (REGEX_USERNAME.test(displayName) === false) {
				return (rep.code(STATUS.bad_request).send({
					message: MESSAGE.invalid_displayName + " : Must contain 3 minimum characters (alphanumerical only)",
				}));
			}
			const exists = await db.select().from(tables.users).where(orm.eq(tables.users.displayName, displayName));
			if (exists.length != 0) {
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.displayName_taken });
			}
			data.displayName = displayName;
		}

		await db.update(tables.users).set(data).where(orm.eq(tables.users.id, usr!.id));

		return rep.code(STATUS.success).send({ message: "Display name updated" });
	}

	static async updatePassword(req: FastifyRequest, rep: FastifyReply) {
		const usrId = req.user!.id;
		const { currentPassword, newPassword } = req.body as { currentPassword: string, newPassword: string };

		if (!currentPassword || !newPassword) {
			return rep.code(STATUS.bad_request).send({ message: "Missing password" });
		}
		if (REGEX_PASSWORD.test(newPassword) === false) {
			return rep.code(STATUS.bad_request).send({ message: "Password must contain at least 1 lowercase, 1 uppercase and 8 characters minimum" });
		}

		const [usr] = await db.select().from(tables.users).where(orm.eq(tables.users.id, usrId));

		if (await comparePassword(currentPassword, usr.password) === false) {
			return rep.code(STATUS.bad_request).send({ message: "Current password is incorrect" });
		}

		if (await comparePassword(newPassword, usr.password) === true) {
			return rep.code(STATUS.bad_request).send({ message: "New password cannot be same as old one" });
		}

		const hashed = await hashPassword(newPassword);
		await db.update(tables.users).set({ password: hashed }).where(orm.eq(tables.users.id, usrId));

		rep.code(STATUS.success).send({ message: "Password updated" });
	}

	static async updateTwofa(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const twofa = req.body as { enable: boolean, code?: string };
		const TwofaState = tables.TwofaState;

		if (user.oauth !== null) {
			return rep.code(STATUS.bad_request).send({ message: "Cannot activate TwoFA with an OAuth account" });
		}
		if (twofa.enable == false) {
			if (user.twofaEnabled != TwofaState.disabled) {
				await db.update(tables.users).set({ twofaEnabled: TwofaState.disabled, twofaKey: null })
					.where(
						orm.eq(tables.users.id, user.id),
					);
			}
			if (user.twofaEnabled != TwofaState.enabled) {
				return rep.code(STATUS.success).send({ message: "Twofa already disabled" });
			}
			return rep.code(STATUS.success).send({ message: "Twofa disabled" });
		}
		if (user.twofaEnabled == TwofaState.enabled) {
			return rep.code(STATUS.success).send({ message: "Twofa already enabled" });
		}
		const secret = generate2FASecret(user.username);
		if (!secret.otpauth_url) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.fail_gen2FAurl });
		}
		await db.update(tables.users).set({ twofaKey: secret.base32, twofaEnabled: TwofaState.pending })
			.where(
				orm.eq(tables.users.id, user.id),
			);
		const qrCode = await generateQRCode(secret.otpauth_url);
		return rep.code(STATUS.bad_request).send({ message: "Awaiting validation", qrCode });
	}

	static async activateTwofa(req: FastifyRequest, rep: FastifyReply) {
		const user = req.user!;
		const twofa = req.body as { code?: string };
		const TwofaState = tables.TwofaState;

		if (!twofa.code || verify2FAToken(user.twofaKey!, twofa.code!) == false) {
			await db.update(tables.users).set({ twofaKey: null, twofaEnabled: TwofaState.disabled }).where(
				orm.eq(tables.users.id, user.id),
			);
			return rep.code(STATUS.bad_request).send({ message: "Invalid twofa code" });
		}
		await db.update(tables.users).set({ twofaEnabled: TwofaState.enabled }).where(
			orm.eq(tables.users.id, user.id),
		);
		return rep.code(STATUS.success).send({ message: "Twofa enabled" });
	}

	static async getMyHistory(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const matchesList = await db.select({
			match: tables.matches,
			opponent: {
				id: tables.users.id,
				displayName: tables.users.displayName,
			},
		}).from(tables.matches).innerJoin(
			tables.users,
			orm.or(
				orm.and(orm.eq(tables.matches.player1Id, usr.id), orm.eq(tables.users.id, tables.matches.player2Id)),
				orm.and(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.users.id, tables.matches.player1Id)),
			),
		).where(orm.and(
			orm.or(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.matches.player1Id, usr.id)),
			orm.eq(tables.matches.status, "ended"),
		)).limit(5).orderBy(orm.desc(tables.matches.endedAt));

		matchesList.forEach(match => {
			if (match.match.player1Id !== usr.id) {
				[match.match.player1Id, match.match.player2Id] = [match.match.player2Id, match.match.player1Id];
				[match.match.scoreP1, match.match.scoreP2] = [match.match.scoreP2, match.match.scoreP1];
			}
		});

		return rep.code(STATUS.success).send(matchesList);
	}

	static async getUserHistory(req: FastifyRequest, rep: FastifyReply) {
		const { displayName } = req.query as { displayName?: string };

		if (!displayName) {
			return rep.code(STATUS.bad_request).send({ message: "Missing displayName" });
		}

		const [usr] = await db.select({ id: tables.users.id }).from(tables.users).where(
			orm.eq(tables.users.displayName, displayName),
		);
		if (!usr) {
			return rep.code(STATUS.bad_request).send({ message: "User not found" });
		}

		const matchesList = await db.select({
			match: tables.matches,
			opponent: {
				id: tables.users.id,
				displayName: tables.users.displayName,
			},
		}).from(tables.matches).innerJoin(
			tables.users,
			orm.or(
				orm.and(orm.eq(tables.matches.player1Id, usr.id), orm.eq(tables.users.id, tables.matches.player2Id)),
				orm.and(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.users.id, tables.matches.player1Id)),
			),
		).where(orm.and(
			orm.or(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.matches.player1Id, usr.id)),
			orm.eq(tables.matches.status, "ended"),
		))
			.limit(5).orderBy(orm.desc(tables.matches.endedAt));

		matchesList.forEach(match => {
			if (match.match.player1Id !== usr.id) {
				[match.match.player1Id, match.match.player2Id] = [match.match.player2Id, match.match.player1Id];
				[match.match.scoreP1, match.match.scoreP2] = [match.match.scoreP2, match.match.scoreP1];
			}
		});

		return rep.code(STATUS.success).send(matchesList);
	}

	static async getMyStat(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const matchesList = await db.select({
			match: tables.matches,
			tournament: {
				id: tables.tournaments.id,
				size: tables.tournaments.size,
				winnerId: tables.tournaments.winnerId,
				round: tables.tournamentMatches.round,
			},
			opponentId: tables.users.id,
		}).from(tables.matches).innerJoin(
			tables.users,
			orm.or(
				orm.and(orm.eq(tables.matches.player1Id, usr.id), orm.eq(tables.users.id, tables.matches.player2Id)),
				orm.and(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.users.id, tables.matches.player1Id)),
			),
		).leftJoin(tables.tournamentMatches, orm.eq(tables.matches.id, tables.tournamentMatches.matchId)).leftJoin(
			tables.tournaments,
			orm.eq(tables.tournamentMatches.tournamentId, tables.tournaments.id),
		).where(orm.and(
			orm.or(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.matches.player1Id, usr.id)),
			orm.eq(tables.matches.status, "ended"),
		)).orderBy(orm.desc(tables.matches.endedAt));

		let nbMatchVictory: number = 0;
		let nbTournament: number = 0;
		let nbTournamentVictory: number = 0;
		let pointScored: number = 0;
		let pointConceded: number = 0;
		let bestRank: number = 0;
		let participatedTournament: Map<number, { winnerId: number, round: number, size: number }> = new Map();

		matchesList.forEach(match => {
			if (match.match.player1Id !== usr.id) {
				[match.match.player1Id, match.match.player2Id] = [match.match.player2Id, match.match.player1Id];
				[match.match.scoreP1, match.match.scoreP2] = [match.match.scoreP2, match.match.scoreP1];
			}
			if (match.match.winnerId === usr.id) {
				nbMatchVictory++;
			}
			pointScored += match.match.scoreP1;
			pointConceded += match.match.scoreP2;
			if (match.tournament.id) {
				const keyT = participatedTournament.get(match.tournament.id)
					?? {
						winnerId: match.tournament.winnerId!,
						round: match.tournament.round!,
						size: match.tournament.size!,
					};

				if (match.tournament.round && keyT.round && keyT.round <= match.tournament.round) {
					keyT.round = match.tournament.round;
				}
				if (!participatedTournament.has(match.tournament.id)) {
					participatedTournament.set(match.tournament.id, {
						winnerId: match.tournament.winnerId!,
						round: match.tournament.round!,
						size: match.tournament.size!,
					});
				} else {
					participatedTournament.set(match.tournament.id, keyT);
				}
			}
		});

		const rankingPlacement = new Map<number, string>(
			[
				[0, "nothing"],
				[1, "quarter-final"],
				[2, "semi-final"],
				[3, "final"],
			],
		);

		for (const key of participatedTournament.keys()) {
			let t = participatedTournament.get(key)!;
			if (t.winnerId && t.winnerId === usr.id) {
				nbTournamentVictory++;
			}

			let tempRank = 0;
			switch (t.round) {
				case (1):
					if (t.size == 4) {
						tempRank = 2;
					} else if (t.size == 8) {
						tempRank = 1;
					}
					break;
				case (2):
					if (t.size == 4) {
						tempRank = 3;
					} else if (t.size == 8) {
						tempRank = 2;
					}
					break;
				case (3):
					tempRank = 3;
					break;
			}
			if (bestRank < tempRank) {
				bestRank = tempRank;
			}
		}

		nbTournament = participatedTournament.size;

		const finalList = {
			matchPlayed: matchesList.length,
			victoryRate: matchesList.length
				? ((nbMatchVictory / matchesList.length) * 100).toFixed(2)
				: matchesList.length,
			pointScored: matchesList.length ? (pointScored / matchesList.length).toFixed(2) : matchesList.length,
			pointConceded: matchesList.length ? (pointConceded / matchesList.length).toFixed(2) : matchesList.length,
			nbTournament: nbTournament,
			nbTournamentVictory: nbTournamentVictory,
			Placement: rankingPlacement.get(bestRank),
		};

		return rep.code(STATUS.success).send(finalList);
	}

	static async getUserStat(req: FastifyRequest, rep: FastifyReply) {
		const { displayName } = req.query as { displayName?: string };

		if (!displayName) {
			return rep.code(STATUS.bad_request).send({ message: "Missing displayName" });
		}

		const [usr] = await db.select({ id: tables.users.id }).from(tables.users).where(
			orm.eq(tables.users.displayName, displayName),
		);
		if (!usr) {
			return rep.code(STATUS.bad_request).send({ message: "User not found" });
		}

		const matchesList = await db.select({
			match: tables.matches,
			tournament: {
				id: tables.tournaments.id,
				size: tables.tournaments.size,
				winnerId: tables.tournaments.winnerId,
				round: tables.tournamentMatches.round,
			},
			opponentId: tables.users.id,
		}).from(tables.matches).innerJoin(
			tables.users,
			orm.or(
				orm.and(orm.eq(tables.matches.player1Id, usr.id), orm.eq(tables.users.id, tables.matches.player2Id)),
				orm.and(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.users.id, tables.matches.player1Id)),
			),
		).leftJoin(tables.tournamentMatches, orm.eq(tables.matches.id, tables.tournamentMatches.matchId)).leftJoin(
			tables.tournaments,
			orm.eq(tables.tournamentMatches.tournamentId, tables.tournaments.id),
		).where(orm.and(
			orm.or(orm.eq(tables.matches.player2Id, usr.id), orm.eq(tables.matches.player1Id, usr.id)),
			orm.eq(tables.matches.status, "ended"),
		)).orderBy(orm.desc(tables.matches.endedAt));

		let nbMatchVictory: number = 0;
		let nbTournament: number = 0;
		let nbTournamentVictory: number = 0;
		let pointScored: number = 0;
		let pointConceded: number = 0;
		let bestRank: number = 0;
		let participatedTournament: Map<number, { winnerId: number, round: number, size: number }> = new Map();

		matchesList.forEach(match => {
			if (match.match.player1Id !== usr.id) {
				[match.match.player1Id, match.match.player2Id] = [match.match.player2Id, match.match.player1Id];
				[match.match.scoreP1, match.match.scoreP2] = [match.match.scoreP2, match.match.scoreP1];
			}
			if (match.match.winnerId === usr.id) {
				nbMatchVictory++;
			}
			pointScored += match.match.scoreP1;
			pointConceded += match.match.scoreP2;
			if (match.tournament.id) {
				const keyT = participatedTournament.get(match.tournament.id)
					?? {
						winnerId: match.tournament.winnerId!,
						round: match.tournament.round!,
						size: match.tournament.size!,
					};

				if (match.tournament.round && keyT.round && keyT.round <= match.tournament.round) {
					keyT.round = match.tournament.round;
				}
				if (!participatedTournament.has(match.tournament.id)) {
					participatedTournament.set(match.tournament.id, {
						winnerId: match.tournament.winnerId!,
						round: match.tournament.round!,
						size: match.tournament.size!,
					});
				} else {
					participatedTournament.set(match.tournament.id, keyT);
				}
			}
		});

		const rankingPlacement = new Map<number, string>(
			[
				[0, "nothing"],
				[1, "quarter-final"],
				[2, "semi-final"],
				[3, "final"],
			],
		);

		for (const key of participatedTournament.keys()) {
			let t = participatedTournament.get(key)!;
			if (t.winnerId && t.winnerId === usr.id) {
				nbTournamentVictory++;
			}

			let tempRank = 0;
			switch (t.round) {
				case (0):
					if (t.size == 4) {
						tempRank = 2;
					} else if (t.size == 8) {
						tempRank = 1;
					}
					break;
				case (1):
					if (t.size == 4) {
						tempRank = 3;
					} else if (t.size == 8) {
						tempRank = 2;
					}
					break;
				case (2):
					tempRank = 3;
					break;
			}
			if (bestRank < tempRank) {
				bestRank = tempRank;
			}
		}

		nbTournament = participatedTournament.size;

		const finalList = {
			matchPlayed: matchesList.length,
			victoryRate: matchesList.length ? ((nbMatchVictory / matchesList.length) * 100).toFixed(2) : matchesList.length,
			pointScored: matchesList.length ? (pointScored / matchesList.length).toFixed(2) : matchesList.length,
			pointConceded: matchesList.length ? (pointConceded / matchesList.length).toFixed(2) : matchesList.length,
			nbTournament: nbTournament,
			nbTournamentVictory: nbTournamentVictory,
			Placement: rankingPlacement.get(bestRank),
		};
		

		return rep.code(STATUS.success).send(finalList);
	}
}

export default async function(fastify: FastifyInstance) {
	User.setup(fastify);
	// Reset online status.
	await db.update(tables.users).set({ isOnline: 0 });
}
