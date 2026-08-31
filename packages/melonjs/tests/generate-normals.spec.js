/**
 * Surface normals generated from indexed triangle geometry.
 *
 * The engine had no way to produce these: a `Mesh` built from raw vertices and
 * flagged `lit` carried no normals, so the shader had nothing to light with and
 * the mesh rendered fullbright — asking for lighting and silently getting flat
 * colour. Every hand-built mesh had to write the same accumulate-and-normalize
 * loop first.
 */
import { describe, expect, it } from "vitest";
import { generateNormals } from "../src/math/vertex.ts";

/** unit-length check, plus the direction */
const expectNormal = (out, index, [x, y, z]) => {
	const at = index * 3;
	expect(out[at]).toBeCloseTo(x, 5);
	expect(out[at + 1]).toBeCloseTo(y, 5);
	expect(out[at + 2]).toBeCloseTo(z, 5);
	expect(Math.hypot(out[at], out[at + 1], out[at + 2])).toBeCloseTo(1, 5);
};

describe("generateNormals", () => {
	it("gives a single triangle its face normal", () => {
		// counter-clockwise in the XY plane -> +Z
		const out = generateNormals(
			new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			new Uint16Array([0, 1, 2]),
		);
		for (const v of [0, 1, 2]) {
			expectNormal(out, v, [0, 0, 1]);
		}
	});

	it("follows the winding", () => {
		const out = generateNormals(
			new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]),
			new Uint16Array([0, 1, 2]),
		);
		expectNormal(out, 0, [0, 0, -1]);
	});

	it("shades flat when no vertex is shared", () => {
		// two coplanar-in-nothing triangles, each with its own vertices: every
		// vertex belongs to one face, so its normal IS that face's normal
		const out = generateNormals(
			new Float32Array([
				// facing +Z
				0, 0, 0, 1, 0, 0, 0, 1, 0,
				// facing +Y
				0, 0, 0, 0, 0, -1, 1, 0, 0,
			]),
			new Uint16Array([0, 1, 2, 3, 4, 5]),
		);
		expectNormal(out, 0, [0, 0, 1]);
		expectNormal(out, 3, [0, -1, 0]);
	});

	it("shades smooth where faces share a vertex", () => {
		// a shared vertex between a +Z face and a -Y face averages to the
		// diagonal between them — the whole point of sharing vertices
		const out = generateNormals(
			new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, -1]),
			new Uint16Array([0, 1, 2, 0, 3, 1]),
		);
		const at = 0;
		expect(out[at]).toBeCloseTo(0, 5);
		expect(out[at + 1]).toBeCloseTo(-Math.SQRT1_2, 5);
		expect(out[at + 2]).toBeCloseTo(Math.SQRT1_2, 5);
	});

	it("weights by area, so a sliver does not outvote a large face", () => {
		const shared = new Float32Array([
			0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, -0.001,
		]);
		const out = generateNormals(shared, new Uint16Array([0, 1, 2, 0, 3, 1]));
		// the big +Z face dominates; the near-degenerate one barely tilts it
		expect(out[2]).toBeGreaterThan(0.99);
	});

	it("leaves a vertex touched only by degenerate faces at zero, not NaN", () => {
		const out = generateNormals(
			// all three points identical: zero-area, zero cross product
			new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
			new Uint16Array([0, 1, 2]),
		);
		expect([...out]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect([...out].some(Number.isNaN)).toBe(false);
	});

	it("writes into a supplied buffer, clearing it first", () => {
		const out = new Float32Array(9).fill(99);
		const same = generateNormals(
			new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
			new Uint16Array([0, 1, 2]),
			out,
		);
		expect(same).toBe(out);
		expectNormal(out, 0, [0, 0, 1]);
	});

	it("ignores a trailing partial triangle rather than reading past the end", () => {
		expect(() => {
			generateNormals(
				new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
				new Uint16Array([0, 1, 2, 0, 1]),
			);
		}).not.toThrow();
	});
});
