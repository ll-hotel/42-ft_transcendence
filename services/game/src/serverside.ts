import { clearInterval, setInterval } from "node:timers";
import * as dbM from "./utils/db/methods";
import socket, { send } from "./utils/socket";
import {
	InputMessage,
	LocalMessage,
	Mode,
	Position,
	Score,
	ScoreMessage,
	Size,
	StateMessage,
	Status,
	TypeMsg,
	Vector2D,
} from "./types";

type GameState = {
	ball: { x: number, y: number, speed: Vector2D },
	paddles: {
		p1_Y: number,
		p1_input: { up: boolean, down: boolean },
		p2_Y: number,
		p2_input: { up: boolean, down: boolean },
	},
	status: Status,
	score: Score,
};

type MatchId = number;

export const games: Map<MatchId, GameInstance> = new Map();

export function create_game(matchId: MatchId, p1_uuid: string, p2_uuid: string) {
	if (games.has(matchId))
		return;

	// if (mode == Mode.local)
	// {
	// 	let game = new GameInstance(matchId, p1_uuid, p2_uuid, mode);
	// 	games.set(matchId, game);
	// 	game.start();
	// }
	// else {
	let discard = dbM.startMatch(matchId).then(() => {
		let game = new GameInstance(matchId, p1_uuid, p2_uuid, Mode.remote);
		games.set(matchId, game);
		game.start();
	});
}

export function kill_game(matchId: MatchId)
{
	if (games.has(matchId)) {
		let game = games.get(matchId);
		game?.end();
		return true;
	}
	else
		return false;
	
}

export function create_local_game(p1_uuid : string)
{
	let localGame = -1;
	while (games.has(localGame))
		localGame--;
	let game = new GameInstance(localGame, p1_uuid, null, Mode.local)
	games.set(localGame, game);
	game.start();
	return (localGame);
}

const server_tickrate: number = 10;

function dot_product(x1: number, y1: number, x2: number, y2: number): number {
	return ((x1 * x2) + (y1 * y2));
}

abstract class PhysicObject {
	pos: Position;
	speed: Vector2D;
	size: Size;

	constructor(position: Position, size: Size, speed: Vector2D) {
		this.size = size;
		this.pos = position;
		this.speed = speed;
	}

	move(): void {
		this.pos.x += this.speed.getX();
		this.pos.y += this.speed.getY();
	}
}

const table_width = 500;
const table_ratio = 1/2;
const table = {
	width: table_width,
	height: table_width * table_ratio,
};

const paddleWidth = table.width * 0.03;
const paddleHeight = table.height * 0.2;

export class GameInstance {
	ball: PongBall;
	paddle_p1: PongPaddle;
	paddle_p2: PongPaddle;
	score: Score;
	input: {
		p1: { up: boolean, down: boolean },
		p2: { up: boolean, down: boolean },
	};
	p1_uuid: string;
	p2_uuid: string | null;
	tick_interval: number;
	tick_rate: number;
	game_id: number;
	move_offset: number;
	is_running: boolean;
	status: Status = Status.started;
	mode: Mode;

	constructor(game_id: number, p1_uuid: string, p2_uuid: string | null, mode: Mode) {
		this.game_id = game_id;
		this.score = { p1: 0, p2: 0 };
		this.paddle_p1 = new PongPaddle({ x: 0 + paddleWidth, y: table.height / 2 });
		this.paddle_p2 = new PongPaddle({ x: table.width - paddleWidth, y: table.height / 2 });
		this.tick_rate = server_tickrate;
		this.tick_interval = 1000 / this.tick_rate;
		this.is_running = false;
		this.input = {
			p1: { up: false, down: false },
			p2: { up: false, down: false },
		};
		this.move_offset = table.height * 0.1;
		this.p1_uuid = p1_uuid;
		this.p2_uuid = p2_uuid;
		this.ball = new PongBall(
			this.score,
			this.paddle_p1,
			this.paddle_p2,
			this.p1_uuid,
			this.p2_uuid,
			this.game_id,
		);
		this.mode = mode;

		if (mode == Mode.local) {
			// socket.addListener(this.p1_uuid, "pong", (msg) => {
			// 	this.local_input_listener(msg);
			// });
		} else if (mode == Mode.remote) {
			socket.addListener(this.p1_uuid, "pong", (msg) => {
				this.p1_event_listener(msg);
			});
			socket.addListener(this.p2_uuid!, "pong", (msg) => {
				this.p2_event_listener(msg);
			});
			socket.addListener(this.p1_uuid, "pong", console.log);
			socket.addListener(this.p2_uuid!, "pong", console.log);
		}
	}

