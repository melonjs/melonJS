import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera3d,
	Matrix2d,
	Matrix3d,
	Mesh,
	Renderable,
	Stage,
	state,
	Vector2d,
	Vector3d,
	video,
} from "../src/index.js";
import { normalizeVertices, projectVertices } from "../src/math/vertex.ts";

// ── Vertex Utilities ────────────────────────────────────────────────────────

describe("normalizeVertices()", () => {
	it("centers vertices at the origin", () => {
		const v = new Float32Array([1, 2, 3, 5, 6, 7]);
		normalizeVertices(v);
		// center should be at 0
		const cx = (v[0] + v[3]) / 2;
		const cy = (v[1] + v[4]) / 2;
		const cz = (v[2] + v[5]) / 2;
		expect(cx).toBeCloseTo(0, 5);
		expect(cy).toBeCloseTo(0, 5);
		expect(cz).toBeCloseTo(0, 5);
	});

	it("scales to fit within [-0.5, 0.5]", () => {
		const v = new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]);
		normalizeVertices(v);
		for (let i = 0; i < v.length; i++) {
			expect(v[i]).toBeGreaterThanOrEqual(-0.5);
			expect(v[i]).toBeLessThanOrEqual(0.5);
		}
	});

	it("preserves aspect ratio (uniform scale)", () => {
		const v = new Float32Array([0, 0, 0, 10, 2, 4]);
		normalizeVertices(v);
		// largest axis was 10, so x range should be 10/10=1, y range should be 2/10=0.2
		const rangeX = v[3] - v[0];
		const rangeY = v[4] - v[1];
		expect(rangeX).toBeCloseTo(1.0, 5);
		expect(rangeY).toBeCloseTo(0.2, 5);
	});

	it("handles single vertex (no crash)", () => {
		const v = new Float32Array([5, 10, 15]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(0, 5);
		expect(v[1]).toBeCloseTo(0, 5);
		expect(v[2]).toBeCloseTo(0, 5);
	});

	it("handles already-normalized vertices", () => {
		const v = new Float32Array([-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
		normalizeVertices(v);
		expect(v[0]).toBeCloseTo(-0.5, 5);
		expect(v[3]).toBeCloseTo(0.5, 5);
	});
});

describe("projectVertices()", () => {
	it("identity matrix maps to center of display area", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		const identity = new Matrix3d().val;
		projectVertices(src, dst, 1, identity, 200, 100);
		expect(dst[0]).toBeCloseTo(100, 5); // halfW
		expect(dst[1]).toBeCloseTo(50, 5); // halfH
	});

	it("applies offset", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		const identity = new Matrix3d().val;
		projectVertices(src, dst, 1, identity, 200, 100, 10, 20);
		expect(dst[0]).toBeCloseTo(110, 5); // halfW + offsetX
		expect(dst[1]).toBeCloseTo(70, 5); // halfH + offsetY
	});

	it("computes Z when zScale is non-zero", () => {
		const src = new Float32Array([0, 0, 0.5]);
		const dst = new Float32Array(3);
		const identity = new Matrix3d().val;
		projectVertices(src, dst, 1, identity, 200, 100, 0, 0, 1000);
		expect(dst[2]).toBeCloseTo(-500, 1); // -0.5 * 1000
	});

	it("Z is 0 when zScale is 0", () => {
		const src = new Float32Array([0, 0, 0.5]);
		const dst = new Float32Array(3);
		const identity = new Matrix3d().val;
		projectVertices(src, dst, 1, identity, 200, 100);
		expect(dst[2]).toEqual(0);
	});

	it("applies translation from matrix", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		const m = new Matrix3d();
		m.translate(0.5, 0, 0);
		projectVertices(src, dst, 1, m.val, 200, 100);
		expect(dst[0]).toBeCloseTo(200, 5); // halfW + 0.5 * width
	});

	it("handles perspective divide", () => {
		const src = new Float32Array([0, 0, 0]);
		const dst = new Float32Array(3);
		const m = new Matrix3d();
		m.perspective(Math.PI / 4, 1, 0.1, 10);
		m.translate(0, 0, -2);
		projectVertices(src, dst, 1, m.val, 400, 400);
		// should be centered
		expect(dst[0]).toBeCloseTo(200, 0);
		expect(dst[1]).toBeCloseTo(200, 0);
	});
});

// ── OBJ Parser ──────────────────────────────────────────────────────────────

import { objList } from "../src/loader/cache.js";
// import the parser directly (not exported from index)
import { preloadOBJ } from "../src/loader/parsers/obj.js";

