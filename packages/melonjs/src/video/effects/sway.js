import WaveEffect from "./wave.js";

/**
 * additional import for TypeScript
 * @import Renderer from "../renderer.js";
 */

/** one turn, the period the sway's phase is wrapped to */
const TURN = Math.PI * 2;

/**
 * A shader effect that leans a sprite from side to side, as if a breeze went
 * through it: each row is drawn a little to the left or right by a sine of
 * the time, and by more the further above its anchor row it is, so the top
 * sways most and everything from the anchor down stays put. For grass, trees,
 * reeds or a whole background layer: anything planted at its bottom.
 *
 * It is a {@link WaveEffect} with an anchor and sway-sized defaults, so it
 * shares its shader rather than adding one. The difference is the time:
 * {@link SwayEffect#setTime} wraps the phase to one turn on the CPU before
 * the shader sees it. A raw clock grows without bound, and a medium-precision
 * float, the default on most phones, runs out of digits a few minutes into a
 * session and the sway starts to stutter; a wrapped phase never grows.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // a tree whose trunk is planted at 90% of its height
 * const sway = new SwayEffect(renderer, { strength: 0.02, anchor: 0.9 });
 * tree.addPostEffect(sway);
 * // each frame
 * sway.setTime(timer.getTime() / 1000);
 */
export default class SwayEffect extends WaveEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.strength=0.02] - how far the top moves each way, as a fraction of the texture's width
	 * @param {number} [options.anchor=1.0] - the row that stays put, as a fraction of the height from the top (1 = the bottom row)
	 * @param {number} [options.speed=1.5] - how fast it sways, in radians per second
	 * @param {number} [options.frequency=3.0] - how much the sway bends along the height: low values lean the whole sprite as one, high ones ripple it
	 */
	constructor(renderer, options = {}) {
		// the shader advances by `uTime * uSpeed`: the speed is applied on the
		// CPU instead, before the phase is wrapped, so the shader's is 1
		super(renderer, {
			amplitude: options.strength ?? 0.02,
			frequency: options.frequency ?? 3.0,
			speed: 1.0,
			anchor: options.anchor ?? 1.0,
		});
		/**
		 * how fast it sways, in radians per second
		 * @type {number}
		 */
		this.speed = options.speed ?? 1.5;
	}

	/**
	 * advance the sway to a moment in time
	 * @param {number} seconds - the time, in seconds (any clock: only its rate matters)
	 * @returns {SwayEffect} this effect for chaining
	 */
	setTime(seconds) {
		super.setTime((seconds * this.speed) % TURN);
		return this;
	}

	/**
	 * set how far the top moves each way
	 * @param {number} strength - a fraction of the texture's width
	 */
	setStrength(strength) {
		this.setAmplitude(strength);
	}

	/**
	 * Create an independent copy of this effect, swaying the same way. A
	 * plain {@link ShaderEffect#clone} would copy the uniforms but not the
	 * speed, nor the wrapping of the time that keeps the sway smooth.
	 * @returns {SwayEffect} a new effect
	 */
	clone() {
		if (this.destroyed) {
			throw new Error("SwayEffect.clone: effect has been destroyed");
		}
		const value = (name) => {
			return this._uniformValues?.get(name);
		};
		return new SwayEffect(this._renderer, {
			strength: value("uAmplitude"),
			frequency: value("uFrequency"),
			anchor: value("uAnchor"),
			speed: this.speed,
		});
	}
}
