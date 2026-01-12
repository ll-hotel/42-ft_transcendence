//import ServerGame from './src/serv_side_pong/pong_physic';
import user from "../user/user";
import { v4 as uiidv4 } from 'uuid';

class Player
{
	readonly id: number;
	readonly ws: WebSocket;

	constructor(id: number, ws: WebSocket)
	{
		this.id = id;
		this.ws = ws;
	}

}

class GameInstance {
	readonly game_id: string;
	readonly _player_1 : Player | null;
	readonly _player_2 : Player | null;
	// private _game: ServerGame;

	constructor(p1: Player, p2: Player)
	{
		this.game_id = uiidv4();
		this._player_1 = null;
		this._player_2 = null;
	}

	async connect_player(player: Player)
	{

	}

}
