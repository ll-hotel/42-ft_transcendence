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
	readonly	size: Size | number;

	constructor(position: Position, size: Size | number, speed: Vector2D)
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

export class ServerGame
{
	private table: PongTable;
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

	constructor(html: HTMLElement, ball_texture: HTMLImageElement, paddle_texture: HTMLImageElement)
	{
		this.table = new PongTable();
		this.score= {p1: 0, p2: 0};
		this.paddle_p1 = new PongPaddle({x: 0, y: this.table.height / 2} , paddle_texture);
		this.paddle_p2 = new PongPaddle({x: this.table.width, y: this.table.height / 2}, paddle_texture);
		this.ball = new PongBall(this.table, this.score, this.paddle_p1, this.paddle_p2, ball_texture);
		this.is_running = false;
		this.last_timestamp = 0;
		this.buffer = 0;
		this.tick_rate = 60;
		this.tick_interval = 1000 / this.tick_rate;
		this.input = new Map([["w", false], ["s", false], ["ArrowUp", false], ["ArrowDown", false]]);
	}

	game_init() : void
	{
		this.is_running = false;
		this.score.p1 = 0;
		this.score.p2 = 0;
	}

	start() : void
	{
		console.log("start");
		this.ball.spawn_ball((Math.random() < 0.5 ? -1 : 1));
		this.is_running = true;
		this.loop(this.last_timestamp);
	}

	resume() : void
	{
		console.log("resume");
		if (this.is_running == false)
		{
			this.is_running = true;
			this.loop(this.last_timestamp);
		}
	}

	pause() : void
	{
		console.log("pause");
		if (this.is_running)
			this.is_running = false;
	}

	end() : void
	{
		// affichage du score
		// envoi des resultats a la DB (historique etc)
		//proposition de nouvelle partie
	}

	private loop = (timestamp: number) =>
	{
		if (!this.is_running)
			return;
		const frame_time = timestamp - this.last_timestamp;
		this.last_timestamp = timestamp;
		this.buffer += frame_time;
		while (this.buffer >= this.tick_interval)
		{
			this.update(this.tick_interval);
			this.buffer -= this.tick_interval;
		}
	}

	update(t: number) : void
	{
		if (this.input.get("w") && this.paddle_p1.pos.y >= ( 5 + (this.paddle_p1.size as Size).h / 2))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y - 5;
		if (this.input.get("s")  && this.paddle_p1.pos.y <= this.table.height - (5 +  (this.paddle_p1.size as Size).h / 2))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y + 5;
		if (this.input.get("ArrowUp") && this.paddle_p2.pos.y >= (5 +  (this.paddle_p1.size as Size).h / 2))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y - 5;
		if (this.input.get("ArrowDown") && this.paddle_p2.pos.y <= this.table.height - (5 +  (this.paddle_p1.size as Size).h / 2))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y + 5;
		this.ball.updatePos();

		if (this.score.p1 >= 7) {
			this.is_running = false;
		}
		else if (this.score.p2 >= 7)
		{
			this.is_running = false;
		}
	}

	reset_game() : void
	{
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.is_running = false;
	}
}


export class PongTable
{
	readonly	top_normal : Vector2D;
	readonly	bottom_normal : Vector2D;
	readonly	left_normal : Vector2D;
	readonly	right_normal : Vector2D;
	readonly 	_size : Size;

	constructor()
	{
		this._size = {w: 1920, h: 1080};
		this.top_normal = new Vector2D(0, 1);
		this.bottom_normal = new Vector2D(0, -1);
		this.left_normal = new Vector2D(1, 0);
		this.right_normal = new Vector2D(-1, 0);
	}

	public get width() : number {
		return	this._size.w;
	}

	public get height() : number
	{
		return this._size.h;
	}
}

export class PongPaddle extends PhysicObject
{
	constructor(position: Position, texture : HTMLImageElement)
	{
		super(position, {w: 10, h: 30},new Vector2D(0,0));
	}
}

