import type { Light3d } from "../../../lighting/light3d.ts";
import { MAX_LIGHTS } from "./constants.ts";

/**
 * Uniform-ready packing of the active 3D lights for the mesh-lit shader.
 * @ignore
 */
export interface PackedMeshLighting {
	/** number of active directional lights, clamped to `MAX_LIGHTS`. */
	count: number;
	/** `MAX_LIGHTS × 3` surface→light directions (already negated, normalized). */
	directions: Float32Array;
	/** `MAX_LIGHTS × 3` directional light colors premultiplied by intensity. */
	colors: Float32Array;
	/** the summed ambient color (RGB, 0..1+). */
	ambient: Float32Array;
}

// reused output buffers — the packed result is consumed immediately each frame
// by the lit mesh batcher, so a single shared set is safe and allocation-free.
const _dir = new Float32Array(MAX_LIGHTS * 3);
const _color = new Float32Array(MAX_LIGHTS * 3);
const _ambient = new Float32Array(3);
const _result: PackedMeshLighting = {
	count: 0,
	directions: _dir,
	colors: _color,
	ambient: _ambient,
};

/**
 * Pack an iterable of {@link Light3d} (e.g. the active `Stage`'s 3D-light set)
 * into the uniform arrays the mesh-lit shader reads:
 * - **directional** lights contribute a surface→light direction (negated travel
 *   direction, normalized) + a color premultiplied by intensity, up to
 *   `MAX_LIGHTS`. Re-normalized here so a direction mutated at runtime without
 *   re-normalizing still shades correctly.
 * - **ambient** lights are summed into a single flat ambient color.
 *
 * Other types (`"point"`) are skipped — not shaded yet. The same buffers are
 * returned each call (overwritten in place).
 * @param lights - iterable of lights, or `null`/`undefined` (treated as empty)
 * @returns the packed lighting (reused instance)
 * @ignore
 */
export function packMeshLights(
	lights: Iterable<Light3d> | null | undefined,
): PackedMeshLighting {
	let count = 0;
	let ar = 0;
	let ag = 0;
	let ab = 0;
	if (lights) {
		for (const light of lights) {
			if (light.type === "ambient") {
				const k = light.intensity;
				ar += (light.color.r / 255) * k;
				ag += (light.color.g / 255) * k;
				ab += (light.color.b / 255) * k;
				continue;
			}
			// only directional lights are shaded in this release
			if (light.type !== "directional" || count >= MAX_LIGHTS) {
				continue;
			}
			const o = count * 3;
			const dx = light.direction.x;
			const dy = light.direction.y;
			const dz = light.direction.z;
			const len = Math.hypot(dx, dy, dz) || 1;
			// store the surface→light vector (negated travel direction), normalized
			_dir[o] = -dx / len;
			_dir[o + 1] = -dy / len;
			_dir[o + 2] = -dz / len;
			const k = light.intensity;
			_color[o] = (light.color.r / 255) * k;
			_color[o + 1] = (light.color.g / 255) * k;
			_color[o + 2] = (light.color.b / 255) * k;
			count++;
		}
	}
	_ambient[0] = ar;
	_ambient[1] = ag;
	_ambient[2] = ab;
	_result.count = count;
	return _result;
}
