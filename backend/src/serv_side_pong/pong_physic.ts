import socket from "../socket";
import {clearInterval, setInterval} from "node:timers";
import * as db from "../db/methods";
import {
	InputMessage,
	LocalMessage,
	Mode,
	Position,
	Score,
	ScoreMessage,
	Size,
	State,
	StateMessage,
	TypeMsg,
	Vector2D
} from "./pong_types";


export function create_game(game_id: number, p1_uuid: string, p2_uuid: string, mode: Mode)
{
	let game = new ServerSidedGame(game_id, p1_uuid, p2_uuid, mode);
	game.start();

}

const server_tickrate :number = 10;

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
		this.position.x += this._speed.getX();
		this.position.y += this._speed.getY();
	}

	public get pos() : Position{
		return this.position;
	}

	public get speed() : Vector2D
	{
		return this._speed;
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
	readonly p1_uuid: string;
	readonly p2_uuid: string;

	//loop
	private tick_interval: number;
	private tick_rate: number;
	private game_id: number;
	private move_offset: number;
	private is_running: boolean;

	constructor(game_id: number, p1_uuid: string, p2_uuid: string, mode: Mode)
	{
		this.game_id = game_id;
		this.table = new PongTable({w: 500, h: 250});
		this.score = {p1: 0, p2: 0};
		this.paddle_p1 = new PongPaddle({x: 0, y: this.table.height / 2});
		this.paddle_p2 = new PongPaddle({x: this.table.width, y: this.table.height / 2});
		this.tick_rate = server_tickrate;
		this.tick_interval = 1000 / this.tick_rate;
		this.is_running = false;
		this.input = new Map([["p1_up", false], ["p1_down", false], ["p2_up", false], ["p2_down", false]]);
		this.move_offset = this.table.height * 0.1;
		this.p1_uuid = p1_uuid;
		this.p2_uuid = p2_uuid;
		this.ball = new PongBall(this.table, this.score, this.paddle_p1, this.paddle_p2, this.p1_uuid, this.p2_uuid, this.game_id);

		if (mode == Mode.local)
		{
			console.log("local !!!!!");
			socket.addListener(this.p1_uuid, "pong", (msg) => {this.local_input_listener(msg)});
		}
		else if (mode == Mode.remote)
		{
			console.log("remote !!!!!");
			socket.addListener(this.p1_uuid, "pong", (msg) => {this.p1_event_listener(msg)});
			socket.addListener(this.p2_uuid, "pong", (msg) => {this.p2_event_listener(msg)});
		}
	}


	p1_event_listener(msg: InputMessage)
	{
		if (msg.topic == 'pong' && msg.type == 'input')
		{
			this.input.set("p1_up", msg.up);
			this.input.set("p1_down",msg.down);
			console.log("p1_event_listener %d", this.input.get("p1_down"));
		}
	}

	p2_event_listener(msg: InputMessage)
	{
		if (msg.topic == 'pong' && msg.type == 'input')
		{
			this.input.set("p2_up", msg.up);
			this.input.set("p2_down",msg.down);
			console.log("p2_event_listener %d", this.input.get("p2_down"));
		}
	}

	local_input_listener(msg: LocalMessage)
	{
		if (msg.topic !== "pong" || msg.type !== "input")
			return;
		this.input.set("p1_up",msg.p1_up);
		this.input.set("p1_down",msg.p1_down);
		this.input.set("p2_up",msg.p2_up);
		this.input.set("p2_down",msg.p2_down);
	}

	send_to_players(state: State)
	{
		let init_msg : StateMessage = {
			topic: "pong",
			type: TypeMsg.state,
			ball: {x: this.ball.pos.x, y: this.ball.pos.y, speed: this.ball.speed},
			paddles: {p1_Y: this.paddle_p1.pos.y, p2_Y: this.paddle_p2.pos.y},
			status: state,
		} as StateMessage;
		socket.send(this.p1_uuid, init_msg);
		socket.send(this.p2_uuid, init_msg);
	}

	start() : void
	{
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.ball.respawn((Math.random() < 0.5 ? -1 : 1));
		this.send_to_players(State.not_started);
		this.is_running = true;

		let id_interval = setInterval(() => {
				this.update();
				if (!this.is_running)
					clearInterval(id_interval);
		}, this.tick_interval);
	}

	update()
	{
		if (this.input.get("p1_up") && this.paddle_p1.pos.y >= ( this.move_offset + (this.paddle_p1.size.h / 2)))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y - this.move_offset;
		if (this.input.get("p1_down") && this.paddle_p1.pos.y <= this.table.height - (this.move_offset +  (this.paddle_p1.size.h / 2)))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y + this.move_offset;
		if (this.input.get("p2_up") && this.paddle_p2.pos.y >= (this.move_offset +  (this.paddle_p1.size.h / 2)))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y - this.move_offset;
		if (this.input.get("p2_down") && this.paddle_p2.pos.y <= this.table.height - (this.move_offset +  (this.paddle_p1.size.h / 2)))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y + this.move_offset;
		this.ball.updatePos();
		if (this.score.p1 >= 7) {
			this.end();
		}
		else if (this.score.p2 >= 7)
		{
			this.end();
		}
		this.send_to_players(State.on_going);
	}

	end()
	{
		console.log("end");
		this.is_running = false;
		let discard = db.endMatch(this.game_id);

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
	private		p1_ws : string;
	private		p2_ws : string;
	private		game_id : number;

	constructor(table: PongTable, score: Score, paddle_p1: PongPaddle, paddle_p2: PongPaddle, p1_ws: string, p2_ws: string, game_id: number)
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

		this.p1_ws = p1_ws;
		this.p2_ws = p2_ws;
		this.game_id = game_id;
	}

	send_score_to_players()
	{
		let init_msg : ScoreMessage = {
			topic: "pong",
			type: TypeMsg.score,
			p1_score: this.score.p1,
			p2_score: this.score.p2
		} as ScoreMessage;

		socket.send(this.p1_ws, init_msg);
		socket.send(this.p2_ws, init_msg);
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
			this.speed.coef_product(1.05);
		}
	}

	respawn(side:number)
	{
		this.pos.x = this.table.width / 2;
		this.pos.y = this.table.height / 2;
		//TODO remettre l'angle aleatoire

		this.speed.setX = 5;
		this.speed.setY = 5;
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
			let discard = db.updateMatchInfo(this.game_id, this.score.p1, this.score.p2);
			this.respawn(next_side);
			this.send_score_to_players();
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
		this.test_collide({x: 0, y: (this.size.h / 2)}, this.top_normal);
		this.test_collide({x: 0, y: this.table.height - (this.size.h / 2)}, this.bottom_normal);
		this.test_collide_paddle({x: this.paddle_p2.pos.x - (this.paddle_p2.size.w / 2) - (this.size.w / 2), y: this.paddle_p2.pos.y}, this.right_normal);
		this.test_collide_paddle({x: this.paddle_p1.pos.x + (this.paddle_p1.size.w / 2) + (this.size.w / 2), y:this.paddle_p1.pos.y}, this.left_normal);
		this.test_collide_score({x: 0, y: 0}, this.left_normal);
		this.test_collide_score({x: this.table.width, y: 0}, this.right_normal);

	}
}
