import { describe, expect, it } from "vitest";
import { parseOBJ } from "../src/loader/parsers/obj.js";

/**
 * OBJ vertex normals (#1572).
 *
 * `vn` used to be parsed and discarded, so an OBJ model could not be lit by
 * `Light3d` even though the engine fully supports lit meshes — the same
 * model imported from glTF shaded correctly while the OBJ one did not.
 * That reads as a bug rather than a missing feature, which is what these
 * pin.
 */
describe("OBJ vertex normals", () => {
	const parse = (lines) => {
		return parseOBJ(lines.join("\n"));
	};

	// a unit quad in the XY plane, wound CCW seen from +Z
	const QUAD = [
		"v -1 -1 0",
		"v 1 -1 0",
		"v 1 1 0",
		"v -1 1 0",
		"vt 0 0",
		"vt 1 0",
		"vt 1 1",
		"vt 0 1",
	];

	it("carries authored normals through to the mesh data", () => {
		const data = parse([
			...QUAD,
			"vn 0 0 1",
			"f 1/1/1 2/2/1 3/3/1",
			"f 1/1/1 3/3/1 4/4/1",
		]);
		expect(data.normals).toBeInstanceOf(Float32Array);
		expect(data.normals.length).toBe(data.vertexCount * 3);
		for (let i = 0; i < data.vertexCount; i++) {
			expect(Array.from(data.normals.slice(i * 3, i * 3 + 3))).toEqual([
				0, 0, 1,
			]);
		}
	});

	it("reads the `v//vn` form (no texture coordinates)", () => {
		const data = parse([
			"v 0 0 0",
			"v 1 0 0",
			"v 0 1 0",
			"vn 0 1 0",
			"f 1//1 2//1 3//1",
		]);
		expect(Array.from(data.normals.slice(0, 3))).toEqual([0, 1, 0]);
	});

	it("splits a vertex shared between DIFFERENT normals (a hard edge)", () => {
		// the same position+uv referenced with two normals must become two
		// vertices, or the hard edge smooths itself away
		const data = parse([
			"v 0 0 0",
			"v 1 0 0",
			"v 0 1 0",
			"v 1 1 0",
			"vn 0 0 1",
			"vn 1 0 0",
			"f 1//1 2//1 3//1",
			"f 1//2 2//2 4//2",
		]);
		// vertices 1 and 2 appear under both normals → 6 unified vertices
		expect(data.vertexCount).toBe(6);
		const seen = new Set();
		for (let i = 0; i < data.vertexCount; i++) {
			seen.add(data.normals.slice(i * 3, i * 3 + 3).join(","));
		}
		expect(seen.has("0,0,1")).toBe(true);
		expect(seen.has("1,0,0")).toBe(true);
	});

	it("does NOT split when the normal is shared (no needless duplication)", () => {
		const data = parse([
			...QUAD,
			"vn 0 0 1",
			"f 1/1/1 2/2/1 3/3/1",
			"f 1/1/1 3/3/1 4/4/1",
		]);
		expect(data.vertexCount).toBe(4);
	});

	it("generates unit normals when the file supplies none", () => {
		const data = parse([...QUAD, "f 1/1 2/2 3/3", "f 1/1 3/3 4/4"]);
		expect(data.normals.length).toBe(data.vertexCount * 3);
		for (let i = 0; i < data.vertexCount; i++) {
			const n = data.normals.slice(i * 3, i * 3 + 3);
			expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
		}
	});

	it("generated normals follow the CORRECTED winding, not the authored one", () => {
		// a closed CW-wound tetrahedron: the parser flips it to CCW, and the
		// generated normals have to be computed after that or they point
		// inward — the exact case the winding correction exists to fix
		const cw = parse([
			"v 0 0 0",
			"v 1 0 0",
			"v 0 1 0",
			"v 0 0 1",
			"f 1 3 2",
			"f 1 2 4",
			"f 1 4 3",
			"f 2 3 4",
		]);
		// every generated normal must point AWAY from the centroid
		let cx = 0;
		let cy = 0;
		let cz = 0;
		for (let i = 0; i < cw.vertexCount; i++) {
			cx += cw.vertices[i * 3];
			cy += cw.vertices[i * 3 + 1];
			cz += cw.vertices[i * 3 + 2];
		}
		cx /= cw.vertexCount;
		cy /= cw.vertexCount;
		cz /= cw.vertexCount;
		for (let i = 0; i < cw.vertexCount; i++) {
			const outward =
				(cw.vertices[i * 3] - cx) * cw.normals[i * 3] +
				(cw.vertices[i * 3 + 1] - cy) * cw.normals[i * 3 + 1] +
				(cw.vertices[i * 3 + 2] - cz) * cw.normals[i * 3 + 2];
			expect(outward, `vertex ${i}`).toBeGreaterThan(0);
		}
	});

	it("an unreferenced vertex gets a valid unit normal, never a zero vector", () => {
		// a zero normal normalizes to NaN in the shader and the fragment
		// turns black — worse than being slightly wrong
		const data = parse(["v 0 0 0", "v 1 0 0", "v 0 1 0", "f 1 2 3"]);
		for (let i = 0; i < data.vertexCount; i++) {
			const n = data.normals.slice(i * 3, i * 3 + 3);
			expect(Number.isFinite(Math.hypot(n[0], n[1], n[2]))).toBe(true);
			expect(Math.hypot(n[0], n[1], n[2])).toBeGreaterThan(0);
		}
	});

	it("normals are stored RAW — the axis bridge is applied at draw", () => {
		// flipping here would double the bridge the model matrix already
		// applies (`mat3(uModelMatrix) * aNormal`), exactly as for glTF
		const data = parse([
			"v 0 0 0",
			"v 1 0 0",
			"v 0 1 0",
			"vn 0 -1 0",
			"f 1//1 2//1 3//1",
		]);
		expect(Array.from(data.normals.slice(0, 3))).toEqual([0, -1, 0]);
	});
});
