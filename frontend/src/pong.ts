type Position = {x: number, y: number};
type Size = {w: number, h: number};


export class Game
{
	private canvas: PongCanvas;
	private ball: PongBall;
	private paddle_p1: PongPaddle;
	private paddle_p2: PongPaddle;
	private start_button: HTMLButtonElement | null;
	constructor(html: HTMLElement)
	{
		this.ball = new PongBall();
		this.canvas = new PongCanvas(html.querySelector("#pong-canvas")!);
		this.paddle_p1 = new PongPaddle({x: 10, y: 50});
		this.paddle_p2 = new PongPaddle({x: 100, y: 50});
		this.start_button = html.querySelector("start_button");
		this.start_button?.addEventListener("click", () => {this.start()});

	}

	summon_ball()
	{
		this.canvas.getContext().drawImage(this.ball.getTexture(), 10, 10);
	}

	start()
	{
		console.log("BAAAAAAALLL");
		this.summon_ball();
	}
}

export class PongCanvas
{
	private canvas : HTMLCanvasElement;
	private context : CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement)
	{
		this.canvas = canvas;
		this.context = this.canvas.getContext("2d")!;
	}

	getContext()
	{
		return (this.context);
	}

}

export class PongPaddle
{
	private size: Size;
	private texture: HTMLImageElement;
	private position: Position;

	constructor(position: Position)
	{
		this.size = {w: 150, h: 30};
		this.position = position;
		this.texture = new Image();
		this.texture.src = "/pong_bar.png";
	}
}

export class PongBall
{
	private size: Size;
	private texture: HTMLImageElement;
	private position: Position;

	constructor()
	{
		this.size = {w: 30, h: 30};
		this.position = {x: 50, y: 50};
		this.texture = new Image();
		this.texture.src = "/pong_ball.png";
	}

	getTexture()
	{
		return (this.texture);
	}
}
