import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that sweeps a bright highlight band across the sprite —
 * the classic "shine" pass commonly used for coins, gems, polished metal,
 * and hover-highlighted UI elements. Similar to pixi-filters' ShineFilter.
 *
 * Set `bands` > 1 to tile the sweep into N parallel glints (useful for the
 * "etched grooves" look of a coin's rim). An optional subtle brightness
 * pulse can be layered on top via `pulseDepth` — set to 0 to disable.
 *
 * The `time` uniform must be updated each frame for the animation.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // single diagonal sweep — classic "button shine"
 * const shine = new ShineEffect(renderer, {
 *     color: [1.0, 0.95, 0.7],
 *     speed: 0.5,
 *     width: 0.18,
 *     angle: 0.5,
 * });
 *
 * // gold coin with ~14 parallel glints and a subtle brightness pulse
 * const coinShine = new ShineEffect(renderer, {
 *     color: [1.0, 0.95, 0.7],
 *     bands: 14.5,
 *     width: 0.15,
 *     intensity: 0.4,
 *     speed: 0.8,
 *     pulseDepth: 0.08,
 * });
 *
 * mySprite.addPostEffect(coinShine);
 *
 * // update each frame
 * coinShine.setTime(timer.getTime() / 1000);
 */
export default class ShineEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - shine color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.speed=0.5] - sweeps per second
	 * @param {number} [options.width=0.15] - glint half-width as a fraction of one tile (0.0–1.0)
	 * @param {number} [options.intensity=0.5] - maximum highlight strength
	 * @param {number} [options.angle=0.5] - sweep direction in radians (0 = horizontal L→R, π/2 = vertical T→B)
	 * @param {number} [options.bands=1.0] - number of parallel glints (1 = single shine; ~14.5 mimics a coin's etched-rim look)
	 * @param {number} [options.pulseDepth=0.0] - subtle base-brightness pulse amplitude (0 disables the pulse)
	 * @param {number} [options.pulseSpeed=3.0] - pulse oscillation rate (radians/second)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3  uShineColor;
			uniform float uShineWidth;
			uniform float uShineSpeed;
			uniform float uShineIntensity;
			uniform float uShineAngle;
			uniform float uShineBands;
			uniform float uPulseDepth;
			uniform float uPulseSpeed;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a == 0.0) return color;
				// Optional brightness pulse on the base color.
				float pulse = (1.0 - uPulseDepth) + uPulseDepth * sin(uTime * uPulseSpeed);
				// Project uv along the sweep axis (uShineAngle).
				float pos = uv.x * cos(uShineAngle) + uv.y * sin(uShineAngle);
				// Tile by uShineBands so we get N parallel glints in unison.
				// localX and sweep both live in [0,1] tile-space; the
				// wrap-around distance (min(d, 1-d)) lets the glint exit
				// the right edge of a tile and immediately re-enter from
				// the left edge of the next, so there is NO perceived
				// pause between sweeps. Previous implementation padded
				// the sweep range to [-W, 1+W] which created a visible
				// off-screen gap of duration ~2W/(1+2W) per cycle.
				float localX = fract(pos * uShineBands);
				float sweep = fract(uTime * uShineSpeed);
				float d = abs(localX - sweep);
				float dist = min(d, 1.0 - d);
				float glint = smoothstep(uShineWidth, 0.0, dist) * uShineIntensity;
				// color.rgb is already premultiplied by alpha — multiply the
				// added glint by color.a so it stays premultiplied too, but
				// do NOT scale the whole result by color.a (that would dim
				// antialiased edges twice).
				vec3 result = color.rgb * pulse + uShineColor * glint * color.a;
				return vec4(result, color.a);
			}
			`,
		);

		this.setUniform(
			"uShineColor",
			new Float32Array(options.color ?? [1.0, 1.0, 1.0]),
		);
		this.setUniform("uShineWidth", options.width ?? 0.15);
		this.setUniform("uShineSpeed", options.speed ?? 0.5);
		this.setUniform("uShineIntensity", options.intensity ?? 0.5);
		this.setUniform("uShineAngle", options.angle ?? 0.5);
		this.setUniform("uShineBands", options.bands ?? 1.0);
		this.setUniform("uPulseDepth", options.pulseDepth ?? 0.0);
		this.setUniform("uPulseSpeed", options.pulseSpeed ?? 3.0);
		this.setUniform("uTime", 0.0);
	}

	/**
	 * set the current time (call each frame for animation)
	 * @param {number} time - time in seconds
	 */
	setTime(time) {
		this.setUniform("uTime", time);
	}

	/**
	 * set the shine color
	 * @param {number[]} color - shine color as [r, g, b] (0.0–1.0)
	 */
	setColor(color) {
		this.setUniform("uShineColor", new Float32Array(color));
	}

	/**
	 * set the sweep speed
	 * @param {number} value - sweeps per second
	 */
	setSpeed(value) {
		this.setUniform("uShineSpeed", value);
	}

	/**
	 * set the highlight intensity
	 * @param {number} value - maximum highlight strength
	 */
	setIntensity(value) {
		this.setUniform("uShineIntensity", value);
	}

	/**
	 * set the number of parallel glints
	 * @param {number} value - 1 for a single shine, >1 for tiled stripes
	 */
	setBands(value) {
		this.setUniform("uShineBands", value);
	}
}
