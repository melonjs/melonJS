import { describe, expect, it, vi } from "vitest";
import { Matrix3d, Vector3d } from "../src/index.js";
import { parseGLTF } from "../src/loader/parsers/gltf.js";
import {
	instanceAttributes,
	instanceRecordLayout,
	readInstanceTransform,
	writeInstanceTRS,
	writeInstanceTransform,
} from "../src/video/gpu/instancerecord.ts";

/**
 * `EXT_mesh_gpu_instancing` (#1508) — authored instancing.
 *
 * A glTF node may carry per-instance TRANSLATION / ROTATION / SCALE
 * accessors instead of being duplicated N times; it is what an exporter
 * writes for linked duplicates. Reading it turns a scattered forest into one
 * `InstancedMesh` with no user code.
 *
 * These build real glTF documents rather than mocking the reader, so the
 * accessor plumbing (byte offsets, component encodings, defaults) is
 * genuinely exercised.
 */
describe("EXT_mesh_gpu_instancing", () => {
	// a minimal single-triangle mesh plus whatever instance accessors the
	// test asks for, as one self-contained glTF document
	const buildDocument = (instanceAttributes, extra = {}) => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const chunks = [{ data: new Uint8Array(positions.buffer) }];
		const accessors = [
			{
				bufferView: 0,
				componentType: 5126,
				count: 3,
				type: "VEC3",
			},
		];
		const bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 36 }];
		let offset = 36;
		const attributes = {};
		for (const [name, spec] of Object.entries(instanceAttributes)) {
			const bytes = new Uint8Array(spec.array.buffer.slice(0));
			chunks.push({ data: bytes });
			bufferViews.push({
				buffer: 0,
				byteOffset: offset,
				byteLength: bytes.byteLength,
			});
			accessors.push({
				bufferView: bufferViews.length - 1,
				componentType: spec.componentType,
				count: spec.count,
				type: spec.type,
				normalized: spec.normalized,
			});
			attributes[name] = accessors.length - 1;
			offset += bytes.byteLength;
		}

		const total = chunks.reduce((sum, c) => {
			return sum + c.data.byteLength;
		}, 0);
		const merged = new Uint8Array(total);
		let at = 0;
		for (const chunk of chunks) {
			merged.set(chunk.data, at);
			at += chunk.data.byteLength;
		}

		// a real .gltf document with the binary embedded as a data URI, so
		// parseGLTF runs its whole path (buffer resolution, bufferViews,
		// accessor strides) rather than a mocked shortcut
		let binary = "";
		for (const byte of merged) {
			binary += String.fromCharCode(byte);
		}
		const json = {
			asset: { version: "2.0" },
			extensionsUsed: ["EXT_mesh_gpu_instancing"],
			scenes: [{ nodes: [0] }],
			scene: 0,
			nodes: [
				{
					mesh: 0,
					name: "Trees",
					extensions: extra.noExtension
						? undefined
						: { EXT_mesh_gpu_instancing: { attributes } },
				},
			],
			meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
			accessors,
			bufferViews,
			buffers: [
				{
					byteLength: merged.byteLength,
					uri: `data:application/octet-stream;base64,${btoa(binary)}`,
				},
			],
		};
		return new TextEncoder().encode(JSON.stringify(json)).buffer;
	};

	const parse = async (document) => {
		return await parseGLTF(document, undefined, {});
	};

	const TRANSLATIONS = new Float32Array([
		0, 0, 0, 10, 0, 0, 0, 0, 20, -5, 0, -5,
	]);

	it("reads a node's per-instance translations", async () => {
		const data = await parse(
			buildDocument({
				TRANSLATION: {
					array: TRANSLATIONS,
					componentType: 5126,
					count: 4,
					type: "VEC3",
				},
			}),
		);
		const node = data.nodes[0];
		expect(node.instances).toBeDefined();
		expect(node.instances.count).toBe(4);
		expect(Array.from(node.instances.translation)).toEqual(
			Array.from(TRANSLATIONS),
		);
		// the geometry is carried ONCE, not per instance — the whole point
		expect(node.vertexCount).toBe(3);
	});

	it("leaves an ordinary node without instances", async () => {
		const data = await parse(buildDocument({}, { noExtension: true }));
		expect(data.nodes[0].instances).toBeUndefined();
	});

	it("a node declaring the extension with no attributes is not instanced", async () => {
		// tolerated rather than treated as an error: there is simply nothing
		// to instance, and the node should still render once
		const data = await parse(buildDocument({}));
		expect(data.nodes[0].instances).toBeUndefined();
	});

	it("derives the count from whichever accessor is present", async () => {
		// TRANSLATION absent, SCALE present — the count must come from SCALE
		// rather than defaulting to zero and silently dropping the node
		const data = await parse(
			buildDocument({
				SCALE: {
					array: new Float32Array([1, 1, 1, 2, 2, 2]),
					componentType: 5126,
					count: 2,
					type: "VEC3",
				},
			}),
		);
		expect(data.nodes[0].instances.count).toBe(2);
		expect(data.nodes[0].instances.translation).toBeUndefined();
		expect(Array.from(data.nodes[0].instances.scale)).toEqual([
			1, 1, 1, 2, 2, 2,
		]);
	});

	it("reads all three attributes together", async () => {
		const data = await parse(
			buildDocument({
				TRANSLATION: {
					array: new Float32Array([1, 2, 3]),
					componentType: 5126,
					count: 1,
					type: "VEC3",
				},
				ROTATION: {
					array: new Float32Array([0, 0, 0, 1]),
					componentType: 5126,
					count: 1,
					type: "VEC4",
				},
				SCALE: {
					array: new Float32Array([2, 2, 2]),
					componentType: 5126,
					count: 1,
					type: "VEC3",
				},
			}),
		);
		const instances = data.nodes[0].instances;
		expect(instances.count).toBe(1);
		expect(Array.from(instances.translation)).toEqual([1, 2, 3]);
		expect(Array.from(instances.rotation)).toEqual([0, 0, 0, 1]);
		expect(Array.from(instances.scale)).toEqual([2, 2, 2]);
	});

	it("scales a normalized SHORT rotation back to [-1, 1]", async () => {
		// exporters use normalized integers to shrink large scatters. Read
		// raw, a short-encoded quaternion arrives as values up to 32767 and
		// every instance is flung out of the scene.
		const quarterTurn = Math.SQRT1_2; // sin/cos of 45°
		const encoded = new Int16Array([
			0,
			Math.round(quarterTurn * 32767),
			0,
			Math.round(quarterTurn * 32767),
		]);
		const data = await parse(
			buildDocument({
				ROTATION: {
					array: encoded,
					componentType: 5122,
					count: 1,
					type: "VEC4",
					normalized: true,
				},
			}),
		);
		const rotation = data.nodes[0].instances.rotation;
		expect(rotation[0]).toBeCloseTo(0, 4);
		expect(rotation[1]).toBeCloseTo(quarterTurn, 4);
		expect(rotation[3]).toBeCloseTo(quarterTurn, 4);
		// and it is a unit quaternion, which is what makes it a rotation
		const length = Math.hypot(...rotation);
		expect(length).toBeCloseTo(1, 4);
	});

	it("scales a normalized BYTE rotation, clamping the extra negative value", async () => {
		// two's complement gives -128 where the normalized range stops at
		// -127; the spec says clamp rather than overshoot
		const encoded = new Int8Array([-128, 0, 0, 127]);
		const data = await parse(
			buildDocument({
				ROTATION: {
					array: encoded,
					componentType: 5120,
					count: 1,
					type: "VEC4",
					normalized: true,
				},
			}),
		);
		const rotation = data.nodes[0].instances.rotation;
		expect(rotation[0]).toBe(-1);
		expect(rotation[3]).toBeCloseTo(1, 5);
	});

	it("leaves a float ROTATION untouched", async () => {
		const exact = new Float32Array([0.5, -0.5, 0.5, 0.5]);
		const data = await parse(
			buildDocument({
				ROTATION: {
					array: exact,
					componentType: 5126,
					count: 1,
					type: "VEC4",
				},
			}),
		);
		expect(Array.from(data.nodes[0].instances.rotation)).toEqual(
			Array.from(exact),
		);
	});
});

