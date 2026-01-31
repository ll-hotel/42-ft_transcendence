import { api } from "./api.js";
import socket, { LocalMessage, PongMessage, ScoreMessage, StateMessage } from "./socket.js";

type Position = { x: number, y: number };
type Score = { p1: number, p2: number };
type Size = { w: number, h: number };

const width_server = 500;
const height_server = width_server * (1 / 2);
const server_tickrate = 20;

export enum Mode {
	local = "local",
	remote = "remote",
}

enum TypeMsg {
	state = "state",
	input = "input",
	error = "error",
	score = "score",
}

export enum PongStatus {
	ended = "ended",
	initialised = "initialised",
	ongoing = "ongoing",
}

export enum Side {
	Left = "left",
	Right = "right",
}

function debug_message(msg: string, obj?: any): void {
	console.debug(msg, obj ? obj : "");
}

function draw_hit_box(context: CanvasRenderingContext2D, obj: PhysicObject): void {
	context.lineWidth = 1;
	context.strokeStyle = "#ff0000";
	context.strokeRect(
		obj.pos.x - Math.floor(obj.size.w / 2),
		obj.pos.y - Math.floor(obj.size.h / 2),
		obj.size.w,
		obj.size.h,
	);
	context.strokeStyle = "#000000";
}

function dot_product(x1: number, y1: number, x2: number, y2: number): number {
	return ((x1 * x2) + (y1 * y2));
}

abstract class PhysicObject {
	protected position: Position;
	public speed: Vector2D;
	readonly size: Size;

	constructor(position: Position, size: Size, speed: Vector2D) {
		this.size = size;
		this.position = position;
		this.speed = speed;
	}

	tick(): void {
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
	}

	public get pos(): Position {
		return this.position;
	}

	public set pos(pos: Position) {
		this.position = pos;
	}

	public setY(y: number) {
		this.position.y = y;
	}
}

export class Vector2D {
	public x: number;
	public y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
}

function scale_vec(vec: Vector2D, coef: number) {
	vec.x *= coef;
	vec.y *= coef;
}

export class Game {
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D | null;
	private ball: PongBall;
	public paddle_p1: PongPaddle;
	public paddle_p2: PongPaddle;
	public score: Score;
	public input: Map<string, boolean>;
	private mode: Mode;
	private tick_rate: number;
	private current_interval_id: number | null = null;
	private canvas_ratio: Size;
	private speed_ratio: number;
	private sendInputs: () => void;
	running: boolean = false;
	onScore: (() => void) | null = null;
	onEnded: (() => void) | null = null;
	private matchId: number;
	private last_input: { p1_up: boolean, p1_down: boolean, p2_up: boolean, p2_down: boolean };
	private  move_offset: number;
	private side: Side | null = null;

	constructor(
		html: HTMLElement,
		ball_texture: HTMLImageElement,
		paddle_texture: HTMLImageElement,
		mode: Mode,
		matchId: number,
	) {
		this.matchId = matchId;
		this.canvas = html.querySelector("#match-canvas")! as HTMLCanvasElement;
		this.context = this.canvas.getContext("2d")!;
		this.score = { p1: 0, p2: 0 };
		this.canvas_ratio = { w: this.canvas.width / width_server, h: this.canvas.height / height_server };
		const paddle_size = { w: this.canvas.width * 0.06, h: this.canvas.width * 0.06 * 1.80 };
		this.paddle_p1 = new PongPaddle(
			{ x: paddle_size.w / 2, y: this.canvas.height / 2 },
			paddle_texture,
			paddle_size,
		);
		this.paddle_p2 = new PongPaddle(
			{ x: this.canvas.width - (paddle_size.w / 2), y: this.canvas.height / 2 },
			paddle_texture,
			paddle_size,
		);
		this.ball = new PongBall(this.canvas, this.context, ball_texture);
		this.tick_rate = 60;
		this.input = new Map([["p1_up", false], ["p1_down", false], ["p2_up", false], ["p2_down", false]]);
		this.last_input = { p1_up: false, p1_down: false, p2_up: false, p2_down: false };
		this.speed_ratio = server_tickrate / this.tick_rate;
		this.mode = mode;
		if (this.mode == Mode.local) {
			this.sendInputs = () => this.send_local_input();
		} else {
			this.sendInputs = () => this.send_remote_input();
		}
		this.move_offset = this.canvas.height * 0.05;
	}

