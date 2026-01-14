import {GameServer} from "./pong_physic";

class Player
{
	readonly playerNumber: number;
	readonly _ws: WebSocket;

	constructor(playerNumber: number, ws: WebSocket)
	{
		this.playerNumber = playerNumber;
		this._ws = ws;
	}

	get ws() : WebSocket
	{
		return this._ws;
	}

	get pNumber() : number
	{
		return this.playerNumber;
	}
}

class GameInstance {
	readonly game_id: string;
	readonly _player_1 : Player;
	readonly _player_2 : Player;
	private _game: GameServer;

	constructor(game_id: string, p1: Player, p2: Player)
	{
		this.game_id = game_id;
		this._player_1 = p1;
		this._player_2 = p2;
		this._game = new GameServer(p1.ws, p2.ws);
	}

	play()
	{
		this._game.game_init();
	}
}

export function init_game(game_id: string, ws_p1:WebSocket, ws_p2:WebSocket)
{
/*TODO reception info du match:
	- ws player 1
	- ws player 2
*/
	let p1 = new Player(1, ws_p1);
	let p2 = new Player(2, ws_p2);
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


