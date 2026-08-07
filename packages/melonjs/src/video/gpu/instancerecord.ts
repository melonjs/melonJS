import type { Matrix3d } from "../../math/matrix3d.ts";

/**
 * The per-instance record shared by both GPU backends (#1508).
 *
 * An instance carries a **row-major 3×4 affine transform** — three `vec4`
 * rows — rather than a full 4×4: the bottom row of an affine matrix is
 * always `(0, 0, 0, 1)`, so storing it would waste 16 bytes and a fourth
 * attribute slot per instance. Two further slots are opt-in, declared once
 * per instanced mesh:
 *
 * The transform occupies 12 floats (48 bytes); a colour slot adds 4 more
 * (16 bytes) when `instanceColors` is declared, and a custom-data slot
 * another 4 when `instanceData` is.
 *
 * Colour is four floats rather than four packed bytes for the same reason
 * `aColor` is on the mesh vertex layout: a packed 4-byte slot can form a
 * NaN bit pattern that Apple's Metal-backed driver canonicalizes on upload,
 * zeroing the bytes the shader reads.
 *
 * The custom slot is deliberately **opaque** — the stock lit shader reads
 * its `rgb` as emissive, while a custom mesh shader is free to read it as a
 * wind phase, an atlas offset or a random seed.
 * @ignore
 */

/**
 * floats occupied by the 3×4 transform
 * @ignore
 */
export const TRANSFORM_FLOATS = 12;

/**
 * floats occupied by an optional `vec4` slot
 * @ignore
 */
export const SLOT_FLOATS = 4;

/**
 * Describes one instanced mesh's record: how wide it is and where each
 * optional slot begins. Offsets are in floats; multiply by 4 for bytes.
 * @ignore
 */
export interface InstanceRecordLayout {
	/** floats per instance */
	floats: number;
	/** bytes per instance (the vertex-buffer `arrayStride`) */
	stride: number;
	/** float offset of the colour slot, or -1 when absent */
	colorOffset: number;
	/** float offset of the custom-data slot, or -1 when absent */
	dataOffset: number;
	/** whether the colour slot is present */
	hasColor: boolean;
	/** whether the custom-data slot is present */
	hasData: boolean;
}

/**
 * Build the record layout for the given opt-in slots.
 * @param hasColor - whether a per-instance colour slot is present
 * @param hasData - whether a per-instance custom `vec4` slot is present
 * @returns the resolved layout
 * @ignore
 */
export function instanceRecordLayout(
	hasColor: boolean,
	hasData: boolean,
): InstanceRecordLayout {
	let floats = TRANSFORM_FLOATS;
	const colorOffset = hasColor ? floats : -1;
	if (hasColor) {
		floats += SLOT_FLOATS;
	}
	const dataOffset = hasData ? floats : -1;
	if (hasData) {
		floats += SLOT_FLOATS;
	}
	return {
		floats,
		stride: floats * Float32Array.BYTES_PER_ELEMENT,
		colorOffset,
		dataOffset,
		hasColor,
		hasData,
	};
}

/**
 * Write a matrix into an instance record as three row-major `vec4` rows.
 *
 * `Matrix3d` stores its values **column-major** (the GL convention —
 * translation lives at `val[12..14]`), so this transposes the upper 3×4 on
 * the way in. The shader transposes back when it rebuilds a `mat4`.
 * @param target - the CPU-side instance buffer
 * @param offset - float offset of this instance's record
 * @param matrix - the transform to write
 * @ignore
 */
export function writeInstanceTransform(
	target: Float32Array,
	offset: number,
	matrix: Matrix3d,
): void {
	const m = matrix.val;
	// row 0: basis x-components + translation x
	target[offset] = m[0];
	target[offset + 1] = m[4];
	target[offset + 2] = m[8];
	target[offset + 3] = m[12];
	// row 1
	target[offset + 4] = m[1];
	target[offset + 5] = m[5];
	target[offset + 6] = m[9];
	target[offset + 7] = m[13];
	// row 2
	target[offset + 8] = m[2];
	target[offset + 9] = m[6];
	target[offset + 10] = m[10];
	target[offset + 11] = m[14];
}

/**
 * Write a translation / rotation / scale triple into an instance record.
 *
 * This is the shape authored instancing arrives in: glTF's
 * `EXT_mesh_gpu_instancing` stores per-instance `TRANSLATION`, `ROTATION`
 * (a quaternion) and `SCALE` accessors rather than matrices. Composing them
 * straight into the record avoids building a `Matrix3d` per instance —
 * a forest of five thousand trees would otherwise allocate five thousand
 * throwaway matrices at load.
 *
 * The rotation is applied first, then scale, then translation (glTF's
 * `T * R * S` convention), and the result is transposed into the record's
 * row-major rows.
 * @param target - the CPU-side instance buffer
 * @param offset - float offset of this instance's record
 * @param tx - translation x
 * @param ty - translation y
 * @param tz - translation z
 * @param qx - rotation quaternion x
 * @param qy - rotation quaternion y
 * @param qz - rotation quaternion z
 * @param qw - rotation quaternion w
 * @param sx - scale x
 * @param sy - scale y
 * @param sz - scale z
 * @ignore
 */
