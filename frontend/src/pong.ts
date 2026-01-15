import socket, {Message} from "./socket.js";
import {api} from "./api";
let DEBUG = 0;
type Speed = {dx: number; dy: number};

enum TypeMsg
{
	state = 'state',
	input = 'input',
	error = 'error',
}

enum State
{
	ended = "ended",
	paused = "paused",
	stopped = "stopped",
	not_started = "not_started"
}

type BaseMessage = {
	source: string;
	type: string;
};

type StateMessage = BaseMessage &
	{
		"type": "state",
		"ball": {
			"x": number, "y": number, "speed": Vector2D,
		},
		"paddles": {
			"p1_Y": number,
			"p2_Y": number
		},
		"score": { "p1": number, "p2": number },
		"status": State;
	}

type InputMessage = BaseMessage & {
	type: "input",
	up: boolean,
	down: boolean
}

type PongMessage = InputMessage | StateMessage | Message;

function debug_message(msg: string, obj?: any): void
{
	if (DEBUG == 1)
		console.debug(msg, obj ? JSON.parse(JSON.stringify(obj)) : "");
}

function draw_hit_box(context: CanvasRenderingContext2D, obj:PhysicObject): void
{
	context.lineWidth = 1;
	context.strokeStyle = "#ff0000";
	context.strokeRect(obj.pos.x - Math.floor(obj.size.w / 2), obj.pos.y - Math.floor(obj.size.h / 2),  obj.size.w, obj.size.h);
	context.strokeStyle = "#000000";
}

type Position = {x: number, y: number};
type Size = {w: number, h: number};
type Score = {p1: number, p2: number};
type Input = {name: string, value: boolean};

function dot_product(x1: number, y1: number, x2: number, y2: number) : number
{
	return ((x1 * x2) + (y1 * y2));
}

abstract class PhysicObject
{
	protected	position: Position;
	protected	_speed: Vector2D;
	readonly	size: Size

	constructor(position: Position, size: Size, speed: Vector2D)
	{
		this.size = size;
		this.position = position;
		this._speed = speed;
	}

	updatePos() : void
	{
		console.debug("updatePos" + this._speed);
		this.position.x += this._speed.getX();
		this.position.y += this._speed.getY();
	}

	public get pos() : Position{
		return this.position;
	}

	set speed(speed: Vector2D)
	{
		this._speed = speed;
	}
}

function resolution_update(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D)
{

		// const angle = Math.PI / 2;
		// if (window.innerWidth < window.innerHeight)
		// {
		// 	debug_message("context rotation");
		// 	let tmp = canvas.width;
		// 	canvas.width = canvas.height;
		// 	canvas.height = tmp;
		// 	context.translate(canvas.height, 0)
		// 	context.setTransform(
		// 		Math.cos(angle), Math.sin(angle),
		// 		-Math.sin(angle), Math.cos(angle),
		// 		0, 0
		// 	);
		//
		// }

}

export class Vector2D
{
	private x: number;
	private y: number;
	private norm: number;

	constructor(x: number, y: number)
	{
		this.x = x;
		this.y = y;
		this.norm = Math.sqrt(this.x * this.x + this.y * this.y);
	}

	addVector2D(other: Vector2D)
	{
		this.x += other.x;
		this.y += other.y;
		this.updateValue();
	}

	coef_product(coef: number)
	{
		this.x *= coef;
		this.y *= coef;
		this.updateValue();
	}

	private updateValue()
	{
		this.norm = Math.sqrt(this.x * this.x + this.y * this.y);
	}

	unitVector()
	{
		return ({x: (this.x / this.norm), y: (this.y / this.norm), norm: 1});
	}

	unit_himself()
	{
		this.x = this.x / this.norm;
		this.y = this.y / this.norm;
		this.updateValue();
	}

	getX()
	{
		return this.x;
	}

	getY()
	{
		return this.y;
	}

	public set setY(value: number) {
		this.y = value;
	}

	public set setX(value: number) {
	this.x = value;
	}
}

export class Game
{
	private canvas: HTMLCanvasElement;
	readonly context: CanvasRenderingContext2D;
	private ball: PongBall;
	public paddle_p1: PongPaddle;
	public paddle_p2: PongPaddle;
	readonly score: Score;
	public input: Map<string, boolean>;

	//loop
	private last_timestamp: number;
	private buffer: number;
	private tick_interval: number;
	private tick_rate: number;
	private is_running: Boolean;

	//HTMLElement
	private score_viewer: HTMLElement;
	private start_button : HTMLElement;

	constructor(html: HTMLElement, ball_texture: HTMLImageElement, paddle_texture: HTMLImageElement)
	{
		this.canvas = html.querySelector("#pong-canvas")!;
		// this.canvas.width = this.canvas.width * 2;
		// this.canvas.height = this.canvas.height * 2;
		this.context = this.canvas.getContext("2d")!;

		// html.addEventListener('load', () => { resolution_update(this.canvas, this.context); });
		// this.canvas.addEventListener("resize", () => resolution_update(this.canvas));
		this.score_viewer = html.querySelector("#panel-score")!;
		this.start_button = html.querySelector("#panel-start")!;
		this.score = {p1: 0, p2: 0};
		this.paddle_p1 = new PongPaddle({x: 0, y: this.canvas.height / 2} , paddle_texture);
		this.paddle_p2 = new PongPaddle({x: this.canvas.width, y: this.canvas.height / 2}, paddle_texture);
		this.ball = new PongBall(this.canvas, this.score, this.paddle_p1, this.paddle_p2, ball_texture);
		this.is_running = false;
		this.last_timestamp = 0;
		this.buffer = 0;
		this.tick_rate = 60;
		this.tick_interval = 1000 / this.tick_rate;
		this.input = new Map([["w", false], ["s", false], ["ArrowUp", false], ["ArrowDown", false]]);

		socket.addListener("pong", (msg) => {this.pong_event_listener(msg)});

	}

