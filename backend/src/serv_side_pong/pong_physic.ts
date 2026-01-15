import * as logger from './myLogger';
import socket from "../socket";
import {setInterval} from "node:timers";


type Speed = {dx: number, dy: number};

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
	not_started = "not_started",
	on_going = "on_going",
}

type BaseMessage = {
	source: string;
	type: string;
};

type StateMessage = BaseMessage &
{
	"type": "state",
	"ball": {
		"x": number, "y": number, "speed": Speed,
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

type Message = BaseMessage | StateMessage | InputMessage ;

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
	protected	speed: Vector2D;
	readonly	size: Size

	constructor(position: Position, size: Size, speed: Vector2D)
	{
		this.size = size;
		this.position = position;
		this.speed = speed;
	}

	updatePos() : void
	{
		this.position.x += this.speed.getX();
		this.position.y += this.speed.getY();
	}

	public get pos() : Position{
		return this.position;
	}
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

class PongTable
{
	readonly size: Size;

	constructor(size: Size) {
		this.size = size;
	}

	get width()
	{
		return this.size.w;
	}

	get height()
	{
		return this.size.h;
	}
}

export class ServerSidedGame
{
	private table: PongTable;
	private ball: PongBall;
	public paddle_p1: PongPaddle;
	public paddle_p2: PongPaddle;
	readonly score: Score;
	public input: Map<string, boolean>;
	readonly p1_ws: string;
	readonly p2_ws: string;

	//loop
	private last_timestamp: number;
	private buffer: number;
	private tick_interval: number;
	private tick_rate: number;
	private is_running: Boolean;

	constructor(p1ws: string, p2ws: string)
	{
		this.table = new PongTable({w: 1000, h: 500});
		this.score = {p1: 0, p2: 0};
		this.paddle_p1 = new PongPaddle({x: 0, y: this.table.height / 2});
		this.paddle_p2 = new PongPaddle({x: this.table.width, y: this.table.height / 2});
		this.ball = new PongBall(this.table, this.score, this.paddle_p1, this.paddle_p2);
		this.is_running = false;
		this.last_timestamp = 0;
		this.buffer = 0;
		this.tick_rate = 60;
		this.tick_interval = 1000 / this.tick_rate;
		this.input = new Map([["w", false], ["s", false], ["ArrowUp", false], ["ArrowDown", false]]);

		this.p1_ws = p1ws;
		this.p2_ws = p2ws;
	}

	send_to_players(state: State)
	{
		let init_msg : StateMessage = {
			source: "pong",
			type: TypeMsg.state,
			ball: {x: this.ball.pos.x, y: this.ball.pos.y},
			paddles: {p1_Y: this.paddle_p1.pos.y, p2_Y: this.paddle_p2.pos.y},
			status: state,
		} as StateMessage;
		socket.send(this.p1_ws, init_msg);
		socket.send(this.p2_ws, init_msg);
	}

	game_init() : void
	{
		let init_msg : StateMessage = {
			source: "pong",
			type: TypeMsg.state,
			ball: {x: this.ball.pos.x, y: this.ball.pos.y},
			paddles: {p1_Y: this.paddle_p1.pos.y, p2_Y: this.paddle_p2.pos.y},
			status: State.not_started,
		} as StateMessage;

		this.is_running = false;

	}

	start() : void
	{
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.ball.spawn_ball((Math.random() < 0.5 ? -1 : 1));
		this.is_running = true;
		setInterval(() => {
				this.update();
		}, 1000 / this.tick_rate);
	}

	resume() : void
	{
		if (this.is_running == false)
		{
			this.is_running = true;
		}
	}

	pause() : void
	{
		if (this.is_running)
		{
			this.is_running = false;
		}
	}

	update()
	{
		if (this.input.get("w") && this.paddle_p1.pos.y >= ( 5 + (this.paddle_p1.size.h / 2)))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y - 5;
		if (this.input.get("s")  && this.paddle_p1.pos.y <= this.table.height - (5 +  (this.paddle_p1.size.h / 2)))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y + 5;
		if (this.input.get("ArrowUp") && this.paddle_p2.pos.y >= (5 +  (this.paddle_p1.size.h / 2)))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y - 5;
		if (this.input.get("ArrowDown") && this.paddle_p2.pos.y <= this.table.height - (5 +  (this.paddle_p1.size.h / 2)))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y + 5;

		this.ball.updatePos();
		if (this.score.p1 >= 7) {
			this.is_running = false;
		}
		else if (this.score.p2 >= 7)
		{
			this.is_running = false;
		}
		this.send_to_players(State.on_going);
		logger.error("oui", "latest_pong.log");
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

	constructor(position: Position)
	{
		super(position, {w: 10, h: 30},new Vector2D(0,0));
	}
}

export class PongBall extends PhysicObject
{
	private		table: PongTable;
	private		score: Score;
	readonly	paddle_p1:PongPaddle;
	readonly	paddle_p2:PongPaddle;
	readonly	top_normal : Vector2D;
	readonly	bottom_normal : Vector2D;
	readonly	left_normal : Vector2D;
	readonly	right_normal : Vector2D;

	constructor(table: PongTable, score: Score, paddle_p1: PongPaddle, paddle_p2: PongPaddle)
	{
		super({x: table.width / 2, y: table.height / 2}, {w:10, h:10}, new Vector2D(0,0));
		this.table = table;
		this.score = score;
		this.paddle_p1 = paddle_p1;
		this.paddle_p2 = paddle_p2;

		this.top_normal = new Vector2D(0, 1);
		this.bottom_normal = new Vector2D(0, -1);
		this.left_normal = new Vector2D(1, 0);
		this.right_normal = new Vector2D(-1, 0);
	}

	test_collide(line_position: Position,normal: Vector2D)
	{
		var distance_from_line = dot_product(
			this.position.x - line_position.x,
			this.position.y - line_position.y,
			normal.getX(), normal.getY()
		);
		if (distance_from_line < this.size.w / 2)
		{
			let speed_normal:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getX(), normal.getY());
			let speed_tangent:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getY(), -normal.getX());
			this.speed.setX = -(speed_normal * normal.getX()) + (speed_tangent * normal.getY());
			this.speed.setY = -(speed_normal * normal.getY()) + (speed_tangent * -normal.getX());
		}
	}

	spawn_ball(side:number)
	{
		this.pos.x = this.table.width / 2;
		this.pos.y = this.table.height / 2;
		//TODO remettre l'angle aleatoire

		// let new_dir:number = Math.random() * 5 * ((Math.random() * 2) - 1);
		// this.speed.setX = (3 * side);
		// this.speed.setY = (new_dir);
		this.speed.setX = 0;
		this.speed.setY = 1;
	}

	test_collide_score(line_position: Position,normal: Vector2D)
	{
		var distance_from_line = dot_product(
			this.position.x - line_position.x,
			this.position.y - line_position.y,
			normal.getX(), normal.getY()
		);

		var next_side;
		if (distance_from_line < this.size.w / 2)
		{
			next_side = 1;
			if (this.pos.x <= this.size.w)
				this.score.p2++;
			else if (this.pos.x >= this.table.width - this.size.w)
			{
				this.score.p1++;
				next_side = -1;
			}
			this.spawn_ball(next_side);
		}
	}

	test_collide_paddle(paddle_position: Position,normal: Vector2D)
	{
		var distance_from_line = dot_product(
			this.position.x - paddle_position.x,
			this.position.y - paddle_position.y,
			normal.getX(), normal.getY()
		);

		if ((distance_from_line <= this.size.w / 2)
			&& (paddle_position.y - this.position.y > -(this.paddle_p1.size.h / 2))
			&& (paddle_position.y - this.position.y) < (this.paddle_p1.size.h / 2))
		{
			var new_normal = normal;

			new_normal.unit_himself();
			this.position.x = paddle_position.x + ((this.size.w / 2) * normal.getX());
			let speed_normal:number = dot_product(this.speed.getX(), this.speed.getY(), new_normal.getX(), new_normal.getY());
			let speed_tangent:number = dot_product(this.speed.getX(), this.speed.getY(), new_normal.getY(), -new_normal.getX());
			this.speed.setX = -(speed_normal * new_normal.getX()) + (speed_tangent * (new_normal.getY()));
			this.speed.setY = -(speed_normal * (new_normal.getY())) + (speed_tangent * -new_normal.getX());
			this.speed.coef_product(1.05);
		}
	}

	updatePos(): void
	{
		this.position.x += this.speed.getX();
		this.position.y += this.speed.getY();
		this.test_collide({x: 0, y: 0}, this.top_normal);
		this.test_collide({x: 0, y: this.table.height}, this.bottom_normal);
		this.test_collide_paddle({x: this.paddle_p2.pos.x - (this.paddle_p2.size.w / 2), y: this.paddle_p2.pos.y}, this.right_normal);
		this.test_collide_paddle({x: this.paddle_p1.pos.x + (this.paddle_p1.size.w / 2), y:this.paddle_p1.pos.y}, this.left_normal);
		this.test_collide_score({x: 0, y: 0}, this.left_normal);
		this.test_collide_score({x: this.table.width, y: 0}, this.right_normal);

	}
}