export function writeInstanceTRS(
	target: Float32Array,
	offset: number,
	tx: number,
	ty: number,
	tz: number,
	qx: number,
	qy: number,
	qz: number,
	qw: number,
	sx: number,
	sy: number,
	sz: number,
): void {
	// quaternion → 3×3 basis (columns), then each column scaled
	const x2 = qx + qx;
	const y2 = qy + qy;
	const z2 = qz + qz;
	const xx = qx * x2;
	const xy = qx * y2;
	const xz = qx * z2;
	const yy = qy * y2;
	const yz = qy * z2;
	const zz = qz * z2;
	const wx = qw * x2;
	const wy = qw * y2;
	const wz = qw * z2;

	// row 0 = (basis[0][0], basis[1][0], basis[2][0], tx)
	target[offset] = (1 - (yy + zz)) * sx;
	target[offset + 1] = (xy - wz) * sy;
	target[offset + 2] = (xz + wy) * sz;
	target[offset + 3] = tx;
	// row 1
	target[offset + 4] = (xy + wz) * sx;
	target[offset + 5] = (1 - (xx + zz)) * sy;
	target[offset + 6] = (yz - wx) * sz;
	target[offset + 7] = ty;
	// row 2
	target[offset + 8] = (xz - wy) * sx;
	target[offset + 9] = (yz + wx) * sy;
	target[offset + 10] = (1 - (xx + yy)) * sz;
	target[offset + 11] = tz;
}

/**
 * Write an identity transform into an instance record — what a freshly
 * grown slot holds until the caller places it, so an unplaced instance
 * renders at the group origin rather than collapsing onto a zero matrix.
 * @param target - the CPU-side instance buffer
 * @param offset - float offset of this instance's record
 * @ignore
 */
export function writeIdentityTransform(
	target: Float32Array,
	offset: number,
): void {
	target[offset] = 1;
	target[offset + 1] = 0;
	target[offset + 2] = 0;
	target[offset + 3] = 0;
	target[offset + 4] = 0;
	target[offset + 5] = 1;
	target[offset + 6] = 0;
	target[offset + 7] = 0;
	target[offset + 8] = 0;
	target[offset + 9] = 0;
	target[offset + 10] = 1;
	target[offset + 11] = 0;
}

/**
 * Read an instance's transform back into a `Matrix3d`, undoing the
 * row-major packing.
 * @param source - the CPU-side instance buffer
 * @param offset - float offset of this instance's record
 * @param out - the matrix to write into
 * @returns `out`
 * @ignore
 */
export function readInstanceTransform(
	source: Float32Array,
	offset: number,
	out: Matrix3d,
): Matrix3d {
	const m = out.val;
	m[0] = source[offset];
	m[4] = source[offset + 1];
	m[8] = source[offset + 2];
	m[12] = source[offset + 3];
	m[1] = source[offset + 4];
	m[5] = source[offset + 5];
	m[9] = source[offset + 6];
	m[13] = source[offset + 7];
	m[2] = source[offset + 8];
	m[6] = source[offset + 9];
	m[10] = source[offset + 10];
	m[14] = source[offset + 11];
	// the row the record does not store
	m[3] = 0;
	m[7] = 0;
	m[11] = 0;
	m[15] = 1;
	return out;
}

/**
 * The attribute names an instanced shader declares, in record order. Shared
 * by both backends so the GL attribute records and the WGSL vertex layout
 * describe the same thing.
 * @ignore
 */
export const INSTANCE_ATTRIBUTE_NAMES = {
	rows: ["aInstanceRow0", "aInstanceRow1", "aInstanceRow2"],
	color: "aInstanceColor",
	data: "aInstanceData",
} as const;

/**
 * Shader locations for the instance slots, counted from the first location
 * after a tier's geometry attributes.
 *
 * These are **fixed per slot rather than sequential**, so a variant that
 * omits the colour slot does not shift the data slot down. On WebGPU that is
 * what lets one WGSL module text serve every variant — WGSL has no
 * preprocessor to renumber `@location` with — and on WebGL it keeps the two
 * backends describing the same thing.
 * @ignore
 */
export const INSTANCE_SLOT_OFFSETS = {
	rows: [0, 1, 2],
	color: 3,
	data: 4,
} as const;

/**
 * Backend-neutral attribute descriptors for an instance record, in the
 * `{name, format, offset}` vocabulary both backends consume.
 * @param layout - the record layout
 * @param baseLocation - first shader location for this record (the location
 * after the tier's geometry attributes). Omit on WebGL, whose attribute
 * locations come from the shader's own declaration order.
 * @returns attribute descriptors covering the whole record
 * @ignore
 */
export function instanceAttributes(
	layout: InstanceRecordLayout,
	baseLocation?: number,
) {
	const bytes = Float32Array.BYTES_PER_ELEMENT;
	const at = (slot: number) => {
		return baseLocation === undefined
			? undefined
			: { shaderLocation: baseLocation + slot };
	};
	const attributes: {
		name: string;
		format: string;
		offset: number;
		shaderLocation?: number;
	}[] = [
		{
			name: INSTANCE_ATTRIBUTE_NAMES.rows[0],
			format: "float32x4",
			offset: 0,
			...at(INSTANCE_SLOT_OFFSETS.rows[0]),
		},
		{
			name: INSTANCE_ATTRIBUTE_NAMES.rows[1],
			format: "float32x4",
			offset: 4 * bytes,
			...at(INSTANCE_SLOT_OFFSETS.rows[1]),
		},
		{
			name: INSTANCE_ATTRIBUTE_NAMES.rows[2],
			format: "float32x4",
			offset: 8 * bytes,
			...at(INSTANCE_SLOT_OFFSETS.rows[2]),
		},
	];
	if (layout.hasColor) {
		attributes.push({
			name: INSTANCE_ATTRIBUTE_NAMES.color,
			format: "float32x4",
			offset: layout.colorOffset * bytes,
			...at(INSTANCE_SLOT_OFFSETS.color),
		});
	}
	if (layout.hasData) {
		attributes.push({
			name: INSTANCE_ATTRIBUTE_NAMES.data,
			format: "float32x4",
			offset: layout.dataOffset * bytes,
			...at(INSTANCE_SLOT_OFFSETS.data),
		});
	}
	return attributes;
}
