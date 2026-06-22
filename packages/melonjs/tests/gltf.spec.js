import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Light3d, level, loader, Mesh, video } from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import { gltfList } from "../src/loader/cache.js";
import {
	multiplyMatrix,
	nodeLocalMatrix,
	parseGLB,
	parseGLTF,
	readAccessor,
} from "../src/loader/parsers/gltf.js";

// apply a column-major 4x4 matrix to a vec3 (independent reference impl —
// deliberately NOT the parser's code, so a bug there can't hide)
function applyMat(m, v) {
	return [
		m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
		m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
		m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
	];
}

// ── GLB container builders ──────────────────────────────────────────────────
// Pack a glTF JSON description + binary blob into a minimal GLB container
// (12-byte header + JSON chunk + BIN chunk), mirroring the binary layout the
// parser expects. Keeps the tests self-contained — no fixture file on disk.

function packGLB(json, binU8) {
	const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
	const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
	const binPad = (4 - (binU8.length % 4)) % 4;
	const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binU8.length + binPad;
	const ab = new ArrayBuffer(total);
	const dv = new DataView(ab);
	const u8 = new Uint8Array(ab);
	dv.setUint32(0, 0x46546c67, true); // magic "glTF"
	dv.setUint32(4, 2, true); // version 2
	dv.setUint32(8, total, true);
	let o = 12;
	// JSON chunk
	dv.setUint32(o, jsonBytes.length + jsonPad, true);
	o += 4;
	dv.setUint32(o, 0x4e4f534a, true); // "JSON"
	o += 4;
	u8.set(jsonBytes, o);
	o += jsonBytes.length;
	for (let i = 0; i < jsonPad; i++) {
		u8[o++] = 0x20; // pad with spaces
	}
	// BIN chunk
	dv.setUint32(o, binU8.length + binPad, true);
	o += 4;
	dv.setUint32(o, 0x004e4942, true); // "BIN\0"
	o += 4;
	u8.set(binU8, o); // trailing pad bytes stay zero
	return ab;
}

// concat a Float32 position buffer with an index buffer into one blob
function concatBin(positions, indices) {
	const posU8 = new Uint8Array(positions.buffer);
	const idxU8 = new Uint8Array(
		indices.buffer,
		indices.byteOffset,
		indices.byteLength,
	);
	const bin = new Uint8Array(posU8.length + idxU8.length);
	bin.set(posU8, 0);
	bin.set(idxU8, posU8.length);
	return bin;
}

// A single triangle, with the index buffer either Uint16 or Uint32.
// Three nodes: a translated+scaled mesh, a camera, and a 90°-Z-rotated mesh.
function buildSceneGLB({ uint32 = false } = {}) {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	const indices = uint32
		? new Uint32Array([0, 1, 2])
		: new Uint16Array([0, 1, 2]);
	const bin = concatBin(positions, indices);
	const r = Math.SQRT1_2; // sin/cos of 45° → 90° rotation quaternion about Z
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0, 1, 2] }],
		nodes: [
			{ mesh: 0, translation: [2, 3, 4], scale: [2, 2, 2] },
			{ camera: 0, translation: [0, 0, 10] },
			{ mesh: 0, rotation: [0, 0, r, r] },
		],
		cameras: [
			{
				type: "perspective",
				perspective: { yfov: 0.5, znear: 0.1, zfar: 100, aspectRatio: 1.5 },
			},
		],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			{
				bufferView: 1,
				componentType: uint32 ? 5125 : 5123,
				count: 3,
				type: "SCALAR",
			},
		],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
			{
				buffer: 0,
				byteOffset: positions.byteLength,
				byteLength: indices.byteLength,
			},
		],
		buffers: [{ byteLength: positions.byteLength + indices.byteLength }],
	};
	return packGLB(json, bin);
}

// ── Parser ──────────────────────────────────────────────────────────────────

describe("parseGLB()", () => {
	it("splits a GLB container into JSON + binary chunks", () => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2]);
		const ab = packGLB(
			{ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [] }] },
			concatBin(positions, indices),
		);
		const { json, bin } = parseGLB(ab);
		expect(json.asset.version).toBe("2.0");
		expect(bin).toBeInstanceOf(Uint8Array);
		// the BIN chunk is 4-byte aligned, so its length is the data size
		// (42) rounded up to a multiple of 4 (44); the trailing pad bytes are
		// harmless — accessors index by explicit byteOffset/byteLength
		const dataLen = positions.byteLength + indices.byteLength;
		expect(bin.byteLength).toBe(dataLen + ((4 - (dataLen % 4)) % 4));
	});

	it("falls back to JSON parsing for a non-binary .gltf", () => {
		const obj = { asset: { version: "2.0" }, scenes: [{ nodes: [] }] };
		const ab = new TextEncoder().encode(JSON.stringify(obj)).buffer;
		const { json, bin } = parseGLB(ab);
		expect(json.asset.version).toBe("2.0");
		expect(bin).toBeNull();
	});
});

describe("parseGLTF()", () => {
	it("instantiates one node per mesh primitive (cameras excluded)", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		// node0 (mesh) + node2 (mesh); node1 is a camera → not a mesh node
		expect(scene.nodes).toHaveLength(2);
		expect(scene.cameras).toHaveLength(1);
	});

	it("reads geometry through the accessors (positions + Uint16 indices)", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		const node = scene.nodes[0];
		expect(Array.from(node.vertices)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		expect(node.vertexCount).toBe(3);
		expect(node.indices).toBeInstanceOf(Uint16Array);
		expect(Array.from(node.indices)).toEqual([0, 1, 2]);
	});

	it("preserves Uint32 index buffers (large meshes)", async () => {
		const scene = await parseGLTF(buildSceneGLB({ uint32: true }));
		expect(scene.nodes[0].indices).toBeInstanceOf(Uint32Array);
		expect(Array.from(scene.nodes[0].indices)).toEqual([0, 1, 2]);
	});

	it("defaults UVs to zero when TEXCOORD_0 is absent", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		// 3 vertices × 2 components, all zero
		expect(scene.nodes[0].uvs).toBeInstanceOf(Float32Array);
		expect(Array.from(scene.nodes[0].uvs)).toEqual([0, 0, 0, 0, 0, 0]);
	});

	it("composes a node's world matrix from TRS (translation + scale)", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		const m = scene.nodes[0].world; // column-major
		expect(m[0]).toBeCloseTo(2, 5); // scale x
		expect(m[5]).toBeCloseTo(2, 5); // scale y
		expect(m[10]).toBeCloseTo(2, 5); // scale z
		expect(m[12]).toBeCloseTo(2, 5); // translate x
		expect(m[13]).toBeCloseTo(3, 5); // translate y
		expect(m[14]).toBeCloseTo(4, 5); // translate z
	});

	it("composes a node's world matrix from a rotation quaternion", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		// node2 — 90° about Z: x axis → +y, y axis → −x
		const m = scene.nodes[1].world;
		expect(m[0]).toBeCloseTo(0, 5);
		expect(m[1]).toBeCloseTo(1, 5);
		expect(m[4]).toBeCloseTo(-1, 5);
		expect(m[5]).toBeCloseTo(0, 5);
		expect(m[10]).toBeCloseTo(1, 5);
	});

	it("places cameras with their world transform + perspective params", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		const cam = scene.cameras[0];
		expect(cam.type).toBe("perspective");
		expect(cam.perspective.yfov).toBeCloseTo(0.5, 5);
		expect(cam.world[14]).toBeCloseTo(10, 5); // translate z = 10
	});

	it("computes world-space scene bounds across all mesh nodes", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		const { min, max } = scene.bounds;
		// node0 verts: (2,3,4)(4,3,4)(2,5,4); node2 verts: (0,0,0)(0,1,0)(-1,0,0)
		expect(min[0]).toBeCloseTo(-1, 5);
		expect(min[1]).toBeCloseTo(0, 5);
		expect(min[2]).toBeCloseTo(0, 5);
		expect(max[0]).toBeCloseTo(4, 5);
		expect(max[1]).toBeCloseTo(5, 5);
		expect(max[2]).toBeCloseTo(4, 5);
	});

	it("decodes a base64 data: URI buffer (non-GLB .gltf path)", async () => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2]);
		const bin = concatBin(positions, indices);
		let s = "";
		for (let i = 0; i < bin.length; i++) {
			s += String.fromCharCode(bin[i]);
		}
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
				{
					buffer: 0,
					byteOffset: positions.byteLength,
					byteLength: indices.byteLength,
				},
			],
			buffers: [
				{
					byteLength: bin.length,
					uri: `data:application/octet-stream;base64,${btoa(s)}`,
				},
			],
		};
		const ab = new TextEncoder().encode(JSON.stringify(json)).buffer;
		const scene = await parseGLTF(ab);
		expect(Array.from(scene.nodes[0].vertices)).toEqual([
			0, 0, 0, 1, 0, 0, 0, 1, 0,
		]);
	});
});