/**
 * Helper: parse an OBJ string synchronously by feeding it to the parser internals.
 * We bypass the fetch/preload and call parseOBJ directly via a dynamic import.
 */
async function parseOBJString(text) {
	// The parseOBJ function is not exported, so we test via preloadOBJ indirectly
	// or we can import the module and access it. For now, test via the cache.
	// We'll use a data URL approach with the preload function.
	const name = "test_" + Math.random();
	const blob = new Blob([text], { type: "text/plain" });
	const url = URL.createObjectURL(blob);

	return new Promise((resolve, reject) => {
		preloadOBJ(
			{ name, src: url },
			() => {
				URL.revokeObjectURL(url);
				resolve(objList[name]);
			},
			(err) => {
				URL.revokeObjectURL(url);
				reject(err);
			},
			{},
		);
	});
}

describe("OBJ Parser", () => {
	it("parses vertices and faces", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			f 1 2 3
		`);
		expect(obj.vertexCount).toEqual(3);
		expect(obj.indices.length).toEqual(3);
		expect(obj.vertices[0]).toEqual(0);
		expect(obj.vertices[3]).toEqual(1);
		expect(obj.vertices[6]).toEqual(1);
		expect(obj.vertices[7]).toEqual(1);
	});

	it("parses UV coordinates", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			vt 0 0
			vt 1 0
			vt 1 1
			f 1/1 2/2 3/3
		`);
		expect(obj.uvs[0]).toEqual(0);
		expect(obj.uvs[1]).toEqual(1); // V is flipped (1 - 0 = 1)
		expect(obj.uvs[2]).toEqual(1);
		expect(obj.uvs[3]).toEqual(1); // V is flipped (1 - 0 = 1)
		expect(obj.uvs[4]).toEqual(1);
		expect(obj.uvs[5]).toEqual(0); // V is flipped (1 - 1 = 0)
	});

	it("triangulates quads", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			v 0 1 0
			f 1 2 3 4
		`);
		// quad → 2 triangles → 6 indices
		expect(obj.indices.length).toEqual(6);
		expect(obj.vertexCount).toEqual(4);
	});

	it("handles v/vt/vn format (ignores normals)", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			vt 0 0
			vt 1 0
			vt 1 1
			vn 0 0 1
			vn 0 0 1
			vn 0 0 1
			f 1/1/1 2/2/2 3/3/3
		`);
		expect(obj.vertexCount).toEqual(3);
		expect(obj.indices.length).toEqual(3);
	});

	it("handles missing UVs with default (0,0)", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			f 1 2 3
		`);
		expect(obj.uvs[0]).toEqual(0);
		expect(obj.uvs[1]).toEqual(0);
	});

	it("skips comments and empty lines", async () => {
		const obj = await parseOBJString(`
			# this is a comment

			v 0 0 0
			# another comment
			v 1 0 0
			v 0 1 0
			f 1 2 3
		`);
		expect(obj.vertexCount).toEqual(3);
	});

	it("auto-corrects CW winding to CCW", async () => {
		// CW triangle (negative signed volume)
		const obj = await parseOBJString(`
			v -1 -1 -1
			v -1  1 -1
			v  1 -1 -1
			v  1  1 -1
			v -1 -1  1
			v -1  1  1
			v  1 -1  1
			v  1  1  1
			f 1 3 4 2
			f 5 6 8 7
			f 1 2 6 5
			f 3 7 8 4
			f 1 5 7 3
			f 2 4 8 6
		`);
		// Should still produce valid geometry (winding may be flipped)
		expect(obj.vertexCount).toBeGreaterThan(0);
		expect(obj.indices.length).toBeGreaterThan(0);
	});

	// ── multi-material groups (glTF "groups" convention) ─────────────────

	it("emits a single material-less group for OBJs with no usemtl", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			f 1 2 3
		`);
		expect(Array.isArray(obj.groups)).toBe(true);
		expect(obj.groups.length).toBe(1);
		expect(obj.groups[0].materialName).toBe(null);
		expect(obj.groups[0].start).toBe(0);
		expect(obj.groups[0].count).toBe(obj.indices.length);
	});

	it("emits one group per usemtl directive, slicing the index buffer", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			v 0 1 0
			v 2 0 0
			v 2 1 0
			usemtl red
			f 1 2 3
			usemtl blue
			f 1 3 4
			usemtl green
			f 2 5 6
		`);
		expect(obj.groups.length).toBe(3);
		expect(obj.groups[0].materialName).toBe("red");
		expect(obj.groups[0].start).toBe(0);
		expect(obj.groups[0].count).toBe(3);
		expect(obj.groups[1].materialName).toBe("blue");
		expect(obj.groups[1].start).toBe(3);
		expect(obj.groups[1].count).toBe(3);
		expect(obj.groups[2].materialName).toBe("green");
		expect(obj.groups[2].start).toBe(6);
		expect(obj.groups[2].count).toBe(3);
		// every index is covered by exactly one group
		const total = obj.groups.reduce((s, g) => {
			return s + g.count;
		}, 0);
		expect(total).toBe(obj.indices.length);
	});

	it("emits an anonymous null-material group for faces declared before any usemtl", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			v 0 1 0
			f 1 2 3
			usemtl red
			f 1 3 4
		`);
		// 2 groups: the anonymous pre-usemtl chunk + the explicit "red"
		expect(obj.groups.length).toBe(2);
		expect(obj.groups[0].materialName).toBe(null);
		expect(obj.groups[0].count).toBe(3);
		expect(obj.groups[1].materialName).toBe("red");
		expect(obj.groups[1].count).toBe(3);
	});

	it("handles triangulated quads inside a material group", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			v 0 1 0
			usemtl panels
			f 1 2 3 4
		`);
		// quad → 2 triangles → 6 indices
		expect(obj.groups.length).toBe(1);
		expect(obj.groups[0].materialName).toBe("panels");
		expect(obj.groups[0].count).toBe(6);
		expect(obj.indices.length).toBe(6);
	});

	it("group boundaries survive CW→CCW winding correction", async () => {
		// CW winding (negative volume) gets flipped; the per-triangle
		// index reorder must not move triangles between groups
		const obj = await parseOBJString(`
			v -1 -1 -1
			v -1  1 -1
			v  1 -1 -1
			v  1  1 -1
			usemtl front
			f 1 3 4
			f 1 4 2
		`);
		expect(obj.groups.length).toBe(1);
		expect(obj.groups[0].materialName).toBe("front");
		// count is total indices, regardless of winding flip
		expect(obj.groups[0].count).toBe(obj.indices.length);
	});

	it("empty OBJ produces an empty groups array (not null)", async () => {
		const obj = await parseOBJString(``);
		expect(Array.isArray(obj.groups)).toBe(true);
		expect(obj.groups.length).toBe(0);
	});

	it("usemtl with no following faces leaves a zero-count group", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			usemtl red
			f 1 2 3
			usemtl unused
		`);
		expect(obj.groups.length).toBe(2);
		expect(obj.groups[0].materialName).toBe("red");
		expect(obj.groups[0].count).toBe(3);
		expect(obj.groups[1].materialName).toBe("unused");
		expect(obj.groups[1].count).toBe(0);
	});
});