	remote_input_listener(msg: InputMessage) {
		if (msg.clientId == this.p1_uuid)
		{
			this.input.p1.up = msg.up;
			this.input.p1.down = msg.down;
		}
		else if (msg.clientId == this.p2_uuid)
		{
			this.input.p2.down = msg.down;
			this.input.p2.up = msg.up;
		}
	}

	 p1_event_listener(msg: InputMessage) {
	 	this.input.p1.up = msg.up;
	 	this.input.p1.down = msg.down;
	 }

	 p2_event_listener(msg: InputMessage) {
	 	this.input.p2.up = msg.up;
	 	this.input.p2.down = msg.down;
	 }

	local_input_listener(msg: LocalMessage) {
		if (msg.topic !== "pong" || msg.type !== "input") {
			return;
		}
		this.input.p1.up = msg.p1_up;
		this.input.p1.down = msg.p1_down;
		this.input.p2.up = msg.p2_up;
		this.input.p2.down = msg.p2_down;
	}

	sendState(status: Status) {
		this.status = status;
		const state = this.state();
		let message: StateMessage = {
			service: "game",
			topic: "pong",
			type : TypeMsg.state,
			...state
		} as StateMessage;
		socket.send(this.p1_uuid, message);
		if (this.p2_uuid)
			socket.send(this.p2_uuid, message);
	}

	state(): GameState {
		return {
			ball: { x: this.ball.pos.x, y: this.ball.pos.y, speed: this.ball.speed },
			paddles: {
				p1_Y: this.paddle_p1.pos.y,
				p1_input: { up: this.input.p1.up, down: this.input.p1.down },
				p2_Y: this.paddle_p2.pos.y,
				p2_input: { up: this.input.p2.up, down: this.input.p2.down },
			},
			status: this.status,
			score: this.score,
		};
	}

	start(): void {
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.ball.respawn(Math.random() < 0.5 ? -1 : 1);
		this.sendState(Status.started);
		this.is_running = true;
		this.status = Status.started;

		let id_interval = setInterval(() => {
			this.update();
			if (!this.is_running) {
				clearInterval(id_interval);
			}
		}, this.tick_interval);
	}

	update() {
		if (this.input.p1.up && this.paddle_p1.pos.y >= (this.move_offset + (this.paddle_p1.size.h / 2))) {
			this.paddle_p1.pos.y -= this.move_offset;
		}
		if (
			this.input.p1.down
			&& this.paddle_p1.pos.y <= table.height - (this.move_offset + (this.paddle_p1.size.h / 2))
		) {
			this.paddle_p1.pos.y += this.move_offset;
		}
		if (this.input.p2.up && this.paddle_p2.pos.y >= (this.move_offset + (this.paddle_p1.size.h / 2))) {
			this.paddle_p2.pos.y -= this.move_offset;
		}
		if (
			this.input.p2.down
			&& this.paddle_p2.pos.y <= table.height - (this.move_offset + (this.paddle_p1.size.h / 2))
		) {
			this.paddle_p2.pos.y += this.move_offset;
		}
		this.ball.move();
		if (this.score.p1 >= 7) {
			this.end();
		} else if (this.score.p2 >= 7) {
			this.end();
		}
		this.sendState(Status.ongoing);
	}

	end() {
		this.sendState(Status.ended);
		this.is_running = false;
		let discard = dbM.endMatch(this.game_id);
		socket.removeListener(this.p1_uuid, "pong");
		if (this.p2_uuid)
			socket.removeListener(this.p2_uuid, "pong");
		games.delete(this.game_id);
	}
}

export class PongPaddle extends PhysicObject {
	constructor(position: Position) {
		super(position, { w: paddleWidth, h: paddleHeight }, new Vector2D(0, 0));
	}
}

export class PongBall extends PhysicObject {
	private score: Score;
	readonly paddle_p1: PongPaddle;
	readonly paddle_p2: PongPaddle;
	readonly top_normal: Vector2D;
	readonly bottom_normal: Vector2D;
	readonly left_normal: Vector2D;
	readonly right_normal: Vector2D;
	private p1_ws: string;
	private p2_ws: string | null;
	private game_id: number;

	constructor(
		score: Score,
		paddle_p1: PongPaddle,
		paddle_p2: PongPaddle,
		p1_ws: string,
		p2_ws: string | null,
		game_id: number,
	) {
		super(
			{ x: table.width / 2, y: table.height / 2 },
			{ w: table.height * 0.1, h: table.height * 0.1 },
			new Vector2D(0, 0),
		);
		this.score = score;
		this.paddle_p1 = paddle_p1;
		this.paddle_p2 = paddle_p2;

		this.top_normal = new Vector2D(0, 1);
		this.bottom_normal = new Vector2D(0, -1);
		this.left_normal = new Vector2D(1, 0);
		this.right_normal = new Vector2D(-1, 0);

		this.p1_ws = p1_ws;
		this.p2_ws = p2_ws;
		this.game_id = game_id;
	}