/**
 * The TRS → instance-record composition (#1508). Authored instancing
 * arrives as translation / quaternion / scale rather than matrices, and is
 * composed straight into the row-major record — a forest of five thousand
 * trees would otherwise allocate five thousand throwaway matrices at load.
 *
 * Composing by hand is exactly the kind of code that is subtly wrong in a
 * way nothing catches: a transposed rotation still looks like "trees at
 * angles". So these check it against the matrix path that is already
 * trusted, rather than against my own arithmetic.
 */
describe("writeInstanceTRS", () => {
	const FLOATS = 12;

	const record = (t, r, s) => {
		const out = new Float32Array(FLOATS);
		writeInstanceTRS(out, 0, ...t, ...r, ...s);
		return out;
	};

	// the row-major record read back as a Matrix3d, for comparison against
	// the matrix path
	const asMatrix = (out) => {
		return readInstanceTransform(out, 0, new Matrix3d());
	};

	it("an identity TRS is the identity transform", () => {
		const out = record([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]);
		expect(asMatrix(out).isIdentity()).toBe(true);
	});

	it("translation lands in the rows' w components, not a fourth row", () => {
		const out = record([7, 8, 9], [0, 0, 0, 1], [1, 1, 1]);
		expect(out[3]).toBe(7);
		expect(out[7]).toBe(8);
		expect(out[11]).toBe(9);
		// and the record is 12 floats — there is no fourth row to write
		expect(out).toHaveLength(12);
	});

	it("scale multiplies the basis columns, leaving translation alone", () => {
		const out = record([5, 0, 0], [0, 0, 0, 1], [2, 3, 4]);
		const m = asMatrix(out);
		expect(m.val[0]).toBeCloseTo(2, 5);
		expect(m.val[5]).toBeCloseTo(3, 5);
		expect(m.val[10]).toBeCloseTo(4, 5);
		expect(m.val[12]).toBeCloseTo(5, 5);
	});

	it("matches the trusted matrix path for a rotation about Y", () => {
		// the real check: compose the same rotation through Matrix3d and
		// compare. A transposed quaternion basis passes every "is it
		// rotated?" eyeball test and fails this one.
		const angle = Math.PI / 3;
		const half = angle / 2;
		const out = record(
			[0, 0, 0],
			[0, Math.sin(half), 0, Math.cos(half)],
			[1, 1, 1],
		);
		const expected = new Matrix3d()
			.identity()
			.rotate(angle, new Vector3d(0, 1, 0));
		const got = asMatrix(out);
		for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
			expect(got.val[i], `val[${i}]`).toBeCloseTo(expected.val[i], 5);
		}
	});

	it("matches the matrix path for a rotation about an arbitrary axis", () => {
		const axis = new Vector3d(1, 2, 3);
		const length = Math.hypot(axis.x, axis.y, axis.z);
		const angle = 0.7;
		const half = angle / 2;
		const sin = Math.sin(half) / length;
		const out = record(
			[0, 0, 0],
			[axis.x * sin, axis.y * sin, axis.z * sin, Math.cos(half)],
			[1, 1, 1],
		);
		const expected = new Matrix3d().identity().rotate(angle, axis);
		const got = asMatrix(out);
		for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
			expect(got.val[i], `val[${i}]`).toBeCloseTo(expected.val[i], 5);
		}
	});

	it("applies rotation BEFORE translation (glTF's T * R * S order)", () => {
		// getting the order backwards rotates the whole scatter about the
		// origin instead of rotating each instance in place — every tree
		// still stands up, but the forest is in the wrong place
		const half = Math.PI / 4; // 90° about Y, halved
		const out = record(
			[10, 0, 0],
			[0, Math.sin(half), 0, Math.cos(half)],
			[1, 1, 1],
		);
		// the translation survives verbatim; it is not rotated by R
		expect(out[3]).toBeCloseTo(10, 5);
		expect(out[11]).toBeCloseTo(0, 5);
	});

	it("composes rotation and scale in the right order", () => {
		// R * S, not S * R: scaling after rotating would shear a
		// non-uniformly scaled instance
		const half = Math.PI / 4;
		const out = record(
			[0, 0, 0],
			[0, Math.sin(half), 0, Math.cos(half)],
			[2, 1, 1],
		);
		const expected = new Matrix3d()
			.identity()
			.rotate(Math.PI / 2, new Vector3d(0, 1, 0))
			.scale(2, 1, 1);
		const got = asMatrix(out);
		for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
			expect(got.val[i], `val[${i}]`).toBeCloseTo(expected.val[i], 5);
		}
	});

	it("round-trips through the record without drift", () => {
		const half = 0.3;
		const out = record(
			[1.5, -2.5, 3.5],
			[Math.sin(half) * 0.6, Math.sin(half) * 0.8, 0, Math.cos(half)],
			[1.25, 1.25, 1.25],
		);
		const again = new Float32Array(FLOATS);
		writeInstanceTransform(again, 0, asMatrix(out));
		for (let i = 0; i < FLOATS; i++) {
			expect(again[i], `float ${i}`).toBeCloseTo(out[i], 5);
		}
	});
});

