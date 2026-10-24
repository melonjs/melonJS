import ShaderEffect from "./shadereffect.js";

/**
 * additional import for TypeScript
 * @import Renderer from "../renderer.js";
 * @import Light2d from "../../lighting/light2d.ts";
 */

/**
 * How many lights one ambient pass cuts: the ones in view, in the order the
 * stage holds them.
 * @ignore
 * @internal
 */
export const MAX_AMBIENT_LIGHTS = 32;

/**
 * The stage's ambient darkness with a hole for each light, drawn as one quad
 * over the camera's view (the GPU side of the soft-cutout path; the Canvas
 * renderer gets the same result by erasing from an offscreen canvas).
 *
 * At each pixel, every light lets through `1 - cut`, where `cut` is 1 inside
 * the light's core and falls straight to 0 at its radius (a step at the radius
 * for a light with no softness). What is left of the darkness is the ambient
 * alpha times what every light lets through, and the output is premultiplied,
 * to be drawn with the normal blend.
 *
 * The quad's color, the per-vertex tint, carries the ambient color and alpha.
 * `uv` spans the quad, top left (0, 0) to bottom right (1, 1), drawn the way
 * `drawLight` draws, so `uv * uView.zw` is the pixel's offset into the view.
 * @ignore
 * @internal
 */
export default class AmbientLightEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 */
	constructor(renderer) {
		super(renderer, {
			glsl: `
			uniform vec4 uLights[${MAX_AMBIENT_LIGHTS}];
			uniform vec4 uParams[${MAX_AMBIENT_LIGHTS}];
			uniform vec4 uView;
			uniform float uCount;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 p = uv * uView.zw;
				float through = 1.0;
				for (int i = 0; i < ${MAX_AMBIENT_LIGHTS}; i++) {
					if (float(i) >= uCount) {
						break;
					}
					vec4 light = uLights[i];
					float d = length((p - light.xy) / light.zw);
					float soft = uParams[i].x;
					float cut = soft > 0.0
						? clamp((1.0 - d) / soft, 0.0, 1.0)
						: step(d, 1.0);
					through *= 1.0 - cut;
				}
				return color * through;
			}
			`,
			wgsl: `
			struct AmbientLightUniforms {
				uLights : array<vec4f, ${MAX_AMBIENT_LIGHTS}>,
				uParams : array<vec4f, ${MAX_AMBIENT_LIGHTS}>,
				uView : vec4f,
				uCount : f32,
			};
			@group(3) @binding(0) var<uniform> fx : AmbientLightUniforms;

			fn apply(color : vec4f, uv : vec2f) -> vec4f {
				let p = uv * fx.uView.zw;
				var through = 1.0;
				for (var i = 0; i < ${MAX_AMBIENT_LIGHTS}; i++) {
					if (f32(i) >= fx.uCount) {
						break;
					}
					let light = fx.uLights[i];
					let d = length((p - light.xy) / light.zw);
					let soft = fx.uParams[i].x;
					var cut = select(0.0, 1.0, d <= 1.0);
					if (soft > 0.0) {
						cut = clamp((1.0 - d) / soft, 0.0, 1.0);
					}
					through = through * (1.0 - cut);
				}
				return color * through;
			}
			`,
		});

		/**
		 * light centers and radii, relative to the view's top left
		 * @ignore
		 * @internal
		 */
		this._lights = new Float32Array(MAX_AMBIENT_LIGHTS * 4);
		/**
		 * per light: softness, then unused
		 * @ignore
		 * @internal
		 */
		this._params = new Float32Array(MAX_AMBIENT_LIGHTS * 4);
		/**
		 * @ignore
		 * @internal
		 */
		this._view = new Float32Array(4);
	}

	/**
	 * Load the lights that reach into a view, and the view itself.
	 * @param {Iterable<Light2d>} lights - the stage's active lights
	 * @param {number} x - left of the view, in world units
	 * @param {number} y - top of the view, in world units
	 * @param {number} width - width of the view, in world units
	 * @param {number} height - height of the view, in world units
	 * @ignore
	 * @internal
	 */
	setLights(lights, x, y, width, height) {
		let count = 0;
		for (const light of lights) {
			if (count === MAX_AMBIENT_LIGHTS) {
				break;
			}
			const area = light.getVisibleArea();
			const cx = area.pos.x - x;
			const cy = area.pos.y - y;
			const rx = area.radiusV.x;
			const ry = area.radiusV.y;
			// nothing to cut, or entirely outside the view
			if (
				!(rx > 0) ||
				!(ry > 0) ||
				cx + rx < 0 ||
				cx - rx > width ||
				cy + ry < 0 ||
				cy - ry > height
			) {
				continue;
			}
			const i = count * 4;
			this._lights[i] = cx;
			this._lights[i + 1] = cy;
			this._lights[i + 2] = rx;
			this._lights[i + 3] = ry;
			this._params[i] = light.softness;
			count++;
		}
		this._view[0] = x;
		this._view[1] = y;
		this._view[2] = width;
		this._view[3] = height;
		this.setUniform("uLights", this._lights);
		this.setUniform("uParams", this._params);
		this.setUniform("uView", this._view);
		this.setUniform("uCount", count);
	}
}
