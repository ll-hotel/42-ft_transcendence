import { BaseMessage } from "./utils/socket";

export enum TypeMsg {
	state = "state",
	input = "input",
	error = "error",
	score = "score",
}

export enum Status {
	ended = "ended",
	started = "started",
	ongoing = "ongoing",
}

export type StateMessage = BaseMessage & {
	type: "state",
	ball: {
		x: number,
		y: number,
		speed: Vector2D,
	},
	paddles: {
		p1_Y: number,
		p1_input: { up: boolean, down: boolean },
		p2_Y: number,
		p2_input: { up: boolean, down: boolean },
	},
	score: { p1: number, p2: number },
	status: Status,
};

export type InputMessage = BaseMessage & {
	type: "input",
	clientId: string,
	up: boolean,
	down: boolean,
};

export type LocalMessage = BaseMessage & {
	type: "input",
	p1_up: boolean,
	p1_down: boolean,
	p2_up: boolean,
	p2_down: boolean,
};

export type ScoreMessage = BaseMessage & {
	type: "score",
	p1_score: number,
	p2_score: number,
};

export type Message = BaseMessage | StateMessage | InputMessage | LocalMessage;

export enum Mode {
	local = "local",
	remote = "remote",
}

export type Position = { x: number, y: number };
export type Size = { w: number, h: number };
export type Score = { p1: number, p2: number };
export type Input = { name: string, value: boolean };

export class Vector2D {
	private x: number;
	private y: number;
	private norm: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.norm = Math.sqrt(this.x * this.x + this.y * this.y);
	}

	addVector2D(other: Vector2D) {
		this.x += other.x;
		this.y += other.y;
		this.updateValue();
	}

	scale(coef: number) {
		this.x *= coef;
		this.y *= coef;
		this.updateValue();
	}

	private updateValue() {
		this.norm = Math.sqrt(this.x * this.x + this.y * this.y);
	}

	unitVector() {
		return ({ x: (this.x / this.norm), y: (this.y / this.norm), norm: 1 });
	}

	unit_himself() {
		this.x = this.x / this.norm;
		this.y = this.y / this.norm;
		this.updateValue();
	}

	getX() {
		return this.x;
	}

	getY() {
		return this.y;
	}

	public set setY(value: number) {
		this.y = value;
	}

	public set setX(value: number) {
		this.x = value;
	}
}