// ── Matrix3d extensions ─────────────────────────────────────────────────────

describe("Matrix3d", () => {
	describe("perspective()", () => {
		it("produces a valid perspective matrix", () => {
			const m = new Matrix3d();
			m.perspective(Math.PI / 4, 1, 0.1, 100);
			const v = m.val;
			// element [15] should be 0 (perspective projection)
			expect(v[15]).toEqual(0);
			// element [11] should be -1
			expect(v[11]).toEqual(-1);
			// element [0] should equal f/aspect where f = 1/tan(fov/2)
			const f = 1 / Math.tan(Math.PI / 8);
			expect(v[0]).toBeCloseTo(f, 5);
			expect(v[5]).toBeCloseTo(f, 5);
		});

		it("returns reference for chaining", () => {
			const m = new Matrix3d();
			expect(m.perspective(Math.PI / 4, 1, 0.1, 100)).toBe(m);
		});
	});

	describe("toMatrix2d()", () => {
		it("extracts correct 2D affine components", () => {
			const m = new Matrix3d();
			m.identity();
			m.translate(10, 20, 0);
			const m2d = m.toMatrix2d();
			// tx, ty should be preserved
			expect(m2d.tx).toBeCloseTo(10, 5);
			expect(m2d.ty).toBeCloseTo(20, 5);
		});

		it("extracts rotation correctly", () => {
			const m = new Matrix3d();
			const angle = Math.PI / 6;
			m.rotate(angle, new Vector3d(0, 0, 1));
			const m2d = m.toMatrix2d();
			expect(m2d.val[0]).toBeCloseTo(Math.cos(angle), 5);
			expect(m2d.val[1]).toBeCloseTo(Math.sin(angle), 5);
		});

		it("reuses output matrix when provided", () => {
			const m = new Matrix3d();
			m.translate(5, 10, 0);
			const out = new Matrix2d();
			const result = m.toMatrix2d(out);
			expect(result).toBe(out);
			expect(out.tx).toBeCloseTo(5, 5);
		});
	});
});