// ── Adversarial / malformed-input robustness ─────────────────────────────────
// A malformed asset must degrade gracefully (empty-but-valid descriptor or a
// clear thrown error) — never crash the engine or silently render nothing.

describe("parseGLTF() robustness", () => {
	it("synthesizes a sequential index buffer for non-indexed primitives", async () => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], // no indices
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
			],
			buffers: [{ byteLength: positions.byteLength }],
		};
		const scene = await parseGLTF(
			packGLB(json, new Uint8Array(positions.buffer)),
		);
		// drawArrays-style geometry must still be drawable
		expect(Array.from(scene.nodes[0].indices)).toEqual([0, 1, 2]);
	});

	it("returns finite, degenerate bounds for a scene with no geometry", async () => {
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [] }],
			nodes: [],
		};
		const scene = await parseGLTF(packGLB(json, new Uint8Array(0)));
		expect(scene.nodes).toHaveLength(0);
		expect(scene.bounds.min).toEqual([0, 0, 0]);
		expect(scene.bounds.max).toEqual([0, 0, 0]);
	});

	it("degrades to an empty descriptor when the scenes array is missing", async () => {
		const json = { asset: { version: "2.0" }, nodes: [] };
		const scene = await parseGLTF(packGLB(json, new Uint8Array(0)));
		expect(scene.nodes).toHaveLength(0);
		expect(scene.cameras).toHaveLength(0);
	});

	it("does not stack-overflow on a cyclic node graph", async () => {
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ children: [1] }, { children: [0] }], // 0 → 1 → 0 cycle
		};
		// must complete (each node visited at most once), not recurse forever
		const scene = await parseGLTF(packGLB(json, new Uint8Array(0)));
		expect(scene.nodes).toHaveLength(0);
	});

	it("throws a clear error on an unsupported accessor componentType", async () => {
		const positions = new Float32Array([0, 0, 0]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
			accessors: [
				{ bufferView: 0, componentType: 9999, count: 1, type: "VEC3" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
			],
			buffers: [{ byteLength: positions.byteLength }],
		};
		await expect(
			parseGLTF(packGLB(json, new Uint8Array(positions.buffer))),
		).rejects.toThrow(/unsupported accessor/);
	});

	it("ADVERSARIAL: a primitive referencing a material with no `materials` array degrades to defaults (no throw)", async () => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			// prim.material points at an entry, but `materials` is absent entirely
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
			],
			buffers: [{ byteLength: positions.byteLength }],
		};
		const scene = await parseGLTF(
			packGLB(json, new Uint8Array(positions.buffer)),
		);
		const node = scene.nodes[0];
		// material helpers fall back gracefully rather than throwing on the
		// missing `materials` array
		expect(node.image).toBeNull();
		expect(node.baseColorFactor).toEqual([1, 1, 1, 1]);
		expect(node.textureRepeat).toBe("repeat");
		expect(node.doubleSided).toBe(false);
	});
});

// ── Normals & lights ─────────────────────────────────────────────────────────

// concat any number of TypedArrays into one bin blob, returning byte offsets
function packParts(parts) {
	const u8s = parts.map((p) => {
		return new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
	});
	const total = u8s.reduce((n, u) => {
		return n + u.length;
	}, 0);
	const bin = new Uint8Array(total);
	const offsets = [];
	let off = 0;
	for (const u of u8s) {
		offsets.push(off);
		bin.set(u, off);
		off += u.length;
	}
	return { bin, offsets };
}

describe("parseGLTF() — normals", () => {
	it("reads the NORMAL accessor", async () => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, normals, indices]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [
				{
					primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }],
				},
			],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{ buffer: 0, byteOffset: offsets[1], byteLength: normals.byteLength },
				{ buffer: 0, byteOffset: offsets[2], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		const scene = await parseGLTF(packGLB(json, bin));
		expect(Array.from(scene.nodes[0].normals)).toEqual([
			0, 0, 1, 0, 0, 1, 0, 0, 1,
		]);
	});

	it("synthesizes unit flat normals when NORMAL is absent", async () => {
		// a triangle in the XY plane → face normal along ±Z, unit length
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, indices]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{ buffer: 0, byteOffset: offsets[1], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		const scene = await parseGLTF(packGLB(json, bin));
		const n = scene.nodes[0].normals;
		expect(n.length).toBe(9);
		for (let i = 0; i < 9; i += 3) {
			expect(Math.hypot(n[i], n[i + 1], n[i + 2])).toBeCloseTo(1, 5);
			expect(Math.abs(n[i + 2])).toBeCloseTo(1, 5); // ±Z
		}
	});
});

