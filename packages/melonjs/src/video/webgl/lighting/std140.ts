import { MAX_LIGHTS } from "./constants.ts";

/**
 * std140 layout for the light uniform blocks.
 *
 * `std140` is a published set of alignment rules that both the shader and
 * this module can compute offsets from independently, so the block can be
 * filled by writing into a plain `Float32Array` rather than querying the
 * driver for where each member landed.
 *
 * The rule that shapes everything here: **every array element is padded up
 * to 16 bytes**, whatever its type. A `vec3` occupies 16 bytes rather than
 * 12, and a `float[]` costs 16 bytes per entry rather than 4. So the layout
 * folds the loose scalars into the `w` components that would otherwise be
 * padding — `radius` and `intensity` ride along with the position, and
 * `lightHeight` with the colour. That is free: the bytes were reserved
 * either way.
 *
 * A literal translation of the old uniform arrays would have cost 1536
 * bytes of light data per 32 lights, a third of it padding; this costs
 * 1024, with none. The whole block is 1056 bytes — the extra 32 are the
 * count + ambient header.
 *
 * ## Getting this wrong is silent
 *
 * A mislaid offset does not throw. The buffer uploads, the shader reads,
 * and every light after the mistake is simply shifted — which renders
 * subtly wrong rather than obviously broken. The offsets below are
 * therefore stated as explicit constants and pinned byte-for-byte by
 * `tests/lighting_std140.spec.js` against a layout written out by hand.
 */

/**
 * floats per `vec4`, the block's fundamental unit
 * @ignore
 */
const VEC4 = 4;

/**
 * Header, occupying two `vec4`s before the light array begins.
 *
 * ```glsl
 * int  count;     // offset 0
 * vec3 ambient;   // offset 16 — a vec3 aligns to 16, so it cannot share
 * ```
 *
 * `count` is written as a float and read back with `int(...)` in the
 * shader. Declaring it `int` in the block would be tidier, but mixing int
 * and float members means the staging buffer can no longer be a single
 * `Float32Array` view, and the cast is free on every GPU that matters.
 * @ignore
 */
export const HEADER_FLOATS = VEC4 * 2;

/**
 * floats occupied by one light: two `vec4`s
 * @ignore
 */
export const LIGHT_FLOATS = VEC4 * 2;

/**
 * total floats in a light block, header included
 * @ignore
 */
export const BLOCK_FLOATS = HEADER_FLOATS + MAX_LIGHTS * LIGHT_FLOATS;

/**
 * total bytes in a light block
 * @ignore
 */
export const BLOCK_BYTES = BLOCK_FLOATS * Float32Array.BYTES_PER_ELEMENT;

/**
 * Write the block header.
 * @param out - staging buffer
 * @param count - number of live lights
 * @param ambient - ambient colour, 0..1 per channel
 * @ignore
 */
function writeHeader(
	out: Float32Array,
	count: number,
	ambient: ArrayLike<number> | undefined,
): void {
	out[0] = count;
	// [1..3] are padding: `count` is a scalar but the following `vec3`
	// aligns to 16, so it cannot share this slot
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = ambient?.[0] ?? 0;
	out[5] = ambient?.[1] ?? 0;
	out[6] = ambient?.[2] ?? 0;
	out[7] = 0;
}

/**
 * Lay out 2D (`Light2d`) data.
 *
 * ```glsl
 * struct Light2dData {
 *   vec4 posRadiusIntensity;  // x, y, radius, intensity
 *   vec4 colorHeight;         // r, g, b, lightHeight
 * };
 * ```
 * @param out - staging buffer, at least `BLOCK_FLOATS` long
 * @param packed - what {@link packLights} produced
 * @param packed.count - number of live lights, clamped to `MAX_LIGHTS`
 * @param packed.positions - `[x, y, radius, intensity]` per light
 * @param packed.colors - `[r, g, b]` per light, 0..1 per channel
 * @param packed.heights - per-light height; absent means 0
 * @param packed.ambient - `[r, g, b]` ambient floor; absent means black
 * @returns how many floats of `out` are live, for a partial upload
 * @ignore
 */