// ── Renderable with Matrix3d ────────────────────────────────────────────────

describe("Renderable (Matrix3d currentTransform)", () => {
	it("currentTransform is a Matrix3d", () => {
		const r = new Renderable(0, 0, 100, 100);
		expect(r.currentTransform).toBeInstanceOf(Matrix3d);
	});

	it("starts as identity", () => {
		const r = new Renderable(0, 0, 100, 100);
		expect(r.currentTransform.isIdentity()).toBe(true);
	});

	it("rotate() defaults to Z axis", () => {
		const r = new Renderable(0, 0, 100, 100);
		r.rotate(Math.PI / 4);
		const v = r.currentTransform.val;
		// Z-axis rotation: cos in [0],[5] and sin in [1], -sin in [4]
		const cos = Math.cos(Math.PI / 4);
		const sin = Math.sin(Math.PI / 4);
		expect(v[0]).toBeCloseTo(cos, 5);
		expect(v[1]).toBeCloseTo(sin, 5);
		expect(v[4]).toBeCloseTo(-sin, 5);
		expect(v[5]).toBeCloseTo(cos, 5);
	});

	it("rotate() accepts a 3D axis", () => {
		const r = new Renderable(0, 0, 100, 100);
		r.rotate(Math.PI / 2, new Vector3d(0, 1, 0));
		// Y-axis rotation by 90°: [0]=cos≈0, [8]=sin≈1
		expect(r.currentTransform.val[0]).toBeCloseTo(0, 4);
	});

	it("scale() defaults z to 1", () => {
		const r = new Renderable(0, 0, 100, 100);
		r.scale(2, 3);
		const v = r.currentTransform.val;
		expect(v[0]).toEqual(2);
		expect(v[5]).toEqual(3);
		expect(v[10]).toEqual(1); // z preserved
	});

	it("translate() modifies the transform", () => {
		const r = new Renderable(0, 0, 100, 100);
		r.translate(10, 20);
		const v = r.currentTransform.val;
		expect(v[12]).toEqual(10); // tx
		expect(v[13]).toEqual(20); // ty
		expect(v[14]).toEqual(0); // tz default
	});

	it("translate() supports z offset", () => {
		const r = new Renderable(0, 0, 100, 100);
		r.translate(0, 0, 5);
		expect(r.currentTransform.val[14]).toEqual(5);
	});
});

// ── Matrix3d.multiply ────────────────────────────────────────────────────────