	pong_event_listener(msg: PongMessage): void {
		if (msg.type !== "state" && msg.type !== "score") {
			return;
		}
		if (msg.type == "score") {
			this.ball.pos.x = this.canvas.width / 2;
			this.ball.pos.y = this.canvas.height / 2;
			this.score.p1 = (msg as ScoreMessage).p1_score;
			this.score.p2 = (msg as ScoreMessage).p2_score;
			if (this.onScore) this.onScore();
			return;
		}
		const state = msg as StateMessage;

		if (state.status == PongStatus.initialised) {
			this.side = state.side as Side;
			this.run();
		} else if (state.status == PongStatus.ended) {
			if (this.onEnded) this.onEnded();
			this.stop();
			return;
		} else if (state.status == PongStatus.ongoing) {
			if (this.current_interval_id === null) {
				this.run();
			}
			this.update_state(state);
		}
	}

	run() {
		if (this.current_interval_id !== null) {
			return;
		}
		this.running = true;
		this.current_interval_id = setInterval(() => {
			this.update();
		}, 1000 / this.tick_rate);
	}

	stop() {
		this.running = false;
		if (this.current_interval_id !== null) {
			clearInterval(this.current_interval_id);
			this.current_interval_id = null;
		}
	}

	send_local_input() {
		let msg: LocalMessage = {
			service: "game",
			topic: "pong",
			type: "input",
			p1_up: this.input.get("p1_up")!,
			p1_down: this.input.get("p1_down")!,
			p2_up: this.input.get("p2_up")!,
			p2_down: this.input.get("p2_down")!,
		};
		socket.send(msg);
	}

	async send_remote_input() {
		await api.post("/api/game/input", {
			gameId: this.matchId,
			p1_up: this.input.get("p1_up"),
			p1_down: this.input.get("p1_down"),
		});
	}

	update_state(msg: StateMessage) {
		this.ball.speed.x = msg.ball.speed.x * this.canvas_ratio.w;
		this.ball.speed.y = msg.ball.speed.y * this.canvas_ratio.h;
		scale_vec(this.ball.speed, this.speed_ratio);

		this.ball.pos.x = msg.ball.x * this.canvas_ratio.w;
		this.ball.pos.y = msg.ball.y * this.canvas_ratio.h;
		this.paddle_p1.setY(msg.paddles.p1_Y * this.canvas_ratio.h);
		this.paddle_p2.setY(msg.paddles.p2_Y * this.canvas_ratio.h);
		this.score.p1 = msg.score.p1;
		this.score.p2 = msg.score.p2;
	}

	render() {
		this.context!.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.paddle_p1.render(this.context!);
		this.paddle_p2.render(this.context!);
		this.ball.render(this.context!);
	}

	deinit(): void {
		this.running = false;
		this.stop();
		socket.removeListener("pong");
	}

	init(): void {
		this.running = false;
		socket.addListener("pong", (msg) => {
			this.pong_event_listener(msg as PongMessage);
		});
		this.render();
		if (this.mode == Mode.local) {
			this.setLocalInputHandler();
		} else if (this.mode == Mode.remote) {
			this.setRemoteInputHandler();
		}
	}

