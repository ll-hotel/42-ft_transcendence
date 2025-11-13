type Position = {x: number, y: number};
type Size = {w: number, h: number};


	function dot_product(x1: number, y1: number, x2: number, y2: number) : number
	{
		return ((x1 * x2) + (y1 * y2));
	}

abstract class PhysicObject
{
	protected position: Position;
	protected speed: Vector2D;
	protected size: Size | number;

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
	private paddle_p1: PongPaddle;
	private paddle_p2: PongPaddle;
	private is_running: Boolean;
	private last_timestamp: number;
	private buffer: number;
	private tick_interval: number;
	private tick_rate: number;

	constructor(html: HTMLElement)
	{
		this.canvas = new PongCanvas(html.querySelector("#pong-canvas")!);
		this.ball = new PongBall(this.canvas);
		this.paddle_p1 = new PongPaddle({x: 10, y: 50});
		this.paddle_p2 = new PongPaddle({x: 100, y: 50});
		this.is_running = false;
		this.last_timestamp = performance.now();
		this.buffer = 0;
		this.tick_rate = 30;
		this.tick_interval = 1000 / this.tick_rate;
	}

	summon_ball() : void
	{
		this.canvas.getContext().drawImage(this.ball.getTexture(), 10, 10);
		this.ball.addSpeed(new Vector2D(3,3));
	}

	start() : void
	{
		console.log("BAAAAAAALLL");
		this.summon_ball();
		this.is_running = true;
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
		console.log("Tick ", t, "ms");
		this.ball.updatePos();
		this.canvas.getContext().drawImage(this.ball.getTexture(), this.ball.pos.x - 10, this.ball.pos.y - 10);
	}
}

export class PongCanvas
{
	readonly canvas : HTMLCanvasElement;
	private context : CanvasRenderingContext2D;
	readonly top_normal : Vector2D;
	readonly bottom_normal : Vector2D;

	constructor(canvas: HTMLCanvasElement)
	{
		this.canvas = canvas;
		this.context = this.canvas.getContext("2d")!;
		this.top_normal = new Vector2D(0, 1);
		console.log("height",this.canvas.height);
		this.bottom_normal = new Vector2D(0, -1);
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
		super(position, {w: 30, h: 30},new Vector2D(0,0));
		this.texture = new Image();
		this.texture.src = "/pong_bar.png";
	}
}

export class PongBall extends PhysicObject
{
	private texture: HTMLImageElement;
	private canvas: PongCanvas;

	constructor(canvas: PongCanvas)
	{
		super({x:0, y: 20}, 20, new Vector2D(0,0));
		this.texture = new Image();
		this.texture.src = "/pong_ball.png";
		this.canvas = canvas;
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
		console.log("distance from line", distance_from_line);
		if (distance_from_line < (this.size as number) / 2)
		{
			let speed_normal:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getX(), normal.getY());
			let speed_tangent:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getY(), -normal.getX());
			this.speed.setX = -(speed_normal * normal.getX()) + (speed_tangent * normal.getY());
			this.speed.setY = -(speed_normal * normal.getY()) + (speed_tangent * -normal.getX());
		}
	}

	updatePos(): void
	{

		this.test_collide({x: 0, y: 0}, this.canvas.top_normal);
		this.test_collide({x: 0, y: this.canvas.canvas.height}, this.canvas.bottom_normal);
		this.position.x += this.speed.getX();
		this.position.y += this.speed.getY();
	}
}
