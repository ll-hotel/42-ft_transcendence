import {ServerSidedGame} from "./pong_physic";
import socket from "../socket"

class Player
{
	readonly playerNumber: number;
	readonly uuid: string;

	constructor(playerNumber: number, uuid: string)
	{
		this.playerNumber = playerNumber;
		this.uuid = uuid;
	}
}

class GameInstance {
	readonly game_id: number;
	readonly _player_1 : Player;
	readonly _player_2 : Player;
	private _game: ServerSidedGame;

	constructor(game_id: number, p1: Player, p2: Player)
	{
		this.game_id = game_id;
		this._player_1 = p1;
		this._player_2 = p2;
		this._game = new ServerSidedGame(p1.uuid, p2.uuid);
	}

	play()
	{
		this._game.game_init();
		this._game.start();
	}
}

export function init_game(game_id: number, p1_uuid:string, p2_uuid:string)
{
/*TODO reception info du match:
	- ws player 1
	- ws player 2
*/
	let p1 = new Player(1, p1_uuid);
	let p2 = new Player(2, p2_uuid);
	let game = new GameInstance(game_id, p1, p2);
	game.play();
/*

TODO lancement de la physique du jeu
	- loop: - reception info des players
				--> si un joueur est deco, victoire du restant
			- update des positions selon les infos
			- check fin de match ?
				--> envoi du signal de fin de match au player
				--> Maj de la db
				--> shutdown le match
			- envoi de l'etat du jeu
*/
}