export function writeLight2dBlock(
	out: Float32Array,
	packed: {
		count: number;
		positions: Float32Array;
		colors: Float32Array;
		heights?: Float32Array;
		ambient?: ArrayLike<number>;
	},
): number {
	// `count` reaches here straight from a caller (`setLightUniforms` is
	// public), so clamp rather than trust it — against the block's capacity
	// AND against what the source arrays actually hold. Overrunning the
	// block would corrupt a neighbouring binding point; overrunning the
	// source reads `undefined`, and `Float32Array[i] = undefined` stores
	// NaN, which shades black and — because `NaN !== NaN` — also defeats
	// the upload dirty-check from then on, turning a free frame into a
	// `bufferSubData` every frame. A negative or NaN count must produce an
	// empty block, not a negative live length: hence `Math.max(0, …)`.
	const count = Math.min(
		Math.max(packed.count | 0, 0),
		MAX_LIGHTS,
		packed.positions.length >> 2,
		Math.floor(packed.colors.length / 3),
	);
	writeHeader(out, count, packed.ambient);

	const heights = packed.heights;
	for (let i = 0; i < count; i++) {
		const o = HEADER_FLOATS + i * LIGHT_FLOATS;
		out[o] = packed.positions[i * 4];
		out[o + 1] = packed.positions[i * 4 + 1];
		out[o + 2] = packed.positions[i * 4 + 2];
		out[o + 3] = packed.positions[i * 4 + 3];
		out[o + 4] = packed.colors[i * 3];
		out[o + 5] = packed.colors[i * 3 + 1];
		out[o + 6] = packed.colors[i * 3 + 2];
		// no `heights` means "flat" — the shader normalizes
		// `vec3(toLight, height)`, and a 0 there is degenerate only when the
		// light sits exactly on the fragment, which the old path had too
		out[o + 7] = heights?.[i] ?? 0;
	}
	return HEADER_FLOATS + count * LIGHT_FLOATS;
}

/**
 * floats occupied by one 3D light: three `vec4`s. The 3D block grew from
 * two when point/spot shading landed (#1536) — a spot light needs position
 * + range + direction + both cone cosines + color, which cannot fold into
 * two vec4s' padding. The 2D block keeps its two-vec4 stride.
 * @ignore
 */
export const LIGHT3D_FLOATS = VEC4 * 3;

/**
 * total floats in a 3D light block, header included
 * @ignore
 */
export const BLOCK3D_FLOATS = HEADER_FLOATS + MAX_LIGHTS * LIGHT3D_FLOATS;

/**
 * total bytes in a 3D light block
 * @ignore
 */
export const BLOCK3D_BYTES = BLOCK3D_FLOATS * Float32Array.BYTES_PER_ELEMENT;

/**
 * Lay out 3D (`Light3d`) data.
 *
 * ```glsl
 * struct Light3dData {
 *   vec4 posRange;    // x, y, z = world position · w = range;
 *                     //   w < 0 marks a DIRECTIONAL light (xyz unused)
 *   vec4 dirCone;     // x, y, z = direction · w = cos(outerConeAngle);
 *                     //   w = -1 marks "no cone" (directional dir is the
 *                     //   pre-negated surface→light vector; a point light
 *                     //   carries no direction)
 *   vec4 colorInner;  // r, g, b = color × intensity · w = cos(innerConeAngle)
 * };
 * ```
 *
 * The type is inferred from the sentinels rather than a tag slot:
 * `posRange.w < 0` → directional; otherwise positional, with a cone
 * applied when `dirCone.w > -1`.
 * @param out - staging buffer, at least `BLOCK3D_FLOATS` long
 * @param packed - what {@link packMeshLights} produced
 * @param packed.count - number of live lights, clamped to `MAX_LIGHTS`
 * @param packed.posRange - `[x, y, z, range]` per light (range -1 for directional)
 * @param packed.dirCone - `[dx, dy, dz, cosOuter]` per light (cosOuter -1 for none)
 * @param packed.colorInner - `[r, g, b, cosInner]` per light
 * @param packed.ambient - `[r, g, b]` ambient floor; absent means black
 * @returns how many floats of `out` are live, for a partial upload
 * @ignore
 */
export function writeLight3dBlock(
	out: Float32Array,
	packed: {
		count: number;
		posRange: Float32Array;
		dirCone: Float32Array;
		colorInner: Float32Array;
		ambient?: ArrayLike<number>;
	},
): number {
	// clamped the same way as the 2D path, and for the same reasons
	const count = Math.min(
		Math.max(packed.count | 0, 0),
		MAX_LIGHTS,
		Math.floor(packed.posRange.length / 4),
		Math.floor(packed.dirCone.length / 4),
		Math.floor(packed.colorInner.length / 4),
	);
	writeHeader(out, count, packed.ambient);

	for (let i = 0; i < count; i++) {
		const o = HEADER_FLOATS + i * LIGHT3D_FLOATS;
		const i4 = i * 4;
		out[o] = packed.posRange[i4];
		out[o + 1] = packed.posRange[i4 + 1];
		out[o + 2] = packed.posRange[i4 + 2];
		out[o + 3] = packed.posRange[i4 + 3];
		out[o + 4] = packed.dirCone[i4];
		out[o + 5] = packed.dirCone[i4 + 1];
		out[o + 6] = packed.dirCone[i4 + 2];
		out[o + 7] = packed.dirCone[i4 + 3];
		out[o + 8] = packed.colorInner[i4];
		out[o + 9] = packed.colorInner[i4 + 1];
		out[o + 10] = packed.colorInner[i4 + 2];
		out[o + 11] = packed.colorInner[i4 + 3];
	}
	return HEADER_FLOATS + count * LIGHT3D_FLOATS;
}
