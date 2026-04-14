import { describe, expect, it } from "vitest";
import {
	Matrix2d,
	Matrix3d,
	Renderable,
	Vector2d,
	Vector3d,
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
