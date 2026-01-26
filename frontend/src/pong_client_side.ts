import socket, { InputMessage, LocalMessage, Message, PongMessage, ScoreMessage, StateMessage } from "./socket.js";
import {api, Status} from "./api.js";
import {notify} from "./pages/utils/notifs.js";

type Position = { x: number, y: number };
type Score = { p1: number, p2: number };
type Size = { w: number, h: number };

// TODO:
//  - smooth les mouvements des paddles
//  - les inputs marchent plus si je refresh
//  - check de la position de la balle et la replacer si jamais


const width_server = 500;
const height_server = width_server * (9/16);

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
	started = "started",
	ongoing = "ongoing",
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
	readonly score: Score;
	public input: Map<string, boolean>;
	private mode: Mode;
	private tick_rate: number;

	// HTMLElement
	private score_viewer: HTMLElement;

	private current_interval_id: number | null = null;
	private canvas_ratio: Size;
	private speed_ratio: number;
	private sendInputs: () => void;
	running: boolean = false;
	private matchId : number;

	constructor(html: HTMLElement, ball_texture: HTMLImageElement, paddle_texture: HTMLImageElement, mode: Mode, matchId: number) {
		this.matchId = matchId;
		this.canvas = html.querySelector("#pong-canvas")! as HTMLCanvasElement;
		this.context = this.canvas.getContext("2d")!;
		this.score_viewer = html.querySelector("#panel-score")! as HTMLElement;
		this.score = { p1: 0, p2: 0 };
		this.canvas_ratio = { w: this.canvas.width / width_server, h: this.canvas.height / height_server };
		const paddle_size = { w: this.canvas.width * 0.03, h: this.canvas.height * 0.2 };
		this.paddle_p1 = new PongPaddle({ x: 0, y: this.canvas.height / 2 }, paddle_texture, paddle_size);
		this.paddle_p2 = new PongPaddle(
			{ x: this.canvas.width, y: this.canvas.height / 2 },
			paddle_texture,
			paddle_size,
		);
		this.ball = new PongBall(this.canvas, this.context, ball_texture);
		this.tick_rate = 60;
		this.input = new Map([["p1_up", false], ["p1_down", false], ["p2_up", false], ["p2_down", false]]);
		this.speed_ratio = 10 / this.tick_rate;
		this.mode = mode;
		if (this.mode == Mode.local) {
			this.sendInputs = () => this.send_local_input();
		} else {
			this.sendInputs = () => this.send_remote_input();
		}
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
			return;
		}
		const state = msg as StateMessage;
		if (state.status == PongStatus.started) {
			this.run();
		} else if (state.status == PongStatus.ended) {
			this.stop();
			alert("Match ended.");
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
			topic: "pong",
			type: "input",
			p1_up: this.input.get("p1_up")!,
			p1_down: this.input.get("p1_down")!,
			p2_up: this.input.get("p2_up")!,
			p2_down: this.input.get("p2_down")!,
		};
		socket.send(msg);
	}

	send_remote_input() {
		let msg: InputMessage = {
			topic: "pong",
			type: "input",
			up: this.input.get("p1_up")!,
			down: this.input.get("p1_down")!,
		};
		debug_message("remote input", msg);
		socket.send(msg);
	}

	update_state(msg: StateMessage) {
		// const test = api.get(`/api/state/game?matchId=${this.matchId}`).then((test) => {
		// 	if (!test || !test.payload)
		// 		return;
		// 	if (test.status != Status.success)
		// 		return notify("Error: " + test.payload.message, "error");
		// 	msg = test.payload;
			this.ball.speed.x = msg.ball.speed.x * this.canvas_ratio.w;
			this.ball.speed.y = msg.ball.speed.y * this.canvas_ratio.h;
			scale_vec(this.ball.speed, this.speed_ratio);

			this.ball.pos.x = msg.ball.x * this.canvas_ratio.w;
			this.ball.pos.y = msg.ball.y * this.canvas_ratio.h;
			this.paddle_p1.setY(msg.paddles.p1_Y * this.canvas_ratio.h);
			this.paddle_p2.setY(msg.paddles.p2_Y * this.canvas_ratio.h);
		// });
	}

	render() {
		this.context!.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.paddle_p1.render(this.context!);
		this.paddle_p2.render(this.context!);
		this.ball.render(this.context!);
		draw_hit_box(this.context!, this.ball as PhysicObject);
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
		this.render();
		this.score_viewer.innerText = this.score.p1.toString() + " - " + this.score.p2.toString();
		if (this.shouldSendInputs()) {
			this.sendInputs();
		}
	}

	shouldSendInputs(): boolean {
		for (const value of this.input.values()) {
			if (value == true)
				return true;
		}
		return false;
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
			{ w: canvas.height * 0.1, h: canvas.height * 0.1 },
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
			this.pos.y - (this.size.w / 2),
			this.size.w,
			this.size.w,
		);
	}
}
