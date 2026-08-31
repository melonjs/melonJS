import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct ShineUniforms {
	uShineColor : vec3f,
	uShineWidth : f32,
	uShineSpeed : f32,
	uShineIntensity : f32,
	uShineAngle : f32,
	uShineBands : f32,
	uPulseDepth : f32,
	uPulseSpeed : f32,
	uTime : f32,
	uUVYDir : f32,
};
@group(3) @binding(0) var<uniform> fx : ShineUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	if (color.a == 0.0) {
		return color;
	}
	// Optional brightness pulse on the base color.
	let pulse = (1.0 - fx.uPulseDepth) + fx.uPulseDepth * sin(fx.uTime * fx.uPulseSpeed);
	// Directional UV arithmetic — an ABSOLUTE coordinate, so a flipped
	// space mirrors the position (1 - uv.y), not merely the sign (see the
	// ShaderEffect uUVYDir docs; the renderer feeds the space's direction)
	let y = select(uv.y, 1.0 - uv.y, fx.uUVYDir < 0.0);
	// Project uv along the sweep axis; tile by uShineBands (wrap-around
	// distance keeps sweeps gapless — see the GLSL twin's rationale).
	let pos = uv.x * cos(fx.uShineAngle) + y * sin(fx.uShineAngle);
	let localX = fract(pos * fx.uShineBands);
	let sweep = fract(fx.uTime * fx.uShineSpeed);
	let d = abs(localX - sweep);
	let dist = min(d, 1.0 - d);
	let glint = smoothstep(fx.uShineWidth, 0.0, dist) * fx.uShineIntensity;
	// premultiplied-alpha discipline mirrors the GLSL twin
	let result = color.rgb * pulse + fx.uShineColor * glint * color.a;
	return vec4f(result, color.a);
}
`;

/**
 * A shader effect that sweeps a bright highlight band across the sprite —
 * the classic "shine" pass commonly used for coins, gems, polished metal,
 * and hover-highlighted UI elements.
 *
 * Set `bands` > 1 to tile the sweep into N parallel glints (useful for the
 * "etched grooves" look of a coin's rim). An optional subtle brightness
 * pulse can be layered on top via `pulseDepth` — set to 0 to disable.
 *
 * The `time` uniform must be updated each frame for the animation.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
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
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
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
		super(renderer, {
			glsl: `
			uniform vec3  uShineColor;
			uniform float uShineWidth;
			uniform float uShineSpeed;
			uniform float uShineIntensity;
			uniform float uShineAngle;
			uniform float uShineBands;
			uniform float uPulseDepth;
			uniform float uPulseSpeed;
			uniform float uTime;
			uniform float uUVYDir;
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a == 0.0) return color;
				// Optional brightness pulse on the base color.
				float pulse = (1.0 - uPulseDepth) + uPulseDepth * sin(uTime * uPulseSpeed);
				// Directional UV arithmetic — an ABSOLUTE coordinate, so a
				// flipped space mirrors the position (1.0 - uv.y), not just
				// the sign (see the ShaderEffect uUVYDir docs); without it,
				// a vertical sweep runs backwards on bottom-up captures
				float y = uUVYDir < 0.0 ? 1.0 - uv.y : uv.y;
				// Project uv along the sweep axis (uShineAngle).
				float pos = uv.x * cos(uShineAngle) + y * sin(uShineAngle);
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
			wgsl: wgslFragment,
		});

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
		// top-down default; the batchers feed the actual space direction
		// per draw through _setUVYDir (bottom-up pooled captures on GL)
		this.setUniform("uUVYDir", 1.0);
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