describe("Matrix3d.multiply()", () => {
	it("Matrix3d × Matrix3d identity = no change", () => {
		const m = new Matrix3d();
		m.translate(10, 20, 30);
		const before = Float32Array.from(m.val);
		m.multiply(new Matrix3d());
		for (let i = 0; i < 16; i++) {
			expect(m.val[i]).toBeCloseTo(before[i], 5);
		}
	});

	it("Matrix3d × Matrix3d produces correct result", () => {
		const a = new Matrix3d();
		a.translate(5, 0, 0);
		const b = new Matrix3d();
		b.translate(0, 10, 0);
		a.multiply(b);
		expect(a.tx).toBeCloseTo(5, 5);
		expect(a.ty).toBeCloseTo(10, 5);
	});

	it("Matrix3d × Matrix2d produces same result as Matrix2d × Matrix2d", () => {
		// set up identical transforms in both formats
		const m2a = new Matrix2d();
		const m2b = new Matrix2d();
		m2a.translate(10, 20);
		m2a.rotate(Math.PI / 6);
		m2b.scale(2, 3);
		m2b.translate(5, 7);

		const m3a = new Matrix3d();
		m3a.translate(10, 20);
		m3a.rotate(Math.PI / 6, new Vector3d(0, 0, 1));

		// multiply m3a × m2b (Matrix3d × Matrix2d)
		m3a.multiply(m2b);
		// multiply m2a × m2b (Matrix2d × Matrix2d)
		m2a.multiply(m2b);

		// verify the 2D components match
		const r3 = m3a.toMatrix2d();
		expect(r3.val[0]).toBeCloseTo(m2a.val[0], 4);
		expect(r3.val[1]).toBeCloseTo(m2a.val[1], 4);
		expect(r3.val[3]).toBeCloseTo(m2a.val[3], 4);
		expect(r3.val[4]).toBeCloseTo(m2a.val[4], 4);
		expect(r3.tx).toBeCloseTo(m2a.tx, 4);
		expect(r3.ty).toBeCloseTo(m2a.ty, 4);
	});

	it("Matrix3d × Matrix2d identity = no change", () => {
		const m = new Matrix3d();
		m.translate(10, 20, 30);
		m.rotate(0.5, new Vector3d(1, 0, 0));
		const before = Float32Array.from(m.val);
		m.multiply(new Matrix2d());
		for (let i = 0; i < 16; i++) {
			expect(m.val[i]).toBeCloseTo(before[i], 5);
		}
	});

	it("Matrix3d × Matrix2d translation is correct", () => {
		const m3 = new Matrix3d();
		const m2 = new Matrix2d();
		m2.translate(100, 200);
		m3.multiply(m2);
		expect(m3.tx).toBeCloseTo(100, 5);
		expect(m3.ty).toBeCloseTo(200, 5);
	});

	it("Matrix3d × Matrix2d scale is correct", () => {
		const m3 = new Matrix3d();
		const m2 = new Matrix2d();
		m2.scale(3, 5);
		m3.multiply(m2);
		expect(m3.val[0]).toBeCloseTo(3, 5);
		expect(m3.val[5]).toBeCloseTo(5, 5);
		// Z should be unaffected
		expect(m3.val[10]).toBeCloseTo(1, 5);
	});

	it("Matrix3d × Matrix2d rotation is correct", () => {
		const m3 = new Matrix3d();
		const m2 = new Matrix2d();
		m2.rotate(Math.PI / 4);
		m3.multiply(m2);
		const cos = Math.cos(Math.PI / 4);
		const sin = Math.sin(Math.PI / 4);
		expect(m3.val[0]).toBeCloseTo(cos, 5);
		expect(m3.val[1]).toBeCloseTo(sin, 5);
		expect(m3.val[4]).toBeCloseTo(-sin, 5);
		expect(m3.val[5]).toBeCloseTo(cos, 5);
	});

	it("returns reference for chaining", () => {
		const m = new Matrix3d();
		expect(m.multiply(new Matrix3d())).toBe(m);
		expect(m.multiply(new Matrix2d())).toBe(m);
	});
});

// ── Matrix3d.apply parity with Matrix2d ─────────────────────────────────────

describe("Matrix3d.apply(Vector2d)", () => {
	it("matches Matrix2d.apply for translation", () => {
		const m2 = new Matrix2d();
		const m3 = new Matrix3d();
		m2.translate(10, 20);
		m3.translate(10, 20);

		const v2 = new Vector2d(5, 7);
		const v3 = new Vector2d(5, 7);
		m2.apply(v2);
		m3.apply(v3);

		expect(v3.x).toBeCloseTo(v2.x, 5);
		expect(v3.y).toBeCloseTo(v2.y, 5);
	});

	it("matches Matrix2d.apply for rotation", () => {
		const m2 = new Matrix2d();
		const m3 = new Matrix3d();
		m2.rotate(Math.PI / 6);
		m3.rotate(Math.PI / 6, new Vector3d(0, 0, 1));

		const v2 = new Vector2d(10, 0);
		const v3 = new Vector2d(10, 0);
		m2.apply(v2);
		m3.apply(v3);

		expect(v3.x).toBeCloseTo(v2.x, 5);
		expect(v3.y).toBeCloseTo(v2.y, 5);
	});

	it("matches Matrix2d.apply for scale + translate", () => {
		const m2 = new Matrix2d();
		const m3 = new Matrix3d();
		m2.scale(2, 3);
		m2.translate(5, 10);
		m3.scale(2, 3, 1);
		m3.translate(5, 10);

		const v2 = new Vector2d(1, 1);
		const v3 = new Vector2d(1, 1);
		m2.apply(v2);
		m3.apply(v3);

		expect(v3.x).toBeCloseTo(v2.x, 5);
		expect(v3.y).toBeCloseTo(v2.y, 5);
	});
});

// ── Matrix3d.rotate() edge cases ────────────────────────────────────────────