export class PongBall extends PhysicObject
{
	private table: PongTable;
	private score: Score;
	readonly paddle_p1:PongPaddle;
	readonly paddle_p2:PongPaddle;
	private texture : HTMLImageElement;

	constructor(table: PongTable, score: Score, paddle_p1: PongPaddle, paddle_p2: PongPaddle, texture : HTMLImageElement)
	{
		super({x: table.width / 2, y: table.height / 2}, 10, new Vector2D(0,0));
		this.table = table;
		this.score = score;
		this.paddle_p1 = paddle_p1;
		this.paddle_p2 = paddle_p2;
		this.texture = texture;
	}

	addSpeed(new_vec: Vector2D) : void
	{
		this.speed.addVector2D(new_vec);
	}

	test_collide(line_position: Position,normal: Vector2D)
	{
		var distance_from_line = dot_product(
			this.position.x - line_position.x,
			this.position.y - line_position.y,
			normal.getX(), normal.getY()
		);
		if (distance_from_line < (this.size as number) / 2)
		{
			let speed_normal:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getX(), normal.getY());
			let speed_tangent:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getY(), -normal.getX());
			this.speed.setX = -(speed_normal * normal.getX()) + (speed_tangent * normal.getY());
			this.speed.setY = -(speed_normal * normal.getY()) + (speed_tangent * -normal.getX());
		}
	}

	spawn_ball(side:number)
	{
		let new_dir:number = Math.random() * 5 * ((Math.random() * 2) - 1);
		this.speed.setX = (3 * side);
		this.speed.setY = (new_dir);
	}

	test_collide_score(line_position: Position,normal: Vector2D)
	{
		var distance_from_line = dot_product(
			this.position.x - line_position.x,
			this.position.y - line_position.y,
			normal.getX(), normal.getY()
		);

		var next_side;
		if (distance_from_line < (this.size as number) / 2)
		{
			next_side = 1;
			if (this.pos.x <= (this.size as number))
				this.score.p2++;
			else if (this.pos.x >= this.table.width - (this.size as number))
			{
				this.score.p1++;
				next_side = -1;
			}
			this.pos.x = this.table.width / 2;
			this.pos.y = this.table.height / 2;
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

		if ((distance_from_line < (this.size as number) / 2)
			&& ((paddle_position.y - this.position.y) > -((this.paddle_p1.size as Size).h / 2)
				&& (paddle_position.y - this.position.y) < (this.paddle_p1.size as Size).h / 2))
		{
			let new_normal = normal;
			new_normal.setY = new_normal.getY();
			new_normal.unit_himself();
			this.position.x = paddle_position.x + (((this.size as number) / 2) * normal.getX());
			let speed_normal:number = dot_product(this.speed.getX(), this.speed.getY(), new_normal.getX(), new_normal.getY());
			let speed_tangent:number = dot_product(this.speed.getX(), this.speed.getY(), new_normal.getY(), -new_normal.getX());
			this.speed.setX = -(speed_normal * new_normal.getX()) + (speed_tangent * (new_normal.getY()));
			this.speed.setY = -(speed_normal * (new_normal.getY())) + (speed_tangent * -new_normal.getX());
			this.speed.coef_product(1.05);
		}
	}

	updatePos(): void
	{
		this.test_collide({x: 0, y: 0}, this.table.top_normal);
		this.test_collide({x: 0, y: this.table.height}, this.table.bottom_normal);
		this.test_collide_paddle({x: this.paddle_p2.pos.x - ((this.paddle_p2.size as Size).w / 2), y: this.paddle_p2.pos.y}, this.table.right_normal);
		this.test_collide_paddle({x: (this.paddle_p1.size as Size).w, y:this.paddle_p1.pos.y}, this.table.left_normal);
		this.test_collide_score({x: 0, y: 0}, this.table.left_normal);
		this.test_collide_score({x: this.table.width, y: 0}, this.table.right_normal);
		this.position.x += this.speed.getX();
		this.position.y += this.speed.getY();
	}
}