/**
 * Hardening found by code review (#1508): malformed and adversarial
 * instancing data. Each of these previously produced a silently wrong scene
 * — NaN records, a stray prototype, or a basis blown up by ~1e5 — rather
 * than an error.
 */
describe("EXT_mesh_gpu_instancing — malformed input", () => {
	const doc = (attributes, opts = {}) => {
		const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
		const chunks = [new Uint8Array(positions.buffer)];
		const accessors = [
			{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
		];
		const bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 36 }];
		let offset = 36;
		const attrs = {};
		for (const [name, spec] of Object.entries(attributes)) {
			const bytes = new Uint8Array(spec.array.buffer.slice(0));
			chunks.push(bytes);
			bufferViews.push({
				buffer: 0,
				byteOffset: offset,
				byteLength: bytes.byteLength,
			});
			const accessor = {
				bufferView: bufferViews.length - 1,
				componentType: spec.componentType,
				count: spec.count,
				type: spec.type,
			};
			if (spec.sparse) {
				accessor.sparse = { count: 1 };
			}
			accessors.push(accessor);
			attrs[name] = accessors.length - 1;
			offset += bytes.byteLength;
		}
		const total = chunks.reduce((n, c) => {
			return n + c.byteLength;
		}, 0);
		const merged = new Uint8Array(total);
		let at = 0;
		for (const c of chunks) {
			merged.set(c, at);
			at += c.byteLength;
		}
		let binary = "";
		for (const b of merged) {
			binary += String.fromCharCode(b);
		}
		return new TextEncoder().encode(
			JSON.stringify({
				asset: { version: "2.0" },
				extensionsUsed: ["EXT_mesh_gpu_instancing"],
				scene: 0,
				scenes: [{ nodes: [0] }],
				nodes: [
					{
						mesh: 0,
						name: "Trees",
						extensions: {
							EXT_mesh_gpu_instancing: { attributes: opts.empty ? {} : attrs },
						},
					},
				],
				meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
				accessors,
				bufferViews,
				buffers: [
					{
						byteLength: merged.byteLength,
						uri: `data:application/octet-stream;base64,${btoa(binary)}`,
					},
				],
			}),
		).buffer;
	};

	const vec3 = (n) => {
		return {
			array: new Float32Array(n * 3),
			componentType: 5126,
			count: n,
			type: "VEC3",
		};
	};

	it("clamps to the SHORTEST accessor and warns when counts disagree", async () => {
		// reading past the short accessor gives undefined -> NaN records, and
		// NaN clip coordinates make those instances silently disappear
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const data = await parseGLTF(
			doc({
				TRANSLATION: vec3(10),
				ROTATION: {
					array: new Float32Array(4 * 2),
					componentType: 5126,
					count: 2,
					type: "VEC4",
				},
			}),
			undefined,
			{},
		);
		expect(data.nodes[0].instances.count).toBe(2);
		expect(warn).toHaveBeenCalled();
		expect(String(warn.mock.calls[0][0])).toMatch(/disagree on count/);
		warn.mockRestore();
	});

	it("rejects a wrongly-typed accessor rather than deriving a fractional count", async () => {
		await expect(
			parseGLTF(
				doc({
					TRANSLATION: {
						array: new Float32Array(4 * 4),
						componentType: 5126,
						count: 4,
						type: "VEC4", // must be VEC3
					},
				}),
				undefined,
				{},
			),
		).rejects.toThrow(/TRANSLATION must be VEC3/);
	});

	it("rejects a sparse instance accessor instead of reading its base data", async () => {
		await expect(
			parseGLTF(
				doc({ TRANSLATION: { ...vec3(4), sparse: true } }),
				undefined,
				{},
			),
		).rejects.toThrow(/sparse/);
	});

	it("rejects an UNSIGNED quaternion encoding", async () => {
		// passed through raw, a component of 255 makes the basis ~1e5 and
		// destroys the scene
		await expect(
			parseGLTF(
				doc({
					ROTATION: {
						array: new Uint16Array([0, 0, 0, 65535]),
						componentType: 5123,
						count: 1,
						type: "VEC4",
					},
				}),
				undefined,
				{},
			),
		).rejects.toThrow(/ROTATION must be float or normalized/);
	});

	it("an extension with NO attributes leaves the node un-instanced", async () => {
		const data = await parseGLTF(doc({}, { empty: true }), undefined, {});
		expect(data.nodes[0].instances).toBeUndefined();
	});

	it("an authored EMPTY scatter yields zero instances, not one stray copy", async () => {
		const data = await parseGLTF(doc({ TRANSLATION: vec3(0) }), undefined, {});
		expect(data.nodes[0].instances).toBeDefined();
		expect(data.nodes[0].instances.count).toBe(0);
	});
});

