import {
	audio,
	Collectable,
	collision,
	Ellipse,
	event,
	GLShader,
	game,
	timer,
} from "melonjs";
import { gameState } from "../gameState";

// shared glow shader for all coins
let coinShader: GLShader | undefined;
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

		// apply a pulsing glow shader once added to the world (WebGL only)
		event.once(event.LEVEL_LOADED, () => {
			const renderer = this.parentApp?.renderer;
			if (!renderer || typeof renderer.gl === "undefined") {
				return;
			}
			if (!coinShader) {
				coinShader = new GLShader(
					renderer.gl,
					[
						"attribute vec2 aVertex;",
						"attribute vec2 aRegion;",
						"attribute vec4 aColor;",
						"uniform mat4 uProjectionMatrix;",
						"varying vec2 vRegion;",
						"varying vec4 vColor;",
						"void main(void) {",
						"    gl_Position = uProjectionMatrix * vec4(aVertex, 0.0, 1.0);",
						"    vColor = vec4(aColor.bgr * aColor.a, aColor.a);",
						"    vRegion = aRegion;",
						"}",
					].join("\n"),
					[
						"uniform sampler2D uSampler;",
						"uniform float uTime;",
						"varying vec4 vColor;",
						"varying vec2 vRegion;",
						"void main(void) {",
						"    vec4 texColor = texture2D(uSampler, vRegion) * vColor;",
						"    float pulse = 0.92 + 0.08 * sin(uTime * 3.0);",
						"    float sweep = fract(uTime * 0.8);",
						"    float localX = fract(vRegion.x * 14.5);",
						"    float glint = smoothstep(0.15, 0.0, abs(localX - sweep)) * 0.4;",
						"    vec3 glow = texColor.rgb * pulse + vec3(1.0, 0.95, 0.7) * glint;",
						"    gl_FragColor = vec4(glow * texColor.a, texColor.a);",
						"}",
					].join("\n"),
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
