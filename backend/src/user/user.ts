import * as orm from "drizzle-orm";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/database";
import { matches, tournamentMatches, tournaments, users } from "../db/tables";
import { generate2FASecret, generateQRCode } from "../security/2fa";
import { authGuard } from "../security/authGuard";
import { comparePassword, hashPassword } from "../security/hash";
import { MESSAGE, schema, STATUS } from "../shared";

const REGEX_USERNAME = /^(?=[a-zA-Z].*)[a-zA-Z0-9-]{3,24}$/;
const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z0-9#@]{8,64}$/;

class User {
	static setup(app: FastifyInstance) {
		app.get("/api/me", { preHandler: authGuard }, User.getMe);
		app.get("/api/user", { preHandler: authGuard, schema: schema.query({ displayName: "string" }) }, User.getUser);
		app.get("/api/users/all", { preHandler: authGuard }, User.getallUsers);
		app.get("/api/me/history", { preHandler: authGuard }, User.getMyHistory);
		app.get("/api/user/history", { preHandler: authGuard }, User.getUserHistory);
		app.get("/api/me/stats", { preHandler: authGuard }, User.getMyStat);
		app.get("/api/user/stats", { preHandler: authGuard }, User.getUserStat);

		app.patch("/api/user/profile", { preHandler: authGuard }, User.updateProfile);
		app.patch("/api/user/password", { preHandler: authGuard }, User.updatePassword);
		app.patch("/api/user/2fa", { preHandler: authGuard }, User.update2fa);
	}

	static async getMe(req: FastifyRequest, rep: FastifyReply) {
		if (!req.user) {
			return rep.code(STATUS.unauthorized).send({ message: MESSAGE.unauthorized });
		}
		rep.code(STATUS.success).send({
			id: req.user.id,
			displayName: req.user.displayName,
			username: req.user.username,
			avatar: req.user.avatar,
		});
	}