	sendScore() {
		let init_msg: ScoreMessage = {
			service : "game",
			topic: "pong",
			type: TypeMsg.score,
			p1_score: this.score.p1,
			p2_score: this.score.p2,
		} as ScoreMessage;

		socket.send(this.p1_ws, init_msg);
		if (this.p2_ws)
			socket.send(this.p2_ws, init_msg);
	}

	test_collide(line_position: Position, normal: Vector2D) {
		let distance_from_line = dot_product(
			this.pos.x - line_position.x,
			this.pos.y - line_position.y,
			normal.getX(),
			normal.getY(),
		);
		if (distance_from_line < this.size.w / 2) {
			let speed_normal: number = dot_product(this.speed.getX(), this.speed.getY(), normal.getX(), normal.getY());
			let speed_tangent: number = dot_product(
				this.speed.getX(),
				this.speed.getY(),
				normal.getY(),
				-normal.getX(),
			);
			this.speed.setX = -(speed_normal * normal.getX()) + (speed_tangent * normal.getY());
			this.speed.setY = -(speed_normal * normal.getY()) + (speed_tangent * -normal.getX());
			this.speed.scale(1.05);
		}
	}

	respawn(side: number) {
		this.pos.x = table.width / 2;
		this.pos.y = table.height / 2;
		// TODO remettre l'angle aleatoire
		let new_dir = 45 + Math.random() * 90;
		this.speed.setX = Math.cos(new_dir) * 5;
		this.speed.setY = Math.sin(new_dir) * 5;
		this.speed.scale(4);
	}

	ball_scored(line_position: Position, normal: Vector2D) {
		let distance_from_line = dot_product(
			this.pos.x - line_position.x,
			this.pos.y - line_position.y,
			normal.getX(),
			normal.getY(),
		);

		let next_side;
		if (distance_from_line < this.size.w / 2) {
			next_side = 1;
			if (this.pos.x <= this.size.w) {
				this.score.p2++;
			} else if (this.pos.x >= table.width - this.size.w) {
				this.score.p1++;
				next_side = -1;
			}
			let discard = dbM.updateMatchInfo(this.game_id, this.score.p1, this.score.p2);
			this.respawn(next_side);
			this.sendScore();
		}
	}

	paddle_blocked(pos: Position, normal: Vector2D) {
		let distanceToWall = dot_product(
			this.pos.x - pos.x,
			this.pos.y - pos.y,
			normal.getX(),
			normal.getY(),
		);

		if (
			(distanceToWall <= this.size.w / 2)
			&& (pos.y - this.pos.y > -(this.paddle_p1.size.h / 2))
			&& (pos.y - this.pos.y) < (this.paddle_p1.size.h / 2)
		) {
			let new_normal = normal;

			new_normal.unit_himself();
			this.pos.x = pos.x + ((this.size.w / 2) * normal.getX());
			let speed_normal: number = dot_product(
				this.speed.getX(),
				this.speed.getY(),
				new_normal.getX(),
				new_normal.getY(),
			);
			let speed_tangent: number = dot_product(
				this.speed.getX(),
				this.speed.getY(),
				new_normal.getY(),
				-new_normal.getX(),
			);
			this.speed.setX = -(speed_normal * new_normal.getX()) + (speed_tangent * (new_normal.getY()));
			this.speed.setY = -(speed_normal * (new_normal.getY())) + (speed_tangent * -new_normal.getX());
			this.speed.scale(1.05);
		}
	}

	move(): void {
		this.pos.x += this.speed.getX();
		this.pos.y += this.speed.getY();
		this.test_collide({ x: 0, y: (this.size.h / 2) }, this.top_normal);
		this.test_collide({ x: 0, y: table.height - (this.size.h / 2) }, this.bottom_normal);
		this.paddle_blocked({
			x: this.paddle_p2.pos.x - (this.paddle_p2.size.w / 2) - (this.size.w / 2),
			y: this.paddle_p2.pos.y,
		}, this.right_normal);
		this.paddle_blocked({
			x: this.paddle_p1.pos.x + (this.paddle_p1.size.w / 2) + (this.size.w / 2),
			y: this.paddle_p1.pos.y,
		}, this.left_normal);
		this.ball_scored({ x: 0, y: 0 }, this.left_normal);
		this.ball_scored({ x: table.width, y: 0 }, this.right_normal);
	}
}
