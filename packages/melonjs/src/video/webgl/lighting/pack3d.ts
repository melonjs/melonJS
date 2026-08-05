import type { Light3d } from "../../../lighting/light3d.ts";
import { MAX_LIGHTS } from "./constants.ts";

/**
 * Uniform-ready packing of the active 3D lights for the mesh-lit shader.
 * @ignore
 */
export interface PackedMeshLighting {
	/** number of active shaded lights, clamped to `MAX_LIGHTS`. */
	count: number;
	/**
	 * `MAX_LIGHTS × 4` — `[x, y, z, range]` per light; `range` is `-1` for
	 * directional lights (the shader's type sentinel).
	 */
	posRange: Float32Array;
	/**
	 * `MAX_LIGHTS × 4` — `[dx, dy, dz, cos(outerConeAngle)]` per light;
	 * `cosOuter` is `-1` when no cone applies (directional carries the
	 * pre-negated surface→light vector, point carries no direction).
	 */
	dirCone: Float32Array;
	/**
	 * `MAX_LIGHTS × 4` — `[r, g, b, cos(innerConeAngle)]` per light,
	 * color premultiplied by intensity.
	 */
	colorInner: Float32Array;
	/** the summed ambient color (RGB, 0..1+). */
	ambient: Float32Array;
}

// reused output buffers — the packed result is consumed immediately each frame
// by the lit mesh batcher, so a single shared set is safe and allocation-free.
const _posRange = new Float32Array(MAX_LIGHTS * 4);
const _dirCone = new Float32Array(MAX_LIGHTS * 4);
const _colorInner = new Float32Array(MAX_LIGHTS * 4);
const _ambient = new Float32Array(3);
const _result: PackedMeshLighting = {
	count: 0,
	posRange: _posRange,
	dirCone: _dirCone,
	colorInner: _colorInner,
	ambient: _ambient,
};

/**
 * Pack an iterable of {@link Light3d} (e.g. the active `Stage`'s 3D-light set)
 * into the std140-ready arrays the mesh-lit shader reads:
 * - **directional** lights contribute a surface→light direction (negated
 *   travel direction, normalized) + a color premultiplied by intensity.
 *   Re-normalized here so a direction mutated at runtime without
 *   re-normalizing still shades correctly.
 * - **point** lights contribute their world position, `range` (quadratic
 *   falloff over the range — the Light2d model) and premultiplied color.
 * - **spot** lights add their travel direction and the cone cosines
 *   (`innerConeAngle` clamped just inside `outerConeAngle`, so the
 *   smoothstep denominator never collapses).
 * - **ambient** lights are summed into a single flat ambient color.
 *
 * The same buffers are returned each call (overwritten in place).
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
			if (count >= MAX_LIGHTS) {
				continue;
			}
			const o = count * 4;
			const k = light.intensity;
			_colorInner[o] = (light.color.r / 255) * k;
			_colorInner[o + 1] = (light.color.g / 255) * k;
			_colorInner[o + 2] = (light.color.b / 255) * k;
			_colorInner[o + 3] = 0;

			if (light.type === "directional") {
				const dx = light.direction.x;
				const dy = light.direction.y;
				const dz = light.direction.z;
				const len = Math.hypot(dx, dy, dz) || 1;
				// directional sentinel: range < 0; position unused
				_posRange[o] = 0;
				_posRange[o + 1] = 0;
				_posRange[o + 2] = 0;
				_posRange[o + 3] = -1;
				// store the surface→light vector (negated travel direction)
				_dirCone[o] = -dx / len;
				_dirCone[o + 1] = -dy / len;
				_dirCone[o + 2] = -dz / len;
				_dirCone[o + 3] = -1;
				count++;
				continue;
			}
			if (light.type === "point" || light.type === "spot") {
				_posRange[o] = light.position.x;
				_posRange[o + 1] = light.position.y;
				_posRange[o + 2] = light.position.z;
				// quadratic falloff needs a scale — a degenerate range would
				// make the light a point-sized pop
				_posRange[o + 3] = Math.max(light.range ?? 0, 1);
				if (light.type === "spot") {
					const dx = light.direction.x;
					const dy = light.direction.y;
					const dz = light.direction.z;
					const len = Math.hypot(dx, dy, dz) || 1;
					// the light's TRAVEL direction (cone axis), normalized
					_dirCone[o] = dx / len;
					_dirCone[o + 1] = dy / len;
					_dirCone[o + 2] = dz / len;
					// floor the outer angle so the inner clamp below can never
					// invert the smoothstep edges (edge0 >= edge1 is undefined
					// in GLSL, NaN-prone in WGSL) — an authored cone under
					// ~0.11° is a degenerate laser anyway
					const outer = Math.max(light.outerConeAngle ?? Math.PI / 4, 2e-3);
					// inner strictly inside outer, or the cone edge divides by 0
					const inner = Math.max(
						Math.min(light.innerConeAngle ?? 0, outer - 1e-3),
						0,
					);
					_dirCone[o + 3] = Math.cos(outer);
					_colorInner[o + 3] = Math.cos(inner);
				} else {
					// point: no cone — the shader's "no cone" sentinel
					_dirCone[o] = 0;
					_dirCone[o + 1] = 0;
					_dirCone[o + 2] = 0;
					_dirCone[o + 3] = -1;
				}
				count++;
			}
			// unknown types are skipped
		}
	}
	_ambient[0] = ar;
	_ambient[1] = ag;
	_ambient[2] = ab;
	_result.count = count;
	return _result;
}