	setLocalInputHandler() {
		window.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown") {
				this.input.set("p2_down", true);
			}
			if (event.key === "ArrowUp") {
				this.input.set("p2_up", true);
			}
			if (event.key === "s" || event.key === "S") {
				this.input.set("p1_down", true);
			}
			if (event.key === "w" || event.key === "W") {
				this.input.set("p1_up", true);
			}
		});

		window.addEventListener("keyup", (event) => {
			if (event.key === "ArrowDown") {
				this.input.set("p2_down", false);
			}
			if (event.key === "ArrowUp") {
				this.input.set("p2_up", false);
			}
			if (event.key === "s" || event.key === "S") {
				this.input.set("p1_down", false);
			}
			if (event.key === "w" || event.key === "W") {
				this.input.set("p1_up", false);
			}
		});
	}

	setRemoteInputHandler() {
		window.addEventListener("keydown", (event) => {
			if (event.key === "s" || event.key === "S") {
				this.input.set("p1_down", true);
			}
			if (event.key === "w" || event.key === "W") {
				this.input.set("p1_up", true);
			}
		});

		window.addEventListener("keyup", (event) => {
			if (event.key === "s" || event.key === "S") {
				this.input.set("p1_down", false);
			}
			if (event.key === "w" || event.key === "W") {
				this.input.set("p1_up", false);
			}
		});
	}



	update(): void {
		if (this.running == false) {
			return;
		}
        this.ball.tick();
		if (this.mode == Mode.remote) {
			if (this.side == Side.Left) {
				if (this.input.get("p1_down") && this.paddle_p1.pos.y + (this.move_offset) < this.canvas.height - this.move_offset) {
					this.paddle_p1.pos.y = this.paddle_p1.pos.y + ((this.move_offset) * this.speed_ratio);
				}
				if (this.input.get("p1_up") && this.paddle_p1.pos.y - (this.move_offset) > this.move_offset) {
					this.paddle_p1.pos.y = this.paddle_p1.pos.y - ((this.move_offset) * this.speed_ratio);
				}
			}
			else if (this.side == Side.Right) {
				if (this.input.get("p2_down") && this.paddle_p2.pos.y + (this.move_offset) < this.canvas.height - this.move_offset) {
					this.paddle_p2.pos.y = this.paddle_p2.pos.y + ((this.move_offset) * this.speed_ratio);
				}
				if (this.input.get("p2_up") && this.paddle_p2.pos.y - (this.move_offset) > this.move_offset) {
					this.paddle_p2.pos.y = this.paddle_p2.pos.y - ((this.move_offset) * this.speed_ratio);
				}
			}
		}
		else if (this.mode == Mode.local) {
			if (this.input.get("p1_down") && this.paddle_p1.pos.y + (this.move_offset) < this.canvas.height - this.move_offset) {
				this.paddle_p1.pos.y = this.paddle_p1.pos.y + ((this.move_offset) * this.speed_ratio);
			}
			if (this.input.get("p1_up") && this.paddle_p1.pos.y - (this.move_offset) > this.move_offset) {
				this.paddle_p1.pos.y = this.paddle_p1.pos.y - ((this.move_offset) * this.speed_ratio);
			}
			if (this.input.get("p2_down") && this.paddle_p2.pos.y + (this.move_offset) < this.canvas.height - this.move_offset) {
				this.paddle_p2.pos.y = this.paddle_p2.pos.y + ((this.move_offset) * this.speed_ratio);
			}
			if (this.input.get("p2_up") && this.paddle_p2.pos.y - (this.move_offset) > this.move_offset) {
				this.paddle_p2.pos.y = this.paddle_p2.pos.y - ((this.move_offset) * this.speed_ratio);
			}
		}
		this.render();
        if (this.shouldSendInputs()) {
            this.sendInputs();
        }
	}

	shouldSendInputs(): boolean {
		if (this.last_input.p1_down !== this.input.get("p1_down")) {
			return this.reset_last_input();
		}
		if (this.last_input.p1_up !== this.input.get("p1_up")) {
			return this.reset_last_input();
		}
		if (this.mode == Mode.local) {
			if (this.last_input.p2_down !== this.input.get("p2_down")) {
				return this.reset_last_input();
			}
			if (this.last_input.p2_up !== this.input.get("p2_up")) {
				return this.reset_last_input();
			}
		}
		return false;
	}

	reset_last_input(): boolean {
		this.last_input.p1_up = this.input.get("p1_up")!;
		this.last_input.p1_down = this.input.get("p1_down")!;
		if (this.mode == Mode.local) {
			this.last_input.p2_up = this.input.get("p2_up")!;
			this.last_input.p2_down = this.input.get("p2_down")!;
		}
		return true;
	}
}

export class PongPaddle extends PhysicObject {
	private texture: HTMLImageElement;

	constructor(position: Position, texture: HTMLImageElement, size: Size) {
		super(position, size, new Vector2D(0, 0));
		this.texture = texture;
	}

	render(context: CanvasRenderingContext2D): void {
		context.drawImage(
			this.texture,
			this.pos.x - (this.size.w / 2),
			this.pos.y - this.size.h / 2,
			this.size.w,
			this.size.h,
		);
	}
}

export class PongBall extends PhysicObject {
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
	private texture: HTMLImageElement;

	constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, texture: HTMLImageElement) {
		super(
			{ x: canvas.width / 2, y: canvas.height / 2 },
			{ w: canvas.height * 0.1 * 2.15, h: canvas.height * 0.1 },
			new Vector2D(0, 0),
		);
		this.canvas = canvas;
		this.context = context;
		this.texture = texture;
	}

	render(context: CanvasRenderingContext2D): void {
		context.drawImage(
			this.texture,
			this.pos.x - (this.size.w / 2),
			this.pos.y - (this.size.h / 2),
			this.size.w,
			this.size.h,
		);
	}
}
