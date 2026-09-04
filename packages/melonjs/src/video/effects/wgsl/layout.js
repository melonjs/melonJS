/**
 * WGSL uniform-address-space layout calculator.
 *
 * WebGPU has no uniform reflection: when `setUniform("uStrength", v)` must
 * land at the right byte offset of an effect's uniform buffer, the offsets
 * have to be computed CPU-side from the struct the body declares. These are
 * the WGSL *uniform* address-space rules (WGSL spec §memory-layouts): every
 * member is aligned to its type's alignment, vec3 aligns like vec4, arrays
 * require a 16-byte-multiple element stride, and the struct itself rounds
 * up to 16 bytes.
 *
 * Kept deliberately to the types an effect uniform block meaningfully uses;
 * an unsupported type is a parse failure upstream (effect disables), never
 * a silently-wrong offset.
 * @ignore
 * @internal
 */

/**
 * `{align, size}` per supported member type, keyed by the canonical
 * spelling. Aliases (`vec2<f32>` form) are normalized before lookup.
 * @ignore
 * @internal
 */
const TYPE_LAYOUT = {
	f32: { align: 4, size: 4 },
	i32: { align: 4, size: 4 },
	u32: { align: 4, size: 4 },
	vec2f: { align: 8, size: 8 },
	// vec3 aligns to 16 with 12 bytes of data — the classic layout trap
	vec3f: { align: 16, size: 12 },
	vec4f: { align: 16, size: 16 },
	// matCxR: C columns of vecR, column stride = roundUp(16, sizeof(vecR))
	mat3x3f: { align: 16, size: 48 },
	mat4x4f: { align: 16, size: 64 },
};

const ARRAY_TYPE = /^array<\s*vec4f\s*,\s*(\d+)\s*>$/;

/**
 * normalize the `vecN<f32>` / `matCxR<f32>` spellings onto the short forms
 * used as TYPE_LAYOUT keys
 * @param {string} type - a WGSL type token
 * @returns {string} the canonical spelling
 * @ignore
 * @internal
 */
export function normalizeWGSLType(type) {
	return type
		.replace(/\s+/g, "")
		.replace(/^vec([234])<f32>$/, "vec$1f")
		.replace(/^mat([34])x([34])<f32>$/, "mat$1x$2f");
}

/**
 * round `value` up to the next multiple of `alignment` (a power of two)
 * @ignore
 * @internal
 */
function roundUp(alignment, value) {
	return (value + alignment - 1) & ~(alignment - 1);
}

/**
 * Compute the uniform-buffer layout for a parsed struct member list.
 * @param {Array<{name: string, type: string}>} members - struct members in declaration order
 * @returns {{map: Map<string, {offset: number, size: number, type: string}>, size: number}|null}
 *   the name → placement map and the total (16-byte-rounded) struct size,
 *   or `null` when a member type is unsupported
 * @ignore
 * @internal
 */
export function computeUniformLayout(members) {
	const map = new Map();
	let cursor = 0;
	for (const member of members) {
		const type = normalizeWGSLType(member.type);
		let layout = TYPE_LAYOUT[type];
		if (typeof layout === "undefined") {
			const array = ARRAY_TYPE.exec(type);
			if (array === null) {
				return null;
			}
			layout = { align: 16, size: 16 * parseInt(array[1], 10) };
		}
		const offset = roundUp(layout.align, cursor);
		map.set(member.name, { offset, size: layout.size, type });
		cursor = offset + layout.size;
	}
	return { map, size: roundUp(16, cursor) };
}