describe("parseGLTF() — KHR_lights_punctual", () => {
	// a single-triangle mesh node + one light node referencing `lightExt`
	function buildLightGLB(lightDef, lightNode) {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, indices]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0, 1] }],
			extensionsUsed: ["KHR_lights_punctual"],
			extensions: { KHR_lights_punctual: { lights: [lightDef] } },
			nodes: [{ mesh: 0 }, lightNode],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{ buffer: 0, byteOffset: offsets[1], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		return packGLB(json, bin);
	}

	it("parses a directional light (identity node → -Z world direction)", async () => {
		const scene = await parseGLTF(
			buildLightGLB(
				{
					type: "directional",
					color: [1, 0.5, 0.25],
					intensity: 1000,
					name: "Sun",
				},
				{ extensions: { KHR_lights_punctual: { light: 0 } } },
			),
		);
		expect(scene.lights).toHaveLength(1);
		const L = scene.lights[0];
		expect(L.type).toBe("directional");
		expect(L.color).toEqual([1, 0.5, 0.25]);
		expect(L.intensity).toBe(1000);
		expect(L.name).toBe("Sun");
		// glTF directional lights point down the node's local -Z; identity node
		// → world direction (0, 0, -1)
		expect(L.direction[0]).toBeCloseTo(0, 5);
		expect(L.direction[1]).toBeCloseTo(0, 5);
		expect(L.direction[2]).toBeCloseTo(-1, 5);
	});

	it("direction follows the light node's rotation (90° about X)", async () => {
		const r = Math.SQRT1_2; // 90° about X: (r, 0, 0, r)
		const scene = await parseGLTF(
			buildLightGLB(
				{ type: "directional", intensity: 1 },
				{
					rotation: [r, 0, 0, r],
					extensions: { KHR_lights_punctual: { light: 0 } },
				},
			),
		);
		// rotating local -Z (0,0,-1) by +90° about X → (0, 1, 0)
		const L = scene.lights[0];
		expect(L.direction[0]).toBeCloseTo(0, 5);
		expect(L.direction[1]).toBeCloseTo(1, 5);
		expect(L.direction[2]).toBeCloseTo(0, 5);
	});

	it("parses a point light with its world position; defaults color to white", async () => {
		const scene = await parseGLTF(
			buildLightGLB(
				{ type: "point", intensity: 5 },
				{
					translation: [3, 4, 5],
					extensions: { KHR_lights_punctual: { light: 0 } },
				},
			),
		);
		const L = scene.lights[0];
		expect(L.type).toBe("point");
		expect(L.color).toEqual([1, 1, 1]); // default
		expect(L.position).toEqual([3, 4, 5]);
	});

	it("scenes without the extension have an empty lights array", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.lights).toEqual([]);
	});
});

// ── Materials: baseColorFactor + vertex colors (COLOR_0) ──────────────────────

describe("parseGLTF() — baseColorFactor & vertex colors", () => {
	// unpack a packed-ARGB Uint32 into named channels for readable assertions
	const argb = (u32) => {
		return {
			a: (u32 >>> 24) & 0xff,
			r: (u32 >>> 16) & 0xff,
			g: (u32 >>> 8) & 0xff,
			b: u32 & 0xff,
		};
	};

	// single triangle with an optional material baseColorFactor
	function buildFactorGLB(baseColorFactor) {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, indices]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			materials: [{ pbrMetallicRoughness: { baseColorFactor } }],
			meshes: [
				{
					primitives: [
						{ attributes: { POSITION: 0 }, indices: 1, material: 0 },
					],
				},
			],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{ buffer: 0, byteOffset: offsets[1], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		return packGLB(json, bin);
	}

	// single triangle with a COLOR_0 attribute of the given typed array
	// (componentType inferred: Float32 → float, Uint8 → ubyte, Uint16 → ushort)
	function buildColorGLB(colorTyped, numComp) {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, colorTyped, indices]);
		const ct =
			colorTyped instanceof Float32Array
				? 5126
				: colorTyped instanceof Uint8Array
					? 5121
					: 5123;
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [{ mesh: 0 }],
			meshes: [
				{
					primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, indices: 2 }],
				},
			],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{
					bufferView: 1,
					componentType: ct,
					count: 3,
					type: numComp === 4 ? "VEC4" : "VEC3",
					normalized: ct !== 5126,
				},
				{ bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{
					buffer: 0,
					byteOffset: offsets[1],
					byteLength: colorTyped.byteLength,
				},
				{ buffer: 0, byteOffset: offsets[2], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		return packGLB(json, bin);
	}

	it("reads baseColorFactor from the material", async () => {
		const scene = await parseGLTF(buildFactorGLB([1, 0, 0, 1]));
		expect(scene.nodes[0].baseColorFactor).toEqual([1, 0, 0, 1]);
	});

	it("defaults baseColorFactor to opaque white when the material has none", async () => {
		// buildSceneGLB has no materials at all
		expect((await parseGLTF(buildSceneGLB())).nodes[0].baseColorFactor).toEqual(
			[1, 1, 1, 1],
		);
	});

	it("reads COLOR_0 (float VEC4) into packed ARGB", async () => {
		const scene = await parseGLTF(
			buildColorGLB(
				new Float32Array([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0.5]),
				4,
			),
		);
		const c = scene.nodes[0].colors;
		expect(c).toBeInstanceOf(Uint32Array);
		expect(argb(c[0])).toEqual({ a: 255, r: 255, g: 0, b: 0 });
		expect(argb(c[1])).toEqual({ a: 255, r: 0, g: 255, b: 0 });
		expect(argb(c[2])).toEqual({ a: 128, r: 0, g: 0, b: 255 }); // 0.5→128
	});

	it("ADVERSARIAL: normalizes a COLOR_0 UNSIGNED_BYTE encoding", async () => {
		const scene = await parseGLTF(
			buildColorGLB(
				new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
				4,
			),
		);
		expect(argb(scene.nodes[0].colors[1])).toEqual({
			a: 255,
			r: 0,
			g: 255,
			b: 0,
		});
	});

	it("ADVERSARIAL: defaults COLOR_0 alpha to 255 for a VEC3 (no alpha channel)", async () => {
		const scene = await parseGLTF(
			buildColorGLB(new Float32Array([1, 1, 1, 0, 0, 0, 0.5, 0.5, 0.5]), 3),
		);
		expect(argb(scene.nodes[0].colors[0]).a).toBe(255);
		expect(argb(scene.nodes[0].colors[2])).toEqual({
			a: 255,
			r: 128,
			g: 128,
			b: 128,
		});
	});

	it("leaves colors undefined when COLOR_0 is absent", async () => {
		expect((await parseGLTF(buildSceneGLB())).nodes[0].colors).toBeUndefined();
	});

	// GLTFScene application
	const NAME = "__gltf_mat_apply";
	const COLOR_NAME = "__gltf_color_apply";
	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		gltfList[NAME] = await parseGLTF(buildFactorGLB([1, 0, 0, 1]));
		gltfList[COLOR_NAME] = await parseGLTF(
			buildColorGLB(new Float32Array([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]), 4),
		);
	});
	afterAll(() => {
		delete gltfList[NAME];
		delete gltfList[COLOR_NAME];
	});

	const fakeContainer = () => {
		return {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
	};

	it("GLTFScene applies baseColorFactor as the mesh tint", () => {
		const container = fakeContainer();
		new GLTFScene(NAME).addTo(container, { scale: 1 });
		const m = container.kids[0];
		expect(m.tint.r).toBe(255);
		expect(m.tint.g).toBe(0);
		expect(m.tint.b).toBe(0);
	});

	it("GLTFScene sets mesh.vertexColors from COLOR_0", () => {
		const container = fakeContainer();
		new GLTFScene(COLOR_NAME).addTo(container, { scale: 1 });
		const m = container.kids[0];
		expect(m.vertexColors).toBeInstanceOf(Uint32Array);
		expect(argb(m.vertexColors[0])).toEqual({ a: 255, r: 255, g: 0, b: 0 });
	});
});

// ── Loader integration (cache / getter / unload) ─────────────────────────────

