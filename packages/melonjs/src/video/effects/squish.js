import { FRAME_GLSL, FRAME_WGSL, FRAME_WGSL_MEMBERS } from "./frame.js";
import ShaderEffect from "./shadereffect.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../canvas/canvas_renderer.js";
 * @import WebGLRenderer from "../webgl/webgl_renderer.js";
 * @import WebGPURenderer from "../webgpu/webgpu_renderer.js";
 * @import Renderer from "../renderer.js";
 */
// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct SquishUniforms {
	uSquishFrame : vec4f,
	uSquishXFactor : f32,
	uSquishBulge : f32,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : SquishUniforms;
${FRAME_WGSL}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	// -1..1 across the quad: the sprite's frame, stretched by the vertex scale
	var p = (uv - fx.uSquishFrame.xy) / fx.uSquishFrame.zw * 2.0 - 1.0;
	// undo the stretch: the sprite keeps its width, in the middle of the
	// wider quad, with room on both sides
	p.x = p.x * fx.uSquishXFactor;
	// each row widens by its share of the bulge: all of it across the
	// middle, none at the top and bottom
	p.x = p.x / max(1.0 + fx.uSquishBulge * sqrt(max(1.0 - p.y * p.y, 0.0)), 0.0001);
	let local = (p + 1.0) * 0.5;
	// sampled before the test, since textureSample needs uniform control
	// flow, and kept inside the sprite's frame (frame.js): never filtered
	// with the next frame of the atlas along its edge
	let texel = frameTexel(fx.uSquishFrame.xy + clamp(local, vec2f(0.0), vec2f(1.0)) * fx.uSquishFrame.zw) * vColor;
	let inside = all(local >= vec2f(0.0)) && all(local <= vec2f(1.0));
	return select(vec4f(0.0), texel, inside);
}
`;

/**
 * A shader effect that squishes a sprite: its middle bulges out, or pinches
 * in, while its top and bottom rows stay where they are.
 *
 * Paired with a change of height, it gives squash and stretch that keeps the
 * sprite's volume: scale the sprite to `scaleY` of its height and set the
 * bulge to `1 - scaleY`, so a stretched sprite pinches in and a squashed one
 * bulges out (see the example).
 *
 * A bulge widens the sprite past its own frame. Like a shader that scales
 * `VERTEX` in its vertex function, the effect draws on a quad widened by
 * `1 + bulge` and narrows the texture back in its fragment, so the sprite
 * needs no transparent margin. Made for a sprite carrying it as its only
 * effect: chained with other effects, or on a camera, it squishes the whole
 * frame instead. The bulge is not part of the sprite's bounds, so it is not
 * counted for culling or pointer events.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // bulge a sprite out by half its width across the middle
 * const squish = new SquishEffect(renderer, { bulge: 0.5 });
 * mySprite.addPostEffect(squish);
 * @example
 * // squash and stretch a platformer character: stretch on take-off,
 * // squash on landing, then ease back to rest
 * const squish = new SquishEffect(renderer);
 * player.addPostEffect(squish);
 *
 * // scale the height about the feet, and bulge the other way
 * const stretch = (scaleY) => {
 *     const feet = player.height * (1 - player.anchorPoint.y);
 *     player.currentTransform
 *         .identity()
 *         .translate(0, feet)
 *         .scale(1, scaleY)
 *         .translate(0, -feet);
 *     squish.setBulge(1 - scaleY);
 * };
 *
 * const stretchTo = (scaleY) => {
 *     const state = { scaleY };
 *     stretch(scaleY);
 *     new Tween(state)
 *         .to({ scaleY: 1 }, { duration: 300, easing: Tween.Easing.Back.Out })
 *         .onUpdate(() => stretch(state.scaleY))
 *         .start();
 * };
 *
 * stretchTo(1.3); // jumping: 30% taller, pinched in
 * stretchTo(0.75); // landing: 25% shorter, bulging out
 */
export default class SquishEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.bulge=0] - how far the middle bulges out (positive) or pinches in (negative), from -1 to 1
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uSquishFrame;
			uniform float uSquishXFactor;
			uniform float uSquishBulge;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				// -1..1 across the quad: the sprite's frame, stretched by the vertex scale
				vec2 p = (uv - uSquishFrame.xy) / uSquishFrame.zw * 2.0 - 1.0;
				// undo the stretch: the sprite keeps its width, in the middle
				// of the wider quad, with room on both sides
				p.x *= uSquishXFactor;
				// each row widens by its share of the bulge: all of it across
				// the middle, none at the top and bottom
				p.x /= max(1.0 + uSquishBulge * sqrt(max(1.0 - p.y * p.y, 0.0)), 0.0001);
				vec2 local = (p + 1.0) * 0.5;
				// sampled before the test, while every pixel of the 2x2 block
				// still runs: a sample after a branch some of them skipped
				// has no derivatives to pick its mipmap level from, and reads
				// a far too small one, a dark line along the sprite's edge
				// under "linear-mipmap". And kept inside the sprite's frame
				// (frame.js): never filtered with the next frame of the atlas
				// along its edge
				vec4 texel = frameTexel(uSquishFrame.xy + clamp(local, 0.0, 1.0) * uSquishFrame.zw) * vColor;
				// transparent past the sprite: the room around it, or the
				// indent of a pinch
				float inside = step(0.0, local.x) * step(local.x, 1.0) * step(0.0, local.y) * step(local.y, 1.0);
				return texel * inside;
			}
			`,
			wgsl: wgslFragment,
		});

		/**
		 * the bulge as last set, kept for {@link SquishEffect#clone}
		 * @ignore
		 * @internal
		 */
		this._bulge = 0;

		/**
		 * the frame the bulge is measured against, reused on every draw
		 * (`setUniform` copies it out)
		 * @ignore
		 * @internal
		 */
		this._frame = new Float32Array([0, 0, 1, 1]);

		this.setUniform("uSquishFrame", this._frame);
		this.setBulge(options.bulge ?? 0);
	}

	/**
	 * set how far the middle of the sprite bulges out, or pinches in
	 * @param {number} bulge - from -1 to 1: positive bulges out, up to twice the width across the middle; negative pinches in, down to nothing at -1; 0 leaves the sprite as it is
	 */
	setBulge(bulge) {
		const value = Math.min(Math.max(bulge, -1), 1);
		this._bulge = value;
		// the middle row is the widest, at (1 + bulge) times the width, so the
		// quad is drawn that much wider; a pinch stays inside and needs no room
		const xFactor = 1 + Math.max(value, 0);
		this._vertexScale.x = xFactor;
		this.setUniform("uSquishXFactor", xFactor);
		this.setUniform("uSquishBulge", value);
	}

	/**
	 * The batchers hand every effect the frame it draws through here (it is
	 * what `noise_uv` runs across), and the bulge is measured against the
	 * same frame: where the sprite sits in its atlas, in UV units. A render
	 * target blit hands over the whole target.
	 * @ignore
	 * @internal
	 */
	_setNoiseUVRect(
		sourceWidth,
		sourceHeight,
		objectWidth,
		objectHeight,
		u0,
		v0,
	) {
		const frame = this._frame;
		frame[0] = u0;
		frame[1] = v0;
		frame[2] = Math.max(Math.abs(objectWidth), 1) / Math.max(sourceWidth, 1);
		frame[3] = Math.max(Math.abs(objectHeight), 1) / Math.max(sourceHeight, 1);
		this.setUniform("uSquishFrame", frame);
	}

	/**
	 * Create an independent copy of this effect, with the same bulge.
	 * @returns {SquishEffect} a new effect
	 */
	clone() {
		if (this.destroyed) {
			throw new Error("SquishEffect.clone: effect has been destroyed");
		}
		return new SquishEffect(this._renderer, { bulge: this._bulge });
	}
}
