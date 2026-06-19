import { Color } from "../math/color.ts";
import { MAX_LIGHTS } from "../video/webgl/lighting/constants.ts";
import type { Light3d } from "./light3d.ts";

/**
 * Packed, shader-ready view of a {@link LightingEnvironment}, returned by
 * {@link LightingEnvironment#pack}. Arrays are reused between calls.
 * @category Lighting
 */
export interface PackedLighting {
	/** number of active (directional) lights, clamped to `MAX_LIGHTS`. */
	count: number;
	/** `MAX_LIGHTS × 3` surface→light directions (already negated, normalized). */
	directions: Float32Array;
	/** `MAX_LIGHTS × 3` light colors premultiplied by intensity (0..1+). */
	colors: Float32Array;
	/** `3` ambient color premultiplied by ambient intensity (0..1). */
	ambient: Float32Array;
}

/**
 * A scene-level container of {@link Light3d} sources plus an ambient term,
 * consumed by the mesh shader to light {@link Mesh} renderables under a
 * `Camera3d`. Lighting is applied only when the environment has at least one
 * light; with none, meshes render fullbright (unlit) — so adding this is
 * non-breaking.
 *
 * Use {@link LightingEnvironment.default} as the active environment (the mesh
 * batcher reads it), or construct your own. Loading a glTF/GLB scene via
 * `me.level.load(...)` instantiates the scene's authored lights into the
 * default environment automatically.
 *
 * Only **directional** lights contribute today (see {@link Light3d}).
 * @category Lighting
 * @example
 * import { Light3d, LightingEnvironment } from "melonjs";
 * LightingEnvironment.default.addLight(new Light3d({ direction: [0.4, 1, 0.3] }));
 * LightingEnvironment.default.setAmbient("#404858", 1);
 */
export class LightingEnvironment {
	/** the active environment read by the mesh batcher each frame. */
	static default = new LightingEnvironment();

	/** the lights in this environment. */
	lights: Light3d[];
	/** ambient color (a flat floor added to every lit fragment). */
	ambientColor: Color;
	/** scalar multiplier on {@link LightingEnvironment#ambientColor}. */
	ambientIntensity: number;

	private _dir: Float32Array;
	private _color: Float32Array;
	private _ambient: Float32Array;

	constructor() {
		this.lights = [];
		// a soft neutral ambient so faces turned away from the light aren't
		// pure black once lighting is active
		this.ambientColor = new Color(255, 255, 255, 1);
		this.ambientIntensity = 0.3;
		this._dir = new Float32Array(MAX_LIGHTS * 3);
		this._color = new Float32Array(MAX_LIGHTS * 3);
		this._ambient = new Float32Array(3);
	}

	/**
	 * Add a light (no-op if already present).
	 * @param light - the light to add
	 * @returns the same light, for chaining
	 */
	addLight(light: Light3d): Light3d {
		if (!this.lights.includes(light)) {
			this.lights.push(light);
		}
		return light;
	}

	/**
	 * Remove a previously added light.
	 * @param light - the light to remove
	 */
	removeLight(light: Light3d): void {
		const i = this.lights.indexOf(light);
		if (i !== -1) {
			this.lights.splice(i, 1);
		}
	}

	/** Remove all lights. */
	clear(): void {
		this.lights.length = 0;
	}

	/**
	 * Set the ambient floor.
	 * @param color - a {@link Color} or CSS color string
	 * @param [intensity] - scalar multiplier (defaults to the current value)
	 * @returns this environment, for chaining
	 */
	setAmbient(color: Color | string, intensity?: number): this {
		this.ambientColor =
			color instanceof Color ? color : new Color().parseCSS(color);
		if (typeof intensity === "number") {
			this.ambientIntensity = intensity;
		}
		return this;
	}

	/**
	 * Pack the active directional lights + ambient into shader-ready arrays.
	 * Reuses internal buffers — copy the result if you need to retain it.
	 * @returns the packed, shader-ready lighting state
	 */
	pack(): PackedLighting {
		let count = 0;
		for (const light of this.lights) {
			if (count >= MAX_LIGHTS) {
				break;
			}
			// only directional lights are shaded in this release
			if (light.type !== "directional") {
				continue;
			}
			const o = count * 3;
			// store the surface→light vector (negated travel direction),
			// normalized so the shader can `max(dot(N, dir), 0)` directly even
			// if the light's direction was mutated at runtime without
			// re-normalizing.
			const dx = light.direction.x;
			const dy = light.direction.y;
			const dz = light.direction.z;
			const len = Math.hypot(dx, dy, dz) || 1;
			this._dir[o] = -dx / len;
			this._dir[o + 1] = -dy / len;
			this._dir[o + 2] = -dz / len;
			const k = light.intensity;
			this._color[o] = (light.color.r / 255) * k;
			this._color[o + 1] = (light.color.g / 255) * k;
			this._color[o + 2] = (light.color.b / 255) * k;
			count++;
		}
		this._ambient[0] = (this.ambientColor.r / 255) * this.ambientIntensity;
		this._ambient[1] = (this.ambientColor.g / 255) * this.ambientIntensity;
		this._ambient[2] = (this.ambientColor.b / 255) * this.ambientIntensity;
		return {
			count,
			directions: this._dir,
			colors: this._color,
			ambient: this._ambient,
		};
	}
}