describe("glTF loader integration", () => {
	const NAME = "__gltf_test_scene";

	beforeAll(async () => {
		gltfList[NAME] = await parseGLTF(buildSceneGLB());
	});

	afterAll(() => {
		delete gltfList[NAME];
	});

	it("getGLTF returns the parsed descriptor, or null when missing", () => {
		const scene = loader.getGLTF(NAME);
		expect(scene).toBe(gltfList[NAME]);
		expect(scene.nodes).toHaveLength(2);
		expect(loader.getGLTF("does-not-exist")).toBeNull();
	});

	it("registers with the level director under gltf/glb formats", () => {
		expect(level.add("glb", NAME)).toBe(true);
		// idempotent — a second add for the same id is a no-op
		expect(level.add("glb", NAME)).toBe(false);
	});

	it("unload removes a glb (and gltf) entry from the cache", async () => {
		const tmp = "__gltf_unload_tmp";
		gltfList[tmp] = await parseGLTF(buildSceneGLB());
		expect(loader.unload({ name: tmp, type: "glb" })).toBe(true);
		expect(tmp in gltfList).toBe(false);
		// unloading a missing entry returns false rather than throwing
		expect(loader.unload({ name: tmp, type: "gltf" })).toBe(false);
	});
});

// ── GLTFScene descriptor wrapper ─────────────────────────────────────────────

describe("GLTFScene", () => {
	const NAME = "__gltf_scene_meta";

	beforeAll(async () => {
		gltfList[NAME] = await parseGLTF(buildSceneGLB());
	});

	afterAll(() => {
		delete gltfList[NAME];
	});

	it("exposes name, format, bounds and cameras from the descriptor", () => {
		const scene = new GLTFScene(NAME);
		expect(scene.name).toBe(NAME);
		expect(scene.format).toBe("gltf");
		expect(scene.bounds.max[1]).toBeCloseTo(5, 5);
		expect(scene.cameras).toHaveLength(1);
	});
});

// ── glTF → Mesh instantiation (needs a renderer for the texture cache) ────────

describe("GLTFScene → Mesh instantiation", () => {
	const NAME = "__gltf_addto_scene";

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		gltfList[NAME] = await parseGLTF(buildSceneGLB());
	});

	afterAll(() => {
		delete gltfList[NAME];
	});

	it("instantiates one Mesh per mesh node into the container", () => {
		const scene = new GLTFScene(NAME);
		const container = {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
		scene.addTo(container, { scale: 10 });

		// scene meshes carry their own depth — container must not reassign it
		expect(container.autoDepth).toBe(false);
		expect(container.kids).toHaveLength(2);

		const mesh = container.kids[0];
		expect(mesh).toBeInstanceOf(Mesh);
		// rightHanded defaults on for glTF scenes (no mirror)
		expect(mesh.rightHanded).toBe(true);
		// the pixels-per-unit scale rides on meshScale, freeing width/height
		// to describe the world-space bounds for frustum culling
		expect(mesh.meshScale).toBe(10);
		// node0's rotation/scale is preserved (scale 2) ...
		expect(mesh.currentTransform.val[0]).toBeCloseTo(2, 5);
		// ... but its translation is moved out to pos/depth so culling sees
		// the mesh at its true world center (regression: all-at-origin cull)
		expect(mesh.currentTransform.val[12]).toBe(0);
		expect(mesh.pos.x).toBeCloseTo(20, 5); // 2 (tx) * scale 10
		expect(mesh.pos.y).toBeCloseTo(-30, 5); // -3 (ty) * scale 10
		expect(mesh.depth).toBeCloseTo(-40, 5); // -4 (tz) * scale 10 (rightHanded)
	});

	it("renders a vertex at the independently-computed world position (end-to-end)", () => {
		// THE positioning check through the real loader path: node0 has
		// translation (2,3,4) + scale 2; local vertex 1 is (1,0,0). World =
		// scale·v + translation = (2·1+2, 3, 4) = (4,3,4). With sceneScale 10
		// and the rightHanded Y/Z negate, render = (4, -3, -4)·10 =
		// (40, -30, -40). Computed here without any parser/loader code.
		const scene = new GLTFScene(NAME);
		const container = {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
		scene.addTo(container, { scale: 10 });
		const mesh = container.kids[0];
		mesh._projectVerticesWorld(mesh.pos.x, mesh.pos.y, mesh.depth);
		// vertex index 1 → components at offset 3,4,5
		expect(mesh.vertices[3]).toBeCloseTo(40, 4); // x
		expect(mesh.vertices[4]).toBeCloseTo(-30, 4); // y (Y-down)
		expect(mesh.vertices[5]).toBeCloseTo(-40, 4); // z (+Z forward, negated)
	});

	it("gives each mesh node a distinct world position (frustum-cull regression)", () => {
		// Regression: scene meshes used to keep pos (0,0,0) and hide all
		// placement in currentTransform, so every mesh shared one cull point
		// at the origin and the whole scene popped in/out together.
		const scene = new GLTFScene(NAME);
		const container = {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
		scene.addTo(container, { scale: 10 });
		const [a, b] = container.kids;
		// node0 is translated (2,3,4); node2 is rotation-only at the origin
		expect(a.pos.x).not.toBe(b.pos.x);
		expect(b.pos.x).toBeCloseTo(0, 5);
		expect(b.pos.y).toBeCloseTo(0, 5);
		// a positive bounding radius so the mesh isn't culled to a point
		expect(a.getBounds().width).toBeGreaterThan(0);
	});

	it("propagates a MASK material's alpha cutout to the instantiated Mesh", async () => {
		const CUTOUT = "__gltf_cutout_scene";
		gltfList[CUTOUT] = await parseGLTF(
			buildMaterialGLB({ alphaMode: "MASK", alphaCutoff: 0.3 }),
		);
		const scene = new GLTFScene(CUTOUT);
		const container = {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
		scene.addTo(container);
		// the cutout threshold rides from material → parser → Mesh
		expect(container.kids[0].alphaCutoff).toBe(0.3);
		delete gltfList[CUTOUT];
	});

	it("keeps raw geometry untouched when normalize is disabled", () => {
		// glTF nodes share one coordinate space, so addTo passes
		// normalize:false — the raw vertices must survive verbatim
		const scene = new GLTFScene(NAME);
		const container = {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
		scene.addTo(container);
		expect(Array.from(container.kids[0].originalVertices)).toEqual([
			0, 0, 0, 1, 0, 0, 0, 1, 0,
		]);
	});

	it("rightHanded negates Z in the world-space projection (no mirror)", () => {
		const lh = new Mesh(0, 0, {
			vertices: new Float32Array([0, 0, 0.5]),
			uvs: new Float32Array([0, 0]),
			indices: new Uint16Array([0, 0, 0]),
			width: 10,
			normalize: false,
		});
		const rh = new Mesh(0, 0, {
			vertices: new Float32Array([0, 0, 0.5]),
			uvs: new Float32Array([0, 0]),
			indices: new Uint16Array([0, 0, 0]),
			width: 10,
			normalize: false,
			rightHanded: true,
		});
		lh._projectVerticesWorld(0, 0, 0);
		rh._projectVerticesWorld(0, 0, 0);
		// left-handed (default reflection) keeps +Z, right-handed flips it
		expect(lh.vertices[2]).toBeCloseTo(5, 5);
		expect(rh.vertices[2]).toBeCloseTo(-5, 5);
	});

	it("rightHanded meshes keep the original winding under Camera3d", () => {
		const rh = new Mesh(0, 0, {
			vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			uvs: new Float32Array([0, 0, 0, 0, 0, 0]),
			indices: new Uint16Array([0, 1, 2]),
			width: 10,
			normalize: false,
			rightHanded: true,
		});
		rh._useWorldSpace = true; // simulate activation under Camera3d
		rh.draw({ drawMesh() {} });
		// rotation bridge preserves winding → no reversed-index swap
		expect(rh.indices).toBe(rh._indicesOriginal);
	});
});

// ── GLTFScene → lighting ─────────────────────────────────────────────────────

describe("GLTFScene → lighting (KHR_lights_punctual)", () => {
	const NAME = "__gltf_lit_scene";

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, normals, indices]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0, 1] }],
			extensionsUsed: ["KHR_lights_punctual"],
			extensions: {
				KHR_lights_punctual: {
					lights: [{ type: "directional", color: [1, 1, 1], intensity: 1000 }],
				},
			},
			nodes: [
				{ mesh: 0 },
				{ extensions: { KHR_lights_punctual: { light: 0 } } },
			],
			meshes: [
				{
					primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }],
				},
			],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{ buffer: 0, byteOffset: offsets[1], byteLength: normals.byteLength },
				{ buffer: 0, byteOffset: offsets[2], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		gltfList[NAME] = await parseGLTF(packGLB(json, bin));
	});

	afterAll(() => {
		delete gltfList[NAME];
	});

	const fakeContainer = () => {
		return {
			autoDepth: true,
			kids: [],
			addChild(c) {
				this.kids.push(c);
			},
		};
	};
	const lightsOf = (c) => {
		return c.kids.filter((k) => {
			return k instanceof Light3d;
		});
	};

	it("adds the authored directional light (+ ambient fill) as world children + flags meshes lit", () => {
		const scene = new GLTFScene(NAME);
		const container = fakeContainer();
		scene.addTo(container, { scale: 10 });

		// lights are ordinary Light3d renderables added to the world (the level
		// director's container.reset() removes them on the next load — same
		// lifecycle as Light2d, so the scene tracks nothing)
		const lights = lightsOf(container);
		const directional = lights.filter((l) => {
			return l.type === "directional";
		});
		const ambient = lights.filter((l) => {
			return l.type === "ambient";
		});
		expect(directional).toHaveLength(1);
		expect(ambient).toHaveLength(1); // soft ambient fill
		expect(container.kids[0].lit).toBe(true);
		// glTF dir (0,0,-1) → render space [x, -y, zSign·z] (zSign=-1) → (0,0,1)
		expect(directional[0].direction.z).toBeCloseTo(1, 5);
	});

	it("options.lights:false leaves meshes unlit and adds no lights", () => {
		const scene = new GLTFScene(NAME);
		const container = fakeContainer();
		scene.addTo(container, { scale: 10, lights: false });
		expect(lightsOf(container)).toHaveLength(0);
		expect(container.kids[0].lit).toBe(false);
	});

	it("KHR_materials_unlit: an unlit-material mesh stays unlit even in a lit scene", async () => {
		// a lit scene (directional light) whose single mesh uses an unlit material
		const UNLIT = "__gltf_unlit_in_lit";
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
		const indices = new Uint16Array([0, 1, 2]);
		const { bin, offsets } = packParts([positions, normals, indices]);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0, 1] }],
			extensionsUsed: ["KHR_lights_punctual", "KHR_materials_unlit"],
			extensions: {
				KHR_lights_punctual: {
					lights: [{ type: "directional", color: [1, 1, 1], intensity: 1000 }],
				},
			},
			nodes: [
				{ mesh: 0 },
				{ extensions: { KHR_lights_punctual: { light: 0 } } },
			],
			materials: [{ extensions: { KHR_materials_unlit: {} } }],
			meshes: [
				{
					primitives: [
						{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 },
					],
				},
			],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
				{ buffer: 0, byteOffset: offsets[1], byteLength: normals.byteLength },
				{ buffer: 0, byteOffset: offsets[2], byteLength: indices.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		gltfList[UNLIT] = await parseGLTF(packGLB(json, bin));

		const container = fakeContainer();
		new GLTFScene(UNLIT).addTo(container, { scale: 10 });
		// the scene IS lit (directional light added)…
		expect(lightsOf(container).length).toBeGreaterThan(0);
		// …but the unlit material opts this mesh out of the lit path
		expect(container.kids[0].lit).toBe(false);

		delete gltfList[UNLIT];
	});
});

