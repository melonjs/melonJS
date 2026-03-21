import {
	audio,
	Collectable,
	collision,
	Ellipse,
	event,
	game,
	ShaderEffect,
	timer,
} from "melonjs";
import { gameState } from "../gameState";

// shared glow shader for all coins
let coinShader: ShaderEffect | undefined;
let coinShaderRefCount = 0;
let coinUpdateHandler: (() => void) | undefined;

export class CoinEntity extends Collectable {
	/**
	 * constructor
	 */
	constructor(x, y, _settings) {
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

		// apply a pulsing glow shader once added to the world
		event.once(event.LEVEL_LOADED, () => {
			const renderer = this.parentApp?.renderer;
			if (!renderer) {
				return;
			}
			if (!coinShader) {
				coinShader = new ShaderEffect(
					renderer,
					`
					uniform float uTime;
					vec4 apply(vec4 color, vec2 uv) {
						float pulse = 0.92 + 0.08 * sin(uTime * 3.0);
						float sweep = fract(uTime * 0.8);
						float localX = fract(uv.x * 14.5);
						float glint = smoothstep(0.15, 0.0, abs(localX - sweep)) * 0.4;
						vec3 glow = color.rgb * pulse + vec3(1.0, 0.95, 0.7) * glint;
						return vec4(glow * color.a, color.a);
					}
					`,
				);
				coinUpdateHandler = () => {
					if (coinShader) {
						coinShader.setUniform("uTime", timer.getTime() / 1000.0);
					}
				};
				event.on(event.GAME_UPDATE, coinUpdateHandler);
			}
			coinShaderRefCount++;
			this.shader = coinShader;
		});
	}

	// called by the pool on object recycling
	onResetEvent(x, y, _settings) {
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

	onDestroyEvent() {
		// clean up shared shader ref
		if (coinShader && --coinShaderRefCount <= 0) {
			if (coinUpdateHandler) {
				event.off(event.GAME_UPDATE, coinUpdateHandler);
				coinUpdateHandler = undefined;
			}
			coinShader = undefined;
			coinShaderRefCount = 0;
		}
	}
}