	pong_event_listener(msg: PongMessage): void
	{
		if (msg.type !== "state")
			return;
		// console.debug("pong_event_listener :", msg);
		this.update_state(msg as StateMessage);
	}

	update_state(msg: StateMessage)
	{
		this.ball.speed = msg.ball.speed;
		this.paddle_p2.pos.y = msg.paddles.p2_Y;
		this.paddle_p1.pos.y = msg.paddles.p1_Y;
		this.update();
	}

	update_paddle_texture() : void
	{
		if (DEBUG == 1)
		{
			draw_hit_box(this.context, this.paddle_p1);
			draw_hit_box(this.context, this.paddle_p2);
		}
		this.paddle_p1.updateTextPos(this.context);
		this.paddle_p2.updateTextPos(this.context);
	}

	update_ball_texture() : void
	{
		if (DEBUG == 1)
			draw_hit_box(this.context, this.ball);
		this.ball.updateTextPos(this.context);
	}

	update_texture_pos()
	{
		this.update_paddle_texture();
		this.update_ball_texture();
	}

	game_init() : void
	{
		this.is_running = false;
		this.update_texture_pos();
		window.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown")
				this.input.set("ArrowDown", true);
			if (event.key === "ArrowUp")
				this.input.set("ArrowUp", true);
			if (event.key === "s" || event.key === "S")
				this.input.set("s", true);
			if (event.key === "w" || event.key === "W")
				this.input.set("w", true);
		}
		);

		window.addEventListener("keyup", (event) => {
			if (event.key === "ArrowDown")
				this.input.set("ArrowDown", false);
			if (event.key === "ArrowUp")
				this.input.set("ArrowUp", false);
			if (event.key === "s" || event.key === "S")
				this.input.set("s", false);
			if (event.key === "w" || event.key === "W")
				this.input.set("w", false);
		}
		);

	}

	start() : void
	{
		resolution_update(this.canvas, this.context);
		debug_message("start");
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.is_running = true;
	}

	resume() : void
	{
		debug_message("resume");
		if (this.is_running == false)
		{
			this.canvas.hidden = false;
			this.is_running = true;
		}

	}

	pause() : void
	{
		debug_message("pause");
		if (this.is_running)
		{
			this.is_running = false;
			this.canvas.hidden = true;
		}
	}

	update() : void
	{
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ball.updatePos();
		this.score_viewer.innerHTML = this.score.p1.toString() + " - " + this.score.p2.toString();
		this.update_texture_pos();

		if (this.score.p1 >= 7) {
			this.score_viewer.innerHTML = "Player 1 Win ! Rematch ?";
			this.is_running = false;
			this.start_button.hidden = false;
		}
		else if (this.score.p2 >= 7)
		{
			this.score_viewer.innerHTML = "Player 2 Win ! Rematch ?";
			this.is_running = false;
			this.start_button.hidden = false;
		}
	}

	reset_game() : void
	{
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.is_running = false;
	}
}

export class PongPaddle extends PhysicObject
{
	private texture : HTMLImageElement;

	constructor(position: Position, texture : HTMLImageElement)
	{
		super(position, {w: 10, h: 30},new Vector2D(0,0));
		this.texture = texture;
	}

	updateTextPos(context : CanvasRenderingContext2D): void {
		context.drawImage(this.texture, this.pos.x - (this.size.w / 2), (this.pos.y - this.size.h / 2), this.size.w, this.size.h);
	}
}

export class PongBall extends PhysicObject
{
	private		canvas: HTMLCanvasElement;
	private		score: Score;
	readonly	paddle_p1:PongPaddle;
	readonly	paddle_p2:PongPaddle;
	private		texture : HTMLImageElement;
	readonly	top_normal : Vector2D;
	readonly	bottom_normal : Vector2D;
	readonly	left_normal : Vector2D;
	readonly	right_normal : Vector2D;

	constructor(canvas: HTMLCanvasElement, score: Score, paddle_p1: PongPaddle, paddle_p2: PongPaddle, texture : HTMLImageElement)
	{
		super({x: canvas.width / 2, y: canvas.height / 2}, {w:10, h:10}, new Vector2D(0,0));
		this.canvas = canvas;
		this.score = score;
		this.paddle_p1 = paddle_p1;
		this.paddle_p2 = paddle_p2;
		this.texture = texture;

		this.top_normal = new Vector2D(0, 1);
		this.bottom_normal = new Vector2D(0, -1);
		this.left_normal = new Vector2D(1, 0);
		this.right_normal = new Vector2D(-1, 0);
	}

	updateTextPos(context : CanvasRenderingContext2D): void {
		context.drawImage(this.texture, this.pos.x - (this.size.w / 2), this.pos.y - (this.size.w / 2), this.size.w, this.size.w);
	}
}