// ── ADVERSARIAL: matrix multiply (node hierarchy) ────────────────────────────

describe("multiplyMatrix() — column-major 4x4", () => {
	const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
	const translate = (x, y, z) => {
		return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
	};
	const scale = (s) => {
		return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
	};

	it("identity is the multiplicative unit", () => {
		const m = translate(3, 4, 5);
		expect(multiplyMatrix(I, m)).toEqual(m);
		expect(multiplyMatrix(m, I)).toEqual(m);
	});

	it("composes two translations additively (parent * local)", () => {
		const c = multiplyMatrix(translate(10, 20, 30), translate(1, 2, 3));
		expect(applyMat(c, [0, 0, 0])).toEqual([11, 22, 33]);
	});

	it("parent scale scales the child's translation (parent * local)", () => {
		// parent=scale2, local=translate(3,0,0): a child at its own origin lands
		// at parent_scale * child_translation = (6,0,0). Catches a reversed
		// multiply order (local*parent would give 3, not 6).
		const c = multiplyMatrix(scale(2), translate(3, 0, 0));
		expect(applyMat(c, [0, 0, 0])).toEqual([6, 0, 0]);
	});

	it("is non-commutative (rotate∘translate ≠ translate∘rotate)", () => {
		const rotZ90 = nodeLocalMatrix({
			rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
		});
		const t = translate(2, 0, 0);
		const a = applyMat(multiplyMatrix(rotZ90, t), [0, 0, 0]); // translate then rotate
		const b = applyMat(multiplyMatrix(t, rotZ90), [0, 0, 0]); // rotate then translate
		// rotZ90 * t : (2,0,0) rotated 90° about Z → (0,2,0)
		expect(a[0]).toBeCloseTo(0, 5);
		expect(a[1]).toBeCloseTo(2, 5);
		// t * rotZ90 : origin rotated is origin, then translated → (2,0,0)
		expect(b[0]).toBeCloseTo(2, 5);
		expect(b[1]).toBeCloseTo(0, 5);
	});

	it("matches a hand-computed product of two rotations", () => {
		const rz = nodeLocalMatrix({
			rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
		}); // 90° Z
		// rz * rz = 180° about Z: (1,0,0) → (-1,0,0)
		const c = multiplyMatrix(rz, rz);
		const r = applyMat(c, [1, 0, 0]);
		expect(r[0]).toBeCloseTo(-1, 5);
		expect(r[1]).toBeCloseTo(0, 5);
	});
});

// ── ADVERSARIAL: TRS → matrix ────────────────────────────────────────────────

