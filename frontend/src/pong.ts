let DEBUG = 1;

function debug_message(msg: string, obj?: any): void
{
	if (DEBUG == 1)
		console.debug(msg, obj ? JSON.parse(JSON.stringify(obj)) : "");
}

function draw_hit_box(context: CanvasRenderingContext2D, obj:PhysicObject): void
{
	context.lineWidth = 1;
	context.strokeStyle = "#ff0000";
	context.strokeRect(obj.pos.x - (obj.size.w / 2), obj.pos.y - (obj.size.h / 2),  obj.size.w, obj.size.h);
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

function resolution_update(canvas: HTMLCanvasElement, panel_game: HTMLDivElement)
{
	debug_message("Resolution " + panel_game.clientHeight);

	const dpr = window.devicePixelRatio || 1;

	canvas.width = panel_game.clientWidth * dpr;     // ex: 800 * 2 = 1600
	canvas.height = panel_game.clientHeight * dpr;   // ex: 600 * 2 = 1200
	const context:CanvasRenderingContext2D = canvas.getContext("2d")!;
	context.setTransform(dpr, 0, 0, dpr, 0, 0);
	context.imageSmoothingEnabled = false;

	const angle = Math.PI / 2;
	if (canvas.width < canvas.height)
	{
		debug_message("context rotation");
		context.setTransform(
			Math.cos(angle), Math.sin(angle),
			-Math.sin(angle), Math.cos(angle),
			0, 0
		);
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
	private canvas: HTMLCanvasElement;
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
		var panel_game = html.querySelector("#panel-game")!;
		// resolution_update(this.canvas, panel_game);
		debug_message(this.canvas.width + " " + this.canvas.height);

		this.canvas.addEventListener("resize", () => resolution_update(this.canvas));

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
	}

	update_paddle_texture() : void
	{
		this.paddle_p1.updateTextPos(this.canvas.getContext("2d")!);
		this.paddle_p2.updateTextPos(this.canvas.getContext("2d")!);
	}

	update_ball_texture() : void
	{
		if (DEBUG == 1)
			draw_hit_box(this.canvas.getContext("2d")!, this.ball);
		this.ball.updateTextPos(this.canvas.getContext("2d")!);
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
			if (event.key === "s")
				this.input.set("s", true);
			if (event.key === "w")
				this.input.set("w", true);
		}
		);

		window.addEventListener("keyup", (event) => {
			if (event.key === "ArrowDown")
				this.input.set("ArrowDown", false);
			if (event.key === "ArrowUp")
				this.input.set("ArrowUp", false);
			if (event.key === "s")
				this.input.set("s", false);
			if (event.key === "w")
				this.input.set("w", false);
		}
		);

		this.start_button.addEventListener("click", (event) => {
			this.start_button.hidden = true;
			this.start();
		});
	}

	start() : void
	{
		debug_message("start");
		this.score.p1 = 0;
		this.score.p2 = 0;
		this.ball.spawn_ball((Math.random() < 0.5 ? -1 : 1));
		this.is_running = true;
		this.loop(this.last_timestamp);
	}

	resume() : void
	{
		debug_message("resume");
		if (this.is_running == false)
		{
			this.canvas.hidden = false;
			this.is_running = true;
			this.loop(this.last_timestamp);
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
		this.canvas.getContext("2d")!.reset();
		if (this.input.get("w") && this.paddle_p1.pos.y >= ( 5 + (this.paddle_p1.size.h / 2)))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y - 5;
		if (this.input.get("s")  && this.paddle_p1.pos.y <= this.canvas.height - (5 +  (this.paddle_p1.size.h / 2)))
			this.paddle_p1.pos.y = this.paddle_p1.pos.y + 5;
		if (this.input.get("ArrowUp") && this.paddle_p2.pos.y >= (5 +  (this.paddle_p1.size.h / 2)))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y - 5;
		if (this.input.get("ArrowDown") && this.paddle_p2.pos.y <= this.canvas.height - (5 +  (this.paddle_p1.size.h / 2)))
			this.paddle_p2.pos.y = this.paddle_p2.pos.y + 5;

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
		if (distance_from_line < this.size.w / 2)
		{
			debug_message("Wall Collision at ", this.pos);
			let speed_normal:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getX(), normal.getY());
			let speed_tangent:number = dot_product(this.speed.getX(), this.speed.getY(), normal.getY(), -normal.getX());
			this.speed.setX = -(speed_normal * normal.getX()) + (speed_tangent * normal.getY());
			this.speed.setY = -(speed_normal * normal.getY()) + (speed_tangent * -normal.getX());
		}
	}

	spawn_ball(side:number)
	{
		this.pos.x = this.canvas.width / 2;
		this.pos.y = this.canvas.height / 2;
		// this.updateTextPos(this.canvas.getContext("2d")!);
		// var time_engage:number = Date.now();
		// while (Date.now() <= time_engage + 300)
		// 	;
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
		if (distance_from_line < this.size.w / 2)
		{
			debug_message("Score Collision at ", this.pos);
			next_side = 1;
			if (this.pos.x <= this.size.w)
				this.score.p2++;
			else if (this.pos.x >= this.canvas.width - this.size.w)
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

		if ((distance_from_line < this.size.w / 2)
			&& ((paddle_position.y - this.position.y) > - (this.paddle_p1.size.h / 2))
			&& (paddle_position.y - this.position.y) < (this.paddle_p1.size.h / 2))
		{
			debug_message("Paddle Collision at ", this.pos);
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
		this.test_collide({x: 0, y: this.canvas.height}, this.bottom_normal);
		this.test_collide_paddle({x: this.paddle_p2.pos.x - (this.paddle_p2.size.w / 2), y: this.paddle_p2.pos.y}, this.right_normal);
		this.test_collide_paddle({x: this.paddle_p1.size.w, y:this.paddle_p1.pos.y}, this.left_normal);
		this.test_collide_score({x: 0, y: 0}, this.left_normal);
		this.test_collide_score({x: this.canvas.width, y: 0}, this.right_normal);
	}
}