describe("Matrix3d.rotate() edge cases", () => {
	it("defaults to Z axis when no axis provided", () => {
		const m = new Matrix3d();
		m.rotate(Math.PI / 4);
		expect(m.val[0]).toBeCloseTo(Math.cos(Math.PI / 4), 5);
		expect(m.val[1]).toBeCloseTo(Math.sin(Math.PI / 4), 5);
	});

	it("returns this (not null) for zero-length axis", () => {
		const m = new Matrix3d();
		const result = m.rotate(1, new Vector3d(0, 0, 0));
		expect(result).toBe(m);
		// should be unchanged (no-op)
		expect(m.isIdentity()).toBe(true);
	});

	it("angle of 0 is a no-op", () => {
		const m = new Matrix3d();
		m.translate(5, 10);
		const before = Float32Array.from(m.val);
		m.rotate(0);
		for (let i = 0; i < 16; i++) {
			expect(m.val[i]).toEqual(before[i]);
		}
	});
});

// ── Matrix3d.scale() edge cases ─────────────────────────────────────────────

describe("Matrix3d.scale() edge cases", () => {
	it("defaults z to 1 (not 0)", () => {
		const m = new Matrix3d();
		m.scale(2, 3);
		expect(m.val[10]).toEqual(1); // z row preserved
	});

	it("scale(1) is identity-like", () => {
		const m = new Matrix3d();
		m.scale(1);
		expect(m.isIdentity()).toBe(true);
	});
});

// ── OBJ Parser edge cases ───────────────────────────────────────────────────

describe("OBJ Parser edge cases", () => {
	it("handles n-gon faces (5+ vertices)", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1.5 0.5 0
			v 1 1 0
			v 0 1 0
			f 1 2 3 4 5
		`);
		// 5-vertex polygon → 3 triangles → 9 indices
		expect(obj.indices.length).toEqual(9);
		expect(obj.vertexCount).toEqual(5);
	});

	it("handles v//vn format (vertex + normal, no UV)", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			vn 0 0 1
			vn 0 0 1
			vn 0 0 1
			f 1//1 2//2 3//3
		`);
		expect(obj.vertexCount).toEqual(3);
		// UVs should default to 0,0
		expect(obj.uvs[0]).toEqual(0);
		expect(obj.uvs[1]).toEqual(0);
	});

	it("handles empty file", async () => {
		const obj = await parseOBJString("");
		expect(obj.vertexCount).toEqual(0);
		expect(obj.indices.length).toEqual(0);
	});

	it("handles file with only comments", async () => {
		const obj = await parseOBJString(`
			# this is a comment
			# another comment
		`);
		expect(obj.vertexCount).toEqual(0);
	});

	it("ignores mtllib and usemtl lines", async () => {
		const obj = await parseOBJString(`
			mtllib materials.mtl
			usemtl default
			v 0 0 0
			v 1 0 0
			v 1 1 0
			f 1 2 3
		`);
		expect(obj.vertexCount).toEqual(3);
	});

	it("handles mixed faces (some with UVs, some without)", async () => {
		const obj = await parseOBJString(`
			v 0 0 0
			v 1 0 0
			v 1 1 0
			v 0 1 0
			vt 0.5 0.5
			f 1 2 3
			f 1/1 3/1 4/1
		`);
		expect(obj.indices.length).toEqual(6);
		expect(obj.vertexCount).toBeGreaterThanOrEqual(4);
	});
});

// ── Matrix3d.toMatrix2d() round-trip ────────────────────────────────────────

describe("Matrix3d / Matrix2d round-trip", () => {
	it("fromMat3d extracts correct translation", () => {
		const m3 = new Matrix3d();
		m3.translate(42, 84);
		const m2 = m3.toMatrix2d();
		expect(m2.tx).toBeCloseTo(42, 5);
		expect(m2.ty).toBeCloseTo(84, 5);
	});

	it("fromMat3d extracts correct rotation", () => {
		const m3 = new Matrix3d();
		m3.rotate(Math.PI / 3);
		const m2 = m3.toMatrix2d();
		expect(m2.val[0]).toBeCloseTo(Math.cos(Math.PI / 3), 5);
		expect(m2.val[1]).toBeCloseTo(Math.sin(Math.PI / 3), 5);
	});

	it("fromMat3d extracts correct scale + translate combo", () => {
		const m3 = new Matrix3d();
		m3.scale(2, 3);
		m3.translate(10, 20);
		const m2 = m3.toMatrix2d();
		expect(m2.val[0]).toBeCloseTo(2, 5); // scaleX
		expect(m2.val[4]).toBeCloseTo(3, 5); // scaleY
		expect(m2.tx).toBeCloseTo(20, 5); // tx = 10 * scaleX
		expect(m2.ty).toBeCloseTo(60, 5); // ty = 20 * scaleY
	});
});