describe("nodeLocalMatrix() — TRS composition", () => {
	it("pure translation fills the 4th column only", () => {
		const m = nodeLocalMatrix({ translation: [7, 8, 9] });
		expect(applyMat(m, [0, 0, 0])).toEqual([7, 8, 9]);
		expect(applyMat(m, [1, 1, 1])).toEqual([8, 9, 10]);
	});

	it("pure scale scales each axis", () => {
		const m = nodeLocalMatrix({ scale: [2, 3, 4] });
		expect(applyMat(m, [1, 1, 1])).toEqual([2, 3, 4]);
	});

	it("90° rotation about X maps +Y → +Z", () => {
		const m = nodeLocalMatrix({ rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] });
		const r = applyMat(m, [0, 1, 0]);
		expect(r[0]).toBeCloseTo(0, 5);
		expect(r[1]).toBeCloseTo(0, 5);
		expect(r[2]).toBeCloseTo(1, 5);
	});

	it("90° rotation about Y maps +X → −Z", () => {
		const m = nodeLocalMatrix({ rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] });
		const r = applyMat(m, [1, 0, 0]);
		expect(r[0]).toBeCloseTo(0, 5);
		expect(r[1]).toBeCloseTo(0, 5);
		expect(r[2]).toBeCloseTo(-1, 5);
	});

	it("90° rotation about Z maps +X → +Y", () => {
		const m = nodeLocalMatrix({ rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] });
		const r = applyMat(m, [1, 0, 0]);
		expect(r[0]).toBeCloseTo(0, 5);
		expect(r[1]).toBeCloseTo(1, 5);
	});

	it("applies TRS in the correct order: world = T + R·S·v", () => {
		// scale 2, rotate 90° about Z, translate (10,0,0). For v=(1,0,0):
		// S→(2,0,0); R→(0,2,0); T→(10,2,0)
		const m = nodeLocalMatrix({
			translation: [10, 0, 0],
			rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
			scale: [2, 2, 2],
		});
		const r = applyMat(m, [1, 0, 0]);
		expect(r[0]).toBeCloseTo(10, 5);
		expect(r[1]).toBeCloseTo(2, 5);
		expect(r[2]).toBeCloseTo(0, 5);
	});

	it("honors an explicit matrix override", () => {
		const m = nodeLocalMatrix({
			matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1],
		});
		expect(applyMat(m, [0, 0, 0])).toEqual([5, 6, 7]);
	});

	it("supports negative scale (mirror)", () => {
		const m = nodeLocalMatrix({ scale: [-1, 1, 1] });
		expect(applyMat(m, [1, 0, 0])).toEqual([-1, 0, 0]);
	});
});

// ── ADVERSARIAL: accessor reading (stride / offset / interleave) ──────────────

describe("readAccessor() — stride & offset", () => {
	it("reads interleaved attributes via byteStride", () => {
		// two VEC3s interleaved (POSITION, NORMAL) at stride 24; read POSITION
		const f = new Float32Array([
			1,
			2,
			3,
			/*normal*/ 9,
			9,
			9, //
			4,
			5,
			6,
			/*normal*/ 8,
			8,
			8,
		]);
		const json = {
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 2, type: "VEC3" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteStride: 24, byteLength: f.byteLength },
			],
		};
		const out = readAccessor(json, [new Uint8Array(f.buffer)], 0);
		expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("honors accessor.byteOffset (second accessor in one bufferView)", () => {
		const f = new Float32Array([1, 1, 1, 2, 2, 2, 3, 3, 3]);
		const json = {
			accessors: [
				{
					bufferView: 0,
					byteOffset: 12,
					componentType: 5126,
					count: 2,
					type: "VEC3",
				},
			],
			bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: f.byteLength }],
		};
		const out = readAccessor(json, [new Uint8Array(f.buffer)], 0);
		// skip the first VEC3 (12 bytes) → reads (2,2,2),(3,3,3)
		expect(Array.from(out)).toEqual([2, 2, 2, 3, 3, 3]);
	});

	it("honors bufferView.byteOffset", () => {
		const f = new Float32Array([0, 0, 0, 7, 8, 9]);
		const json = {
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 1, type: "VEC3" },
			],
			bufferViews: [{ buffer: 0, byteOffset: 12, byteLength: 12 }],
		};
		const out = readAccessor(json, [new Uint8Array(f.buffer)], 0);
		expect(Array.from(out)).toEqual([7, 8, 9]);
	});

	it("H4: throws a clear error for an accessor with no bufferView (sparse/zero-init)", () => {
		const json = {
			// no bufferView → sparse-only / zero-initialized accessor (out of scope)
			accessors: [{ componentType: 5126, count: 1, type: "VEC3" }],
			bufferViews: [],
		};
		expect(() => {
			return readAccessor(json, [], 0);
		}).toThrow(/no bufferView/);
	});

	it("H4: still reports unsupported componentType/type before the bufferView check", () => {
		const json = {
			accessors: [
				{ bufferView: 0, componentType: 9999, count: 1, type: "VEC3" },
			],
			bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 12 }],
		};
		expect(() => {
			return readAccessor(json, [new Uint8Array(12)], 0);
		}).toThrow(/unsupported accessor/);
	});
});

// ── ADVERSARIAL: full parse with a non-identity parent (hierarchy) ────────────

describe("parseGLTF() — node hierarchy accumulation", () => {
	function packGLB(json, binU8) {
		const jb = new TextEncoder().encode(JSON.stringify(json));
		const jp = (4 - (jb.length % 4)) % 4;
		const bp = (4 - (binU8.length % 4)) % 4;
		const total = 12 + 8 + jb.length + jp + 8 + binU8.length + bp;
		const ab = new ArrayBuffer(total);
		const dv = new DataView(ab);
		const u8 = new Uint8Array(ab);
		dv.setUint32(0, 0x46546c67, true);
		dv.setUint32(4, 2, true);
		dv.setUint32(8, total, true);
		let o = 12;
		dv.setUint32(o, jb.length + jp, true);
		o += 4;
		dv.setUint32(o, 0x4e4f534a, true);
		o += 4;
		u8.set(jb, o);
		o += jb.length;
		for (let i = 0; i < jp; i++) {
			u8[o++] = 0x20;
		}
		dv.setUint32(o, binU8.length + bp, true);
		o += 4;
		dv.setUint32(o, 0x004e4942, true);
		o += 4;
		u8.set(binU8, o);
		return ab;
	}

	it("applies a parent's translation+scale to a child mesh node", async () => {
		const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const idx = new Uint16Array([0, 1, 2]);
		const bin = new Uint8Array(pos.byteLength + idx.byteLength);
		bin.set(new Uint8Array(pos.buffer), 0);
		bin.set(new Uint8Array(idx.buffer), pos.byteLength);
		const json = {
			asset: { version: "2.0" },
			scene: 0,
			scenes: [{ nodes: [0] }],
			nodes: [
				// parent: scale 2, translate (10,0,0)
				{ children: [1], translation: [10, 0, 0], scale: [2, 2, 2] },
				// child mesh: translate (1,0,0) in the parent's (scaled) space
				{ mesh: 0, translation: [1, 0, 0] },
			],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
			accessors: [
				{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
				{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
			],
			bufferViews: [
				{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
				{ buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength },
			],
			buffers: [{ byteLength: bin.length }],
		};
		const scene = await parseGLTF(packGLB(json, bin));
		const w = scene.nodes[0].world;
		// child world translation = parent(scale2,trans10) applied to (1,0,0)
		// = 2*1 + 10 = 12  → and the parent scale (2) survives on the diagonal
		expect(applyMat(w, [0, 0, 0])).toEqual([12, 0, 0]);
		expect(w[0]).toBeCloseTo(2, 5); // composed scale x
		// a child vertex at local (1,0,0): 2*1 + 12 = 14
		expect(applyMat(w, [1, 0, 0])[0]).toBeCloseTo(14, 5);
	});
});

// ── node graph + animation parsing ──────────────────────────────────────────

// Build a GLB with a 2-node hierarchy (root → mesh child) and one "walk" clip
// animating the root's translation (LINEAR) and the child's rotation (STEP).
function buildAnimGLB() {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	const indices = new Uint16Array([0, 1, 2]);
	const times = new Float32Array([0, 0.5, 1]); // 3 keyframes, duration 1s
	const transValues = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0]); // VEC3 × 3
	// VEC4 × 3 quaternions (identity, 90°Z, 180°Z) — values are not asserted
	const r = Math.SQRT1_2;
	const rotValues = new Float32Array([0, 0, 0, 1, 0, 0, r, r, 0, 0, 1, 0]);
	const { bin, offsets } = packParts([
		positions,
		indices,
		times,
		transValues,
		rotValues,
	]);
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [
			{ name: "root", translation: [0, 0, 0], children: [1] },
			{ name: "child", mesh: 0, translation: [5, 0, 0] },
		],
		meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
		animations: [
			{
				name: "walk",
				channels: [
					{ sampler: 0, target: { node: 0, path: "translation" } },
					{ sampler: 1, target: { node: 1, path: "rotation" } },
					// a weights channel must be silently dropped (out of scope)
					{ sampler: 0, target: { node: 0, path: "weights" } },
				],
				samplers: [
					{ input: 2, output: 3, interpolation: "LINEAR" },
					{ input: 2, output: 4, interpolation: "STEP" },
				],
			},
		],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
			{ bufferView: 2, componentType: 5126, count: 3, type: "SCALAR" },
			{ bufferView: 3, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 4, componentType: 5126, count: 3, type: "VEC4" },
		],
		bufferViews: [
			{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
			{ buffer: 0, byteOffset: offsets[1], byteLength: indices.byteLength },
			{ buffer: 0, byteOffset: offsets[2], byteLength: times.byteLength },
			{ buffer: 0, byteOffset: offsets[3], byteLength: transValues.byteLength },
			{ buffer: 0, byteOffset: offsets[4], byteLength: rotValues.byteLength },
		],
		buffers: [{ byteLength: bin.length }],
	};
	return packGLB(json, bin);
}

