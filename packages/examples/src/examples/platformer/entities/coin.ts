import { Collectable, Ellipse, audio, collision, game } from "melonjs";
import { gameState } from "../gameState";

export class CoinEntity extends Collectable {
	/**
	 * constructor
	 */
	constructor(x, y, settings) {
		// call the super constructor
		super(
			x,
			y,
			Object.assign({
				image: gameState.texture,
				region: "coin.png",
				shapes: [new Ellipse(35 / 2, 35 / 2, 35, 35)], // coins are 35x35
			}),
		);
	}

	// add a onResetEvent to enable object recycling
	onResetEvent(x, y, settings) {
		this.shift(x, y);
		// only check for collision against player
		this.body.setCollisionMask(collision.types.PLAYER_OBJECT);
	}

	/**
	 * collision handling
	 */
	onCollision(/*response*/) {
		// do something when collide
		audio.play("cling", false);
		// give some score
		gameState.data.score += 250;

		//avoid further collision and delete it
		this.body.setCollisionMask(collision.types.NO_OBJECT);

		game.world.removeChild(this);

		return false;
	}
}