/**
 * Mesh.draw() picks a projection path based on the active camera:
 * - Camera2d (or any non-Camera3d) → legacy self-projection via
 *   `projectionMatrix × currentTransform`.
 * - Camera3d → world-space output via `_projectVerticesWorld`, with
 *   a lazy one-time triangle-winding reversal so backface culling
 *   stays correct under the Y-flip in that path.
 *
 * These tests cover the runtime branch + the lazy setup, plus the
 * vertex math itself (offsets, scale, Y-flip).
 */
describe("Mesh × Camera3d world-space path", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
			cameraClass: Camera3d,
		});
		// state.change is async; force a stage swap so game.viewport
		// becomes the Camera3d the test cares about.
		const s = new Stage({ cameraClass: Camera3d });
		state.set(state.DEFAULT, s);
		state.change(state.DEFAULT, true);
	});

	afterAll(() => {
		// reset to default Camera2d so later spec files don't inherit
		// our Camera3d viewport.
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	// Minimal mesh-shaped object passed to drawMesh — the path we test
	// only mutates the Mesh itself, so the renderer can be a stub. Mesh
	// constructor doesn't need a texture for raw-vertex meshes that
	// route through the white-pixel fallback.
	const stubRenderer = { drawMesh() {} };

	// 12-vertex / 4-triangle pyramid as a minimal raw-data Mesh. Keeps
	// the test isolated from the OBJ + MTL loader.
	function buildPyramidSettings() {
		return {
			vertices: new Float32Array([
				// apex
				0, 1, 0,
				// base
				-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
			]),
			uvs: new Float32Array([0.5, 0, 0, 1, 1, 1, 1, 1, 0, 1]),
			indices: new Uint16Array([
				0,
				1,
				2,
				0,
				2,
				3,
				0,
				3,
				4,
				0,
				4,
				1, // sides
			]),
			width: 60,
			height: 60,
			cullBackFaces: true,
		};
	}

	it("activation under Camera3d marks the mesh for world-space draw", () => {
		const m = new Mesh(0, 0, buildPyramidSettings());
		expect(m._useWorldSpace).toBeUndefined();
		// onActivateEvent fires when the renderable joins the world.
		// Calling it directly mirrors what addChild does in production.
		m.onActivateEvent();
		expect(m._useWorldSpace).toBe(true);
	});

	it("first draw under Camera3d swaps indices to a winding-reversed copy", () => {
		const m = new Mesh(0, 0, buildPyramidSettings());
		m.onActivateEvent();
		const original = m.indices;

		expect(m._worldSpace).toBeUndefined();
		m.draw(stubRenderer);

		expect(m._worldSpace).toBe(true);
		expect(m.indices).not.toBe(original);
		// every triangle's last two indices should be swapped vs original
		for (let i = 0; i < original.length; i += 3) {
			expect(m.indices[i]).toBe(original[i]);
			expect(m.indices[i + 1]).toBe(original[i + 2]);
			expect(m.indices[i + 2]).toBe(original[i + 1]);
		}
	});

	it("second draw doesn't rebuild the winding-reversed indices", () => {
		const m = new Mesh(0, 0, buildPyramidSettings());
		m.onActivateEvent();
		m.draw(stubRenderer);
		const swapped = m.indices;
		m.draw(stubRenderer);
		// identity-equal — proves _setupWorldSpace ran exactly once
		expect(m.indices).toBe(swapped);
	});

	it("world-space output scales by width and translates by (px, py, pz)", () => {
		// Probe _projectVerticesWorld directly so the test doesn't depend
		// on normalizeVertices' centering rules — pick an axis-aligned
		// source where every component is independently verifiable.
		const m = new Mesh(0, 0, buildPyramidSettings());
		m.originalVertices = new Float32Array([0.5, 0.3, -0.2]);
		m.vertices = new Float32Array(3);
		m.vertexCount = 1;
		m._projectVerticesWorld(100, 50, 200);

		// X: 0.5 × width(60) + 100 = 130
		// Y: −(0.3) × 60 + 50    = −18 + 50 = 32   (Y-flip is the engine's
		//                                            Y-up→Y-down convention)
		// Z: (−0.2) × 60 + 200   = −12 + 200 = 188
		expect(m.vertices[0]).toBeCloseTo(130, 4);
		expect(m.vertices[1]).toBeCloseTo(32, 4);
		expect(m.vertices[2]).toBeCloseTo(188, 4);
	});

	it("world-space output applies currentTransform translation (PR #1464 review)", () => {
		// Regression: `_projectVerticesWorld` used to compute the
		// matrix-vec product `M × (vx, vy, vz)` with only the rotation/
		// scale columns of `currentTransform`, dropping the translation
		// column (m[12..14]). That made `mesh.translate(...)` a silent
		// no-op under Camera3d while the Camera2d path (via
		// `projectVertices` in vertex.ts) correctly honored it.
		const m = new Mesh(0, 0, buildPyramidSettings());
		m.originalVertices = new Float32Array([0.5, 0.3, -0.2]);
		m.vertices = new Float32Array(3);
		m.vertexCount = 1;

		// Translate the mesh by (4, 5, 6) — applied to the original
		// transform before projection. With width=60 from
		// `buildPyramidSettings`, the per-axis contribution is
		// `translate × width` (= 240, 300, 360 respectively).
		m.translate(4, 5, 6);
		m._projectVerticesWorld(100, 50, 200);

		// X: (0.5 + 4) × 60 + 100 = 4.5 × 60 + 100 = 370
		// Y: −(0.3 + 5) × 60 + 50 = −5.3 × 60 + 50 = −268
		// Z: (−0.2 + 6) × 60 + 200 = 5.8 × 60 + 200 = 548
		expect(m.vertices[0]).toBeCloseTo(370, 4);
		expect(m.vertices[1]).toBeCloseTo(-268, 4);
		expect(m.vertices[2]).toBeCloseTo(548, 4);
	});

	it("draw picks the path from the rendering viewport, not the activation viewport (PR #1464 review)", async () => {
		// Regression: `_useWorldSpace` is captured from `game.viewport`
		// once at `onActivateEvent` and never updated. A stage with
		// multiple cameras (e.g. Camera3d main + Camera2d minimap) ends
		// up running the wrong projection for whichever camera doesn't
		// match the activation viewport. The fix reads the path off
		// the viewport passed into `draw(renderer, viewport)` each
		// frame.
		const m = new Mesh(0, 0, buildPyramidSettings());
		m.onActivateEvent(); // captured: _useWorldSpace=true (Camera3d in beforeAll)
		const Camera2d = (await import("../src/camera/camera2d.ts")).default;
		const cam2d = new Camera2d(0, 0, 800, 600);

		// Pretend Camera2d renders the mesh. The world-space path
		// should NOT run; indices should be the original (not the
		// reversed copy).
		m.draw(stubRenderer, cam2d);
		expect(m.indices).toBe(m._indicesOriginal);
	});

	it("draw under Camera2d after Camera3d restores the original winding", () => {
		// Regression: _setupWorldSpace used to replace this.indices
		// permanently, so a Mesh that was first rendered under Camera3d
		// kept the reversed winding even when the active stage swapped
		// back to a Camera2d. Under `cullBackFaces: true` the model
		// would then look hollow.
		const m = new Mesh(0, 0, buildPyramidSettings());
		const originalIndices = m.indices;

		// First draw under Camera3d — builds the reversed buffer.
		m.onActivateEvent();
		m.draw(stubRenderer);
		expect(m.indices).not.toBe(originalIndices);
		expect(m.indices).toBe(m._indicesReversed);

		// Now pretend the stage swapped to Camera2d: _useWorldSpace
		// flips to false on next activation.
		m._useWorldSpace = false;
		m.draw(stubRenderer);

		// The original buffer (same identity) is back in place.
		expect(m.indices).toBe(originalIndices);
		expect(m.indices).toBe(m._indicesOriginal);

		// And a follow-up Camera3d frame re-uses the cached reversed
		// buffer — no rebuild.
		m._useWorldSpace = true;
		const reversed = m._indicesReversed;
		m.draw(stubRenderer);
		expect(m.indices).toBe(reversed);
	});

	it("world-space output Y-flips OBJ Y-up to engine Y-down", () => {
		const m = new Mesh(0, 0, buildPyramidSettings());
		m.originalVertices = new Float32Array([
			0,
			0.4,
			0, // +Y_obj should land at -Y_world
			0,
			-0.4,
			0, // -Y_obj should land at +Y_world
		]);
		m.vertices = new Float32Array(6);
		m.vertexCount = 2;
		m._projectVerticesWorld(0, 0, 0);

		// width = 60 from buildPyramidSettings
		expect(m.vertices[1]).toBeCloseTo(-24, 4);
		expect(m.vertices[4]).toBeCloseTo(24, 4);
	});
});
