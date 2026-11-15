/**
 * A two-bone skinned "bar", built in memory as a GLB, for the skinning tests.
 *
 *   node 0 "bar"   — the skinned mesh. Deliberately translated to x = 100:
 *                    the spec says a skinned mesh's own node transform is
 *                    IGNORED, so nothing may end up near x = 100.
 *   node 1 "hip"   — joint 0, at the origin
 *   └─ node 2 "knee" — joint 1, at (0, 1, 0)
 *
 *   v0 (0,0,0)  v1 (1,0,0)  → bound fully to the hip
 *   v2 (0,2,0)  v3 (1,2,0)  → bound fully to the knee
 *
 * Clips: "bend" turns the knee 90° about Z over one second, "lift" holds the
 * hip at y = 10, "rest" holds it at y = 0.
 */

export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const translation = (x, y, z) => {
	return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
};
// quaternion for 90° about Z
export const QZ90 = [0, 0, Math.SQRT1_2, Math.SQRT1_2];

function packGLB(json, bin) {
	const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
	const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
	const binPad = (4 - (bin.length % 4)) % 4;
	const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + bin.length + binPad;
	const ab = new ArrayBuffer(total);
	const dv = new DataView(ab);
	const u8 = new Uint8Array(ab);
	dv.setUint32(0, 0x46546c67, true);
	dv.setUint32(4, 2, true);
	dv.setUint32(8, total, true);
	let o = 12;
	dv.setUint32(o, jsonBytes.length + jsonPad, true);
	dv.setUint32(o + 4, 0x4e4f534a, true);
	o += 8;
	u8.set(jsonBytes, o);
	o += jsonBytes.length;
	for (let i = 0; i < jsonPad; i++) {
		u8[o++] = 0x20;
	}
	dv.setUint32(o, bin.length + binPad, true);
	dv.setUint32(o + 4, 0x004e4942, true);
	o += 8;
	u8.set(bin, o);
	return ab;
}

/**
 * Lay typed arrays out back to back (4-byte aligned) and describe each as a
 * bufferView + accessor.
 */
function packParts(parts) {
	let size = 0;
	const offsets = parts.map((p) => {
		const off = size;
		size += Math.ceil(p.data.byteLength / 4) * 4;
		return off;
	});
	const bin = new Uint8Array(size);
	const bufferViews = [];
	const accessors = [];
	parts.forEach((p, i) => {
		bin.set(
			new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.byteLength),
			offsets[i],
		);
		bufferViews.push({
			buffer: 0,
			byteOffset: offsets[i],
			byteLength: p.data.byteLength,
		});
		accessors.push({
			bufferView: i,
			componentType: p.componentType,
			count: p.count,
			type: p.type,
			...(p.normalized ? { normalized: true } : {}),
		});
	});
	return { bin, bufferViews, accessors };
}

/**
 * The two-bone bar described at the top of this file.
 * @param {object} [o]
 * @param {"float"|"ubyte"} [o.weights="float"] - how WEIGHTS_0 is encoded
 * @param {boolean} [o.ibm=true] - include the inverse bind matrices accessor
 * @param {boolean} [o.animations=true] - include the clips
 * @param {number[]} [o.joints] - override the JOINTS_0 data (16 entries)
 */
export function buildBarGLB({
	weights = "float",
	ibm = true,
	animations = true,
	joints,
} = {}) {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 2, 0]);
	const normals = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
	const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);
	const jointData = new Uint8Array(
		joints ?? [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
	);
	const weightData =
		weights === "ubyte"
			? new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0])
			: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
	// the knee's bind world is translate(0, 1, 0), so its inverse bind matrix
	// is translate(0, -1, 0); the hip's is the identity
	const ibmData = new Float32Array([...IDENTITY, ...translation(0, -1, 0)]);
	const times = new Float32Array([0, 1]);
	const bendValues = new Float32Array([0, 0, 0, 1, ...QZ90]);
	const liftValues = new Float32Array([0, 10, 0, 0, 10, 0]);
	const restValues = new Float32Array([0, 0, 0, 0, 0, 0]);

	const parts = [
		{ data: positions, componentType: 5126, count: 4, type: "VEC3" }, // 0
		{ data: normals, componentType: 5126, count: 4, type: "VEC3" }, // 1
		{ data: indices, componentType: 5123, count: 6, type: "SCALAR" }, // 2
		{ data: jointData, componentType: 5121, count: 4, type: "VEC4" }, // 3
		{
			data: weightData,
			componentType: weights === "ubyte" ? 5121 : 5126,
			count: 4,
			type: "VEC4",
			normalized: weights === "ubyte",
		}, // 4
		{ data: ibmData, componentType: 5126, count: 2, type: "MAT4" }, // 5
		{ data: times, componentType: 5126, count: 2, type: "SCALAR" }, // 6
		{ data: bendValues, componentType: 5126, count: 2, type: "VEC4" }, // 7
		{ data: liftValues, componentType: 5126, count: 2, type: "VEC3" }, // 8
		{ data: restValues, componentType: 5126, count: 2, type: "VEC3" }, // 9
	];
	const { bin, bufferViews, accessors } = packParts(parts);
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0, 1] }],
		nodes: [
			{ name: "bar", mesh: 0, skin: 0, translation: [100, 0, 0] },
			{ name: "hip", children: [2] },
			{ name: "knee", translation: [0, 1, 0] },
		],
		meshes: [
			{
				primitives: [
					{
						attributes: {
							POSITION: 0,
							NORMAL: 1,
							JOINTS_0: 3,
							WEIGHTS_0: 4,
						},
						indices: 2,
					},
				],
			},
		],
		skins: [
			{
				name: "rig",
				joints: [1, 2],
				...(ibm ? { inverseBindMatrices: 5 } : {}),
			},
		],
		accessors,
		bufferViews,
		buffers: [{ byteLength: bin.length }],
	};
	if (animations) {
		json.animations = [
			{
				name: "bend",
				samplers: [{ input: 6, output: 7 }],
				channels: [{ sampler: 0, target: { node: 2, path: "rotation" } }],
			},
			{
				name: "lift",
				samplers: [{ input: 6, output: 8 }],
				channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
			},
			{
				name: "rest",
				samplers: [{ input: 6, output: 9 }],
				channels: [{ sampler: 0, target: { node: 1, path: "translation" } }],
			},
		];
	}
	return packGLB(json, bin);
}
