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

export class Game
{
	private canvas: PongCanvas;
	private ball: PongBall;
	public paddle_p1: PongPaddle;
	public paddle_p2: PongPaddle;
	private is_running: Boolean;
	private last_timestamp: number;
	private buffer: number;
	private tick_interval: number;
	private tick_rate: number;
	private score: Score;
	private score_viewer: HTMLElement;
	static	angle:number = 0;
	public input: Map<string, boolean>;

	constructor(html: HTMLElement)
	{
		this.canvas = new PongCanvas(html.querySelector("#pong-canvas")!);
		this.score_viewer = html.querySelector("#score_viewer")!;
		this.score= {p1: 0, p2: 0};
		this.paddle_p1 = new PongPaddle({x: 0, y: this.canvas.canvas.height / 2});
		this.paddle_p2 = new PongPaddle({x: this.canvas.canvas.width, y: this.canvas.canvas.height / 2});
		this.ball = new PongBall(this.canvas, this.score, this.paddle_p1, this.paddle_p2);
		this.is_running = false;
		this.last_timestamp = 0;
		this.buffer = 0;
		this.tick_rate = 60;
		this.tick_interval = 1000 / this.tick_rate;
		this.input = new Map([["w", false], ["s", false], ["ArrowUp", false], ["ArrowDown", false]]);
	}

	update_paddle_texture() : void
	{
		this.canvas.getContext().drawImage(this.paddle_p1.getTexture(), this.paddle_p1.pos.x, (this.paddle_p1.pos.y - (this.paddle_p2.size as Size).h / 2), 20, 50);
		this.canvas.getContext().drawImage(this.paddle_p2.getTexture(), this.paddle_p2.pos.x - (this.paddle_p2.size as Size).w, this.paddle_p2.pos.y - ((this.paddle_p2.size as Size).h / 2), 20, 50);
	}

	update_ball_texture() : void
	{
		this.canvas.getContext().drawImage(this.ball.getTexture(), this.ball.pos.x - 5, this.ball.pos.y - 5,  10, 10);
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
	}

	start() : void
	{
		console.log("start");
		this.ball.spawn_ball((Math.random() < 0.5 ? -1 : 1));
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.loop(this.last_timestamp);
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
		requestAnimationFrame(this.loop);
	}

	update(t: number) : void
	{
		this.canvas.getContext().reset();
		if (this.input.get("w") && this.paddle_p1.pos.y > ( 5 + (this.paddle_p1.size as Size).h / 2))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y - 5;
		if (this.input.get("s")  && this.paddle_p1.pos.y < this.canvas.canvas.height - (5 +  (this.paddle_p1.size as Size).h / 2))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y + 5;
		if (this.input.get("ArrowUp") && this.paddle_p2.pos.y > (5 +  (this.paddle_p1.size as Size).h / 2))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y - 5;
		if (this.input.get("ArrowDown") && this.paddle_p2.pos.y < this.canvas.canvas.height - (5 +  (this.paddle_p1.size as Size).h / 2))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y + 5;
		this.ball.updatePos();
		console.log("score:", this.score);
		this.score_viewer.innerHTML = this.score.p1.toString() + " - " + this.score.p2.toString();
		this.update_texture_pos();
	}
}

export class PongCanvas
{
	readonly	canvas : HTMLCanvasElement;
	private		context : CanvasRenderingContext2D;
	readonly	top_normal : Vector2D;
	readonly	bottom_normal : Vector2D;
	readonly	left_normal : Vector2D;
	readonly	right_normal : Vector2D;

	constructor(canvas: HTMLCanvasElement)
	{
		this.canvas = canvas;
		this.context = this.canvas.getContext("2d")!;
		this.top_normal = new Vector2D(0, 1);
		this.bottom_normal = new Vector2D(0, -1);
		this.left_normal = new Vector2D(1, 0);
		this.right_normal = new Vector2D(-1, 0);
	}

	getContext() : CanvasRenderingContext2D
	{
		return (this.context);
	}
}

export class PongPaddle extends PhysicObject
{
	private texture: HTMLImageElement;

	constructor(position: Position)
	{
		super(position, {w: 20, h: 50},new Vector2D(0,0));
		this.texture = new Image();
		this.texture.src = "/pong_bar.png";
	}

	getTexture() : HTMLImageElement
	{
		return (this.texture);
	}


}

export class PongBall extends PhysicObject
{
	private texture: HTMLImageElement;
	private canvas: PongCanvas;
	private score: Score;
	readonly paddle_p1:PongPaddle;
	readonly paddle_p2:PongPaddle;

	constructor(canvas: PongCanvas, score: Score, paddle_p1: PongPaddle, paddle_p2: PongPaddle)
	{
		super({x: canvas.canvas.width / 2, y: canvas.canvas.height / 2}, 10, new Vector2D(0,0));
		this.canvas = canvas;
		this.texture = new Image();
		this.texture.src = "/pong_ball.png";
		this.score = score;
		this.paddle_p1 = paddle_p1;
		this.paddle_p2 = paddle_p2;
	}

	getTexture() : HTMLImageElement
	{
		return (this.texture);
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
			else if (this.pos.x >= this.canvas.canvas.width - (this.size as number))
			{
				this.score.p1++;
				next_side = -1;
			}
			this.pos.x = this.canvas.canvas.width / 2;
			this.pos.y = this.canvas.canvas.height / 2;
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

		if ((distance_from_line < (this.size as number) / 2) && ((paddle_position.y - this.position.y) > -((this.paddle_p1.size as Size).h / 2) && (paddle_position.y - this.position.y) < (this.paddle_p1.size as Size).h / 2))
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
		this.test_collide({x: 0, y: 0}, this.canvas.top_normal);
		this.test_collide({x: 0, y: this.canvas.canvas.height}, this.canvas.bottom_normal);
		this.test_collide_paddle({x: this.paddle_p2.pos.x - 20, y: this.paddle_p2.pos.y}, this.canvas.right_normal);
		this.test_collide_paddle({x: 20, y:this.paddle_p1.pos.y}, this.canvas.left_normal);
		this.test_collide_score({x: 0, y: 0}, this.canvas.left_normal);
		this.test_collide_score({x: this.canvas.canvas.width, y: 0}, this.canvas.right_normal);
		this.position.x += this.speed.getX();
		this.position.y += this.speed.getY();
	}
}
