import socket, {Message} from "./socket.js";

type Position = {x: number, y: number};
type Score = {p1: number, p2: number};
type Size = {w: number, h: number};

export enum Mode
{
	local = 'local',
	remote = 'remote'
}

enum TypeMsg
{
	state = 'state',
	input = 'input',
	error = 'error',
	score = 'score'
}

type LocalMessage = BaseMessage & {
	type: "input",
	p1_up: boolean,
	p1_down: boolean,
	p2_up: boolean,
	p2_down: boolean
}

enum State
{
	ended = "ended",
	paused = "paused",
	stopped = "stopped",
	not_started = "not_started",
	on_going = "on_going",
}

type BaseMessage = {
	source: string;
	type: string;
};

type StateMessage = BaseMessage & {
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

type ScoreMessage = BaseMessage & {
	type: "score",
	p1_score: number,
	p2_score: number
}

type PongMessage = InputMessage | StateMessage | Message;

function debug_message(msg: string, obj?: any): void
{
	console.debug(msg, obj ? JSON.parse(JSON.stringify(obj)) : "");
}

function draw_hit_box(context: CanvasRenderingContext2D, obj:PhysicObject): void
{
	context.lineWidth = 1;
	context.strokeStyle = "#ff0000";
	context.strokeRect(obj.pos.x - Math.floor(obj.size.w / 2), obj.pos.y - Math.floor(obj.size.h / 2),  obj.size.w, obj.size.h);
	context.strokeStyle = "#000000";
}

function dot_product(x1: number, y1: number, x2: number, y2: number) : number
{
	return ((x1 * x2) + (y1 * y2));
}

abstract class PhysicObject
{
	protected	position: Position;
	public 		speed: Vector2D;
	readonly	size: Size

	constructor(position: Position, size: Size, speed: Vector2D)
	{
		this.size = size;
		this.position = position;
		this.speed = speed;
	}

	updatePos() : void
	{
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
	}

	public get pos() : Position{
		return this.position;
	}

	public set pos(pos : Position)
	{
		this.position = pos;
	}
}

function resolution_update(canvas: HTMLCanvasElement) : CanvasRenderingContext2D
{

	const rect = canvas.getBoundingClientRect();
	const dpr = (window.devicePixelRatio / 2) || 1;
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	canvas.style.width = rect.width + "px";
	canvas.style.height = rect.height + "px";
	let context = canvas.getContext("2d")!;
	context.setTransform(dpr, 0, 0, dpr, 0, 0);
	context.imageSmoothingEnabled = false;
	// context.imageSmoothingQuality = "high";?

	return context;
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
	public x: number;
	public y: number;

	constructor(x: number, y: number)
	{
		this.x = x;
		this.y = y;
	}
}

function	coef_product(vec: Vector2D, coef: number)
{
	vec.x *= coef;
	vec.y *= coef;
}

export class Game
{
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D | null;
	private ball: PongBall;
	public paddle_p1: PongPaddle;
	public paddle_p2: PongPaddle;
	readonly score: Score;
	public input: Map<string, boolean>;
	private mode: Mode;

	private tick_rate: number;

	//HTMLElement
	private score_viewer: HTMLElement;
	private start_button : HTMLElement;

	private current_interval_id: number | null = null;
	private canvas_ratio: Size;
	private speed_ratio: number;
	private input_sender: () => void;

	constructor(html: HTMLElement, ball_texture: HTMLImageElement, paddle_texture: HTMLImageElement, mode: Mode)
	{
		this.canvas = html.querySelector("#pong-canvas")!;
		this.context = this.canvas.getContext("2d")!;
		this.score_viewer = html.querySelector("#panel-score")!;
		this.start_button = html.querySelector("#panel-start")!;
		this.score = {p1: 0, p2: 0};
		this.paddle_p1 = new PongPaddle({x: 0, y: this.canvas.height / 2} , paddle_texture);
		this.paddle_p2 = new PongPaddle({x: this.canvas.width, y: this.canvas.height / 2}, paddle_texture);
		this.ball = new PongBall(this.canvas, this.context, ball_texture);
		this.tick_rate = 60;
		this.input = new Map([["p1_up", false], ["p1_down", false], ["p2_up", false], ["p2_down", false]]);
		this.canvas_ratio = {w: this.canvas.width / 500, h: this.canvas.height / 250 };
		this.speed_ratio = (10 / this.tick_rate);
		this.mode = mode;
		if (this.mode == Mode.local)
			this.input_sender = () => this.send_local_input();
		else
			this.input_sender = () => this.send_remote_input();
		socket.addListener("pong", (msg) => {this.pong_event_listener(msg)})
	}

       pong_event_listener(msg: PongMessage): void
       {
               if (msg.type !== "state" && msg.type !== "score")
                       return;
               if (msg.type == "score")
               {
                       this.ball.pos.x = this.canvas.width / 2;
                       this.ball.pos.y = this.canvas.height / 2;
                       this.score.p1 = (msg as ScoreMessage).p1_score;
                       this.score.p2 = (msg as ScoreMessage).p2_score;
                       return ;
               }
               if ((msg as StateMessage).status == "not_started")
               {
                       this.current_interval_id = setInterval(() => {
                               this.update()}, 1000 / this.tick_rate);
               }
               else if ((msg as StateMessage).status == "on_going")
               {
				   clearInterval(this.current_interval_id!);
               }
			   else if ((msg as StateMessage).status == "ended")
			   {
				   clearInterval(this.current_interval_id!);
				   return;
			   }
               this.update_state(msg as StateMessage);
			   this.input_sender();
               this.current_interval_id = setInterval(() => {
                       this.update()}, 1000 / this.tick_rate);
       }

	send_local_input()
	{
		let msg : LocalMessage = {
			source: "pong",
			type: "input",
			p1_up: this.input.get("p1_up")!,
			p1_down: this.input.get("p1_down")!,
			p2_up: this.input.get("p2_up")!,
			p2_down: this.input.get("p2_down")!
		};
		socket.send(msg);
	}

	send_remote_input()
	{
		let msg : InputMessage = {
			source: "pong",
			type: "input",
			up: this.input.get("p1_up")!,
			down: this.input.get("p1_down")!
		};
		socket.send(msg);
	}

	update_state(msg: StateMessage)
	{
		msg.ball.speed.x = msg.ball.speed.x * this.canvas_ratio.w;
		msg.ball.speed.y = msg.ball.speed.y * this.canvas_ratio.h;
		coef_product(msg.ball.speed, this.speed_ratio);
		this.ball.speed = msg.ball.speed;
		this.paddle_p1.pos.y = msg.paddles.p1_Y * this.canvas_ratio.h;
		this.paddle_p2.pos.y = msg.paddles.p2_Y * this.canvas_ratio.h;
	}

	update_texture_pos()
	{
		this.paddle_p1.updateTextPos(this.context!);
		this.paddle_p2.updateTextPos(this.context!);
		this.ball.updateTextPos(this.context!);
	}

	game_init() : void
	{
		this.update_texture_pos();
		if (this.mode == Mode.local)
		{
			window.addEventListener("keydown", (event) => {
				if (event.key === "ArrowDown")
					this.input.set("p2_down", true);
				if (event.key === "ArrowUp")
					this.input.set("p2_up", true);
				if (event.key === "s" || event.key === "S")
					this.input.set("p1_down", true);
				if (event.key === "w" || event.key === "W")
					this.input.set("p1_up", true);
			});

			window.addEventListener("keyup", (event) => {
				if (event.key === "ArrowDown")
					this.input.set("p2_down", false);
				if (event.key === "ArrowUp")
					this.input.set("p2_up", false);
				if (event.key === "s" || event.key === "S")
					this.input.set("p1_down", false);
				if (event.key === "w" || event.key === "W")
					this.input.set("p1_up", false);
			});
		}
		else if (this.mode == Mode.remote)
		{
			window.addEventListener("keydown", (event) => {
				if (event.key === "s" || event.key === "S")
					this.input.set("p1_down", true);
				if (event.key === "w" || event.key === "W")
					this.input.set("p1_up", true);
			});

			window.addEventListener("keyup", (event) => {
				if (event.key === "s" || event.key === "S")
					this.input.set("p1_down", false);
				if (event.key === "w" || event.key === "W")
					this.input.set("p1_up", false);
			});
		}
	}

	update() : void
	{
		this.context!.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ball.updatePos();
		this.score_viewer.innerHTML = this.score.p1.toString() + " - " + this.score.p2.toString();
		this.update_texture_pos();
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
	private	context: CanvasRenderingContext2D;
	private		texture : HTMLImageElement;

	constructor(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D ,texture : HTMLImageElement)
	{
		super({x: canvas.width / 2, y: canvas.height / 2}, {w:10, h:10}, new Vector2D(0,0));
		this.canvas = canvas;
		this.context = context;
		this.texture = texture;
	}

	updateTextPos(context : CanvasRenderingContext2D): void {
		context.drawImage(this.texture, this.pos.x - (this.size.w / 2), this.pos.y - (this.size.w / 2), this.size.w, this.size.w);
	}
}