	static async getUser(req: FastifyRequest, rep: FastifyReply) {
		const { displayName } = req.query as { displayName?: string };

		if (!displayName || REGEX_USERNAME.test(displayName) === false) {
			return (rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName }));
		}

		const [user] = await db.select({
			displayName: users.displayName,
			avatar: users.avatar,
			isOnline: users.isOnline,
		}).from(users).where(orm.eq(users.displayName, displayName));

		if (user == undefined) {
			return rep.code(STATUS.not_found).send({ message: MESSAGE.user_notfound });
		}

		return rep.code(STATUS.success).send({ user });
	}

	static async getallUsers(_req: FastifyRequest, rep: FastifyReply) {
		const allUsers = await db.select({
			uuid: users.uuid,
			displayName: users.displayName,
			avatar: users.avatar,
			isOnline: users.isOnline,
		})
			.from(users);

		if (allUsers.length === 0) {
			return rep.code(STATUS.not_found).send({ message: MESSAGE.not_found });
		}

		return rep.code(STATUS.success).send({ users: allUsers });
	}

	static async updateProfile(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user;
		const { displayName, avatar } = req.body as { displayName?: string, avatar?: string };
		const data: any = {};

		if (!displayName && !avatar) {
			return rep.code(STATUS.bad_request).send({ message: MESSAGE.missing_fields });
		}

		if (displayName) {
			if (REGEX_USERNAME.test(displayName) === false) {
				return (rep.code(STATUS.bad_request).send({ message: MESSAGE.invalid_displayName }));
			}
			const exists = await db.select().from(users).where(orm.eq(users.displayName, displayName));
			if (exists.length != 0) {
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.displayName_taken });
			}
			data.displayName = displayName;
		}
		if (avatar) {
			data.avatar = avatar;
		}

		await db.update(users).set(data).where(orm.eq(users.id, usr!.id));

		return rep.code(STATUS.success).send({ message: "Profile updated" });
	}

	static async updatePassword(req: FastifyRequest, rep: FastifyReply) {
		const usrId = req.user!.id;
		const { currentPassword, newPassword } = req.body as { currentPassword: string, newPassword: string };

		if (!currentPassword || !newPassword) {
			return rep.code(STATUS.bad_request).send({ message: "Missing password" });
		}
		if (REGEX_PASSWORD.test(newPassword) === false) {
			return rep.code(STATUS.bad_request).send({ message: "Invalid new password" });
		}

		const [usr] = await db.select().from(users).where(orm.eq(users.id, usrId));

		if (await comparePassword(currentPassword, usr.password) === false) {
			return rep.code(STATUS.bad_request).send({ message: "Current password is incorrect" });
		}

		if (await comparePassword(newPassword, usr.password) === true) {
			return rep.code(STATUS.bad_request).send({ message: "New password cannot be same as old one" });
		}

		const hashed = await hashPassword(newPassword);
		await db.update(users).set({ password: hashed }).where(orm.eq(users.id, usrId));

		rep.code(STATUS.success).send({ message: "Password updated" });
	}

	static async update2fa(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const { enable } = req.body as { enable: boolean };

		// add password check ?

		if (enable) {
			if (usr.twofaEnabled === 1) {
				return rep.code(STATUS.bad_request).send({ message: "2FA is arleady enabled" });
			}
			const secret = generate2FASecret(usr.username);
			if (!secret.otpauth_url) {
				return rep.code(STATUS.bad_request).send({ message: MESSAGE.fail_gen2FAurl });
			}
			const qrCode = await generateQRCode(secret.otpauth_url);
			await db.update(users).set({ twofaKey: secret.base32, twofaEnabled: 1 }).where(
				orm.eq(users.id, usr.id),
			);

			return rep.code(STATUS.success).send({ message: "2FA enabled", qrCode });
		} else {
			await db.update(users).set({ twofaKey: null, twofaEnabled: 0 }).where(orm.eq(users.id, usr.id));
			return rep.code(STATUS.success).send({ message: "2FA disabled" });
		}
	}

	// L'user actuel est toujours le Player1
	static async getMyHistory(req: FastifyRequest, rep: FastifyReply) {
		const usr = req.user!;
		const matchesList = await db.select({
			match: matches,
			opponent: {
				id: users.id,
				displayName: users.displayName,
			},
		}).from(matches).innerJoin(
			users,
			orm.or(
				orm.and(orm.eq(matches.player1Id, usr.id), orm.eq(users.id, matches.player2Id)),
				orm.and(orm.eq(matches.player2Id, usr.id), orm.eq(users.id, matches.player1Id)),
			),
		).where(orm.and(
			orm.or(orm.eq(matches.player2Id, usr.id), orm.eq(matches.player1Id, usr.id)),
			orm.eq(matches.status, "ended"),
		)).limit(5).orderBy(orm.desc(matches.endedAt));

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

		const [usr] = await db.select({ id: users.id }).from(users).where(orm.eq(users.displayName, displayName));
		if (!usr) {
			return rep.code(STATUS.bad_request).send({ message: "User not found" });
		}

		const matchesList = await db.select({
			match: matches,
			opponent: {
				id: users.id,
				displayName: users.displayName,
			},
		}).from(matches).innerJoin(
			users,
			orm.or(
				orm.and(orm.eq(matches.player1Id, usr.id), orm.eq(users.id, matches.player2Id)),
				orm.and(orm.eq(matches.player2Id, usr.id), orm.eq(users.id, matches.player1Id)),
			),
		).where(orm.and(
			orm.or(orm.eq(matches.player2Id, usr.id), orm.eq(matches.player1Id, usr.id)),
			orm.eq(matches.status, "ended"),
		))
			.limit(5).orderBy(orm.desc(matches.endedAt));

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
			match: matches,
			tournament: {
				id: tournaments.id,
				size: tournaments.size,
				winnerId: tournaments.winnerId,
				round: tournamentMatches.round,
			},
			opponentId: users.id,
		}).from(matches).innerJoin(
			users,
			orm.or(
				orm.and(orm.eq(matches.player1Id, usr.id), orm.eq(users.id, matches.player2Id)),
				orm.and(orm.eq(matches.player2Id, usr.id), orm.eq(users.id, matches.player1Id)),
			),
		).leftJoin(tournamentMatches, orm.eq(matches.id, tournamentMatches.matchId)).leftJoin(
			tournaments,
			orm.eq(tournamentMatches.tournamentId, tournaments.id),
		).where(orm.and(
			orm.or(orm.eq(matches.player2Id, usr.id), orm.eq(matches.player1Id, usr.id)),
			orm.eq(matches.status, "ended"),
		)).orderBy(orm.desc(matches.endedAt));

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
				const keyT = participatedTournament.get(match.tournament.id) ??
					{
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
			victoryRate: matchesList.length ? (nbMatchVictory / matchesList.length) * 100 : matchesList.length,
			pointScored: matchesList.length ? pointScored / matchesList.length : matchesList.length,
			pointConceded: matchesList.length ? pointConceded / matchesList.length : matchesList.length,
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

		const [usr] = await db.select({ id: users.id }).from(users).where(orm.eq(users.displayName, displayName));
		if (!usr) {
			return rep.code(STATUS.bad_request).send({ message: "User not found" });
		}

		const matchesList = await db.select({
			match: matches,
			tournament: {
				id: tournaments.id,
				size: tournaments.size,
				winnerId: tournaments.winnerId,
				round: tournamentMatches.round,
			},
			opponentId: users.id,
		}).from(matches).innerJoin(
			users,
			orm.or(
				orm.and(orm.eq(matches.player1Id, usr.id), orm.eq(users.id, matches.player2Id)),
				orm.and(orm.eq(matches.player2Id, usr.id), orm.eq(users.id, matches.player1Id)),
			),
		).leftJoin(tournamentMatches, orm.eq(matches.id, tournamentMatches.matchId)).leftJoin(
			tournaments,
			orm.eq(tournamentMatches.tournamentId, tournaments.id),
		).where(orm.and(
			orm.or(orm.eq(matches.player2Id, usr.id), orm.eq(matches.player1Id, usr.id)),
			orm.eq(matches.status, "ended"),
		)).orderBy(orm.desc(matches.endedAt));

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
				const keyT = participatedTournament.get(match.tournament.id) ??
					{
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
			victoryRate: matchesList.length ? (nbMatchVictory / matchesList.length) * 100 : matchesList.length,
			pointScored: matchesList.length ? pointScored / matchesList.length : matchesList.length,
			pointConceded: matchesList.length ? pointConceded / matchesList.length : matchesList.length,
			nbTournament: nbTournament,
			nbTournamentVictory: nbTournamentVictory,
			Placement: rankingPlacement.get(bestRank),
		};

		return rep.code(STATUS.success).send(finalList);
	}
}

export async function getUserIdByUsername(username: string): Promise<number | null> {
	const [user] = await db.select({ id: users.id }).from(users).where(orm.eq(users.username, username));
	return user ? user.id : null;
}

export default async function(fastify: FastifyInstance) {
	User.setup(fastify);
	// Reset online status.
	await db.update(users).set({ isOnline: 0 });
}