describe("writeInstanceTRS — adversarial", () => {
	const record = (t, r, s) => {
		const out = new Float32Array(12);
		writeInstanceTRS(out, 0, ...t, ...r, ...s);
		return out;
	};

	it("a non-unit quaternion distorts the basis (exporters emit these)", () => {
		// Documents the behaviour rather than pretending it cannot happen: the
		// standard quaternion->basis formula assumes a unit quaternion, so a
		// denormalized one silently bakes a scale into the instance. The axis
		// the rotation is about stays unit length; the perpendicular ones do
		// not, which is what makes it hard to spot by eye.
		const out = record([0, 0, 0], [0.6, 0, 0, 0.6], [1, 1, 1]);
		expect(Math.hypot(out[0], out[4], out[8])).toBeCloseTo(1, 5);
		const perpendicular = Math.hypot(out[1], out[5], out[9]);
		expect(perpendicular).not.toBeCloseTo(1, 3);
	});

	it("a mirrored (negative) scale flips the basis determinant", () => {
		const out = record([0, 0, 0], [0, 0, 0, 1], [-1, 1, 1]);
		expect(out[0]).toBeCloseTo(-1, 5);
		// the other axes are untouched — only X mirrors
		expect(out[5]).toBeCloseTo(1, 5);
		expect(out[10]).toBeCloseTo(1, 5);
	});

	it("writes at a NON-ZERO offset inside a wide record", () => {
		// every other test uses offset 0, so the offset arithmetic against
		// colorOffset/dataOffset is otherwise unexercised
		const layout = instanceRecordLayout(true, true);
		const buffer = new Float32Array(3 * layout.floats).fill(7);
		writeInstanceTRS(buffer, 2 * layout.floats, 5, 6, 7, 0, 0, 0, 1, 1, 1, 1);
		const at = 2 * layout.floats;
		expect(buffer[at + 3]).toBe(5);
		expect(buffer[at + 7]).toBe(6);
		expect(buffer[at + 11]).toBe(7);
		// the neighbouring record and this record's own slots are untouched
		expect(buffer[at - 1]).toBe(7);
		expect(buffer[at + layout.colorOffset]).toBe(7);
	});
});

describe("the instance record layout", () => {
	it("numbers the optional slots at FIXED offsets, not sequentially", () => {
		// this is what lets ONE derived WGSL module serve every variant: a
		// variant without the colour slot must not renumber the data slot
		const dataOnly = instanceAttributes(instanceRecordLayout(false, true), 8);
		const both = instanceAttributes(instanceRecordLayout(true, true), 8);
		const dataSlot = dataOnly[dataOnly.length - 1];
		const bothData = both[both.length - 1];
		expect(dataSlot.shaderLocation).toBe(12); // base + 4, NOT base + 3
		expect(bothData.shaderLocation).toBe(12);
		// same location, different byte offsets — the colour slot moved it
		expect(dataSlot.offset).toBe(48);
		expect(bothData.offset).toBe(64);
	});

	it("packs with no hole when data is declared without colour", () => {
		const layout = instanceRecordLayout(false, true);
		expect(layout.dataOffset).toBe(12);
		expect(layout.stride).toBe(64);
		expect(layout.colorOffset).toBe(-1);
	});
});