describe("parseGLTF() — node graph", () => {
	it("emits the full hierarchy keyed by node index, with rest TRS + children", async () => {
		const scene = await parseGLTF(buildAnimGLB());
		expect(scene.graph.roots).toEqual([0]);
		const root = scene.graph.nodes[0];
		expect(root.name).toBe("root");
		expect(root.children).toEqual([1]);
		expect(root.translation).toEqual([0, 0, 0]);
		expect(root.rotation).toEqual([0, 0, 0, 1]); // default identity quat
		expect(root.scale).toEqual([1, 1, 1]); // default
		expect(root.primitives).toHaveLength(0); // empty transform node
	});

	it("attaches mesh primitives to their node in the graph", async () => {
		const scene = await parseGLTF(buildAnimGLB());
		const child = scene.graph.nodes[1];
		expect(child.name).toBe("child");
		expect(child.translation).toEqual([5, 0, 0]);
		expect(child.primitives).toHaveLength(1);
		expect(child.primitives[0].vertexCount).toBe(3);
	});

	it("graph primitives share the SAME typed arrays as the flat node list (single read)", async () => {
		const scene = await parseGLTF(buildAnimGLB());
		// flat meshNodes[0] is node 1's primitive; graph.nodes[1].primitives[0]
		// must reference the identical buffer (not a re-read copy)
		expect(scene.graph.nodes[1].primitives[0].vertices).toBe(
			scene.nodes[0].vertices,
		);
	});
});

describe("parseGLTF() — animations", () => {
	it("parses clips with name, duration, and per-channel keyframes", async () => {
		const scene = await parseGLTF(buildAnimGLB());
		expect(scene.animations).toHaveLength(1);
		const clip = scene.animations[0];
		expect(clip.name).toBe("walk");
		expect(clip.duration).toBeCloseTo(1, 6); // last keyframe time
	});

	it("resolves each channel's node, path, interpolation, stride + buffers", async () => {
		const { animations } = await parseGLTF(buildAnimGLB());
		const chans = animations[0].channels;
		const trans = chans.find((c) => {
			return c.path === "translation";
		});
		const rot = chans.find((c) => {
			return c.path === "rotation";
		});
		expect(trans.node).toBe(0);
		expect(trans.stride).toBe(3);
		expect(trans.interpolation).toBe("LINEAR");
		expect(Array.from(trans.times)).toEqual([0, 0.5, 1]);
		expect(Array.from(trans.values)).toEqual([0, 0, 0, 1, 0, 0, 2, 0, 0]);
		expect(rot.node).toBe(1);
		expect(rot.stride).toBe(4); // quaternion
		expect(rot.interpolation).toBe("STEP");
	});

	it("ADVERSARIAL: drops unsupported channel paths (weights / morph targets)", async () => {
		const { animations } = await parseGLTF(buildAnimGLB());
		// only translation + rotation survive; the `weights` channel is dropped
		expect(animations[0].channels).toHaveLength(2);
		expect(
			animations[0].channels.some((c) => {
				return c.path === "weights";
			}),
		).toBe(false);
	});

	it("ADVERSARIAL: a static asset reports an empty animations array (+ a graph)", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.animations).toEqual([]);
		// the graph is still emitted for every scene
		expect(Object.keys(scene.graph.nodes).length).toBeGreaterThan(0);
	});
});

// ── texture wrap (sampler wrapS / wrapT → melonJS repeat mode) ───────────────

// a 1×1 transparent PNG as a data URI — decodes in the browser test env so the
// material's baseColorTexture resolves to a real image
const PNG_1x1 =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

// Build a single textured triangle whose material's sampler uses the given
// wrap modes. `sampler` may be omitted entirely to exercise the glTF default.
function buildWrapGLB(sampler) {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
	const indices = new Uint16Array([0, 1, 2]);
	const { bin, offsets } = packParts([positions, uvs, indices]);
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0 }],
		meshes: [
			{
				primitives: [
					{
						attributes: { POSITION: 0, TEXCOORD_0: 1 },
						indices: 2,
						material: 0,
					},
				],
			},
		],
		materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
		textures: [
			sampler === undefined ? { source: 0 } : { source: 0, sampler: 0 },
		],
		samplers: sampler === undefined ? undefined : [sampler],
		images: [{ uri: PNG_1x1 }],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 1, componentType: 5126, count: 3, type: "VEC2" },
			{ bufferView: 2, componentType: 5123, count: 3, type: "SCALAR" },
		],
		bufferViews: [
			{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
			{ buffer: 0, byteOffset: offsets[1], byteLength: uvs.byteLength },
			{ buffer: 0, byteOffset: offsets[2], byteLength: indices.byteLength },
		],
		buffers: [{ byteLength: bin.length }],
	};
	return packGLB(json, bin);
}

describe("parseGLTF() — texture wrap mode", () => {
	const REPEAT = 10497;
	const CLAMP = 33071;

	it("defaults to REPEAT when no sampler is present (glTF spec default)", async () => {
		const scene = await parseGLTF(buildWrapGLB(undefined));
		expect(scene.nodes[0].textureRepeat).toBe("repeat");
	});

	it("REPEAT on both axes → 'repeat'", async () => {
		const scene = await parseGLTF(
			buildWrapGLB({ wrapS: REPEAT, wrapT: REPEAT }),
		);
		expect(scene.nodes[0].textureRepeat).toBe("repeat");
	});

	it("CLAMP on both axes → 'no-repeat'", async () => {
		const scene = await parseGLTF(buildWrapGLB({ wrapS: CLAMP, wrapT: CLAMP }));
		expect(scene.nodes[0].textureRepeat).toBe("no-repeat");
	});

	it("REPEAT-S / CLAMP-T → 'repeat-x'", async () => {
		const scene = await parseGLTF(
			buildWrapGLB({ wrapS: REPEAT, wrapT: CLAMP }),
		);
		expect(scene.nodes[0].textureRepeat).toBe("repeat-x");
	});

	it("CLAMP-S / REPEAT-T → 'repeat-y'", async () => {
		const scene = await parseGLTF(
			buildWrapGLB({ wrapS: CLAMP, wrapT: REPEAT }),
		);
		expect(scene.nodes[0].textureRepeat).toBe("repeat-y");
	});

	it("ADVERSARIAL: a sampler that omits wrapS/wrapT defaults each to REPEAT", async () => {
		const scene = await parseGLTF(buildWrapGLB({})); // empty sampler
		expect(scene.nodes[0].textureRepeat).toBe("repeat");
	});

	it("ADVERSARIAL: MIRRORED_REPEAT (no melonJS equivalent) maps to plain repeat", async () => {
		const scene = await parseGLTF(buildWrapGLB({ wrapS: 33648, wrapT: 33648 }));
		expect(scene.nodes[0].textureRepeat).toBe("repeat");
	});

	it("ADVERSARIAL: an untextured material still defaults to 'repeat'", async () => {
		// buildSceneGLB's mesh nodes have no material at all
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.nodes[0].textureRepeat).toBe("repeat");
	});
});

describe("parseGLTF() — texture magnification filter", () => {
	const NEAREST = 9728;
	const LINEAR = 9729;

	it("magFilter NEAREST → 'nearest' (crisp pixel-art)", async () => {
		const scene = await parseGLTF(buildWrapGLB({ magFilter: NEAREST }));
		expect(scene.nodes[0].textureFilter).toBe("nearest");
	});

	it("magFilter LINEAR → 'linear'", async () => {
		const scene = await parseGLTF(buildWrapGLB({ magFilter: LINEAR }));
		expect(scene.nodes[0].textureFilter).toBe("linear");
	});

	it("no sampler → undefined (keeps the engine's antiAlias default)", async () => {
		const scene = await parseGLTF(buildWrapGLB(undefined));
		expect(scene.nodes[0].textureFilter).toBeUndefined();
	});

	it("ADVERSARIAL: a sampler without magFilter → undefined (no override)", async () => {
		const scene = await parseGLTF(buildWrapGLB({ wrapS: 10497 }));
		expect(scene.nodes[0].textureFilter).toBeUndefined();
	});

	it("ADVERSARIAL: an untextured material → undefined", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.nodes[0].textureFilter).toBeUndefined();
	});
});

// ── material flags: KHR_materials_unlit ──────────────────────────────────────

// single textured-less triangle whose material carries the given extensions
function buildMaterialGLB(material) {
	const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
	const indices = new Uint16Array([0, 1, 2]);
	const { bin, offsets } = packParts([positions, indices]);
	const json = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [0] }],
		nodes: [{ mesh: 0 }],
		materials: [material],
		meshes: [
			{
				primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
			},
		],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
			{ bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
		],
		bufferViews: [
			{ buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength },
			{ buffer: 0, byteOffset: offsets[1], byteLength: indices.byteLength },
		],
		buffers: [{ byteLength: bin.length }],
	};
	return packGLB(json, bin);
}

describe("parseGLTF() — KHR_materials_unlit", () => {
	it("flags a material with the extension as unlit", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({ extensions: { KHR_materials_unlit: {} } }),
		);
		expect(scene.nodes[0].unlit).toBe(true);
	});

	it("a material without the extension is not unlit", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({
				pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] },
			}),
		);
		expect(scene.nodes[0].unlit).toBe(false);
	});

	it("ADVERSARIAL: a primitive with no material is not unlit", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.nodes[0].unlit).toBe(false);
	});
});

// ── material flags: alpha cutout (alphaMode MASK) ────────────────────────────

describe("parseGLTF() — alpha cutout (alphaMode MASK)", () => {
	it("MASK with an explicit alphaCutoff uses that threshold", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({ alphaMode: "MASK", alphaCutoff: 0.25 }),
		);
		expect(scene.nodes[0].alphaCutoff).toBe(0.25);
	});

	it("MASK without an alphaCutoff defaults to the spec 0.5", async () => {
		const scene = await parseGLTF(buildMaterialGLB({ alphaMode: "MASK" }));
		expect(scene.nodes[0].alphaCutoff).toBe(0.5);
	});

	it("OPAQUE (default) yields no cutout (0)", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({
				pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] },
			}),
		);
		expect(scene.nodes[0].alphaCutoff).toBe(0);
	});

	it("ADVERSARIAL: BLEND mode is not a cutout (0 — alphaCutoff ignored)", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({ alphaMode: "BLEND", alphaCutoff: 0.9 }),
		);
		expect(scene.nodes[0].alphaCutoff).toBe(0);
	});

	it("ADVERSARIAL: a primitive with no material has no cutout (0)", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.nodes[0].alphaCutoff).toBe(0);
	});
});

// ── material flags: emissive (emissiveFactor) ────────────────────────────────

describe("parseGLTF() — emissive", () => {
	it("reads emissiveFactor into the emissive color", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({ emissiveFactor: [1, 0.5, 0] }),
		);
		expect(Array.from(scene.nodes[0].emissive)).toEqual([1, 0.5, 0]);
	});

	it("KHR_materials_emissive_strength scales the factor (HDR glow)", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({
				emissiveFactor: [1, 0.5, 0],
				extensions: {
					KHR_materials_emissive_strength: { emissiveStrength: 3 },
				},
			}),
		);
		expect(Array.from(scene.nodes[0].emissive)).toEqual([3, 1.5, 0]);
	});

	it("a material with no emissiveFactor has no emissive (undefined)", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({
				pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] },
			}),
		);
		expect(scene.nodes[0].emissive).toBeUndefined();
	});

	it("ADVERSARIAL: an all-zero emissiveFactor collapses to no emissive (undefined)", async () => {
		const scene = await parseGLTF(
			buildMaterialGLB({ emissiveFactor: [0, 0, 0] }),
		);
		expect(scene.nodes[0].emissive).toBeUndefined();
	});

	it("ADVERSARIAL: a primitive with no material has no emissive (undefined)", async () => {
		const scene = await parseGLTF(buildSceneGLB());
		expect(scene.nodes[0].emissive).toBeUndefined();
	});

	it("ADVERSARIAL: a malformed (short) emissiveFactor never yields NaN", async () => {
		// a non-spec asset writing only 1 component must not produce a NaN that
		// would reach the uEmissive uniform (NaN !== 0 dodges the zero-collapse)
		const scene = await parseGLTF(buildMaterialGLB({ emissiveFactor: [1] }));
		const e = scene.nodes[0].emissive;
		expect(e).toEqual([1, 0, 0]);
		expect(e.some((c) => Number.isNaN(c))).toBe(false);
	});
});
