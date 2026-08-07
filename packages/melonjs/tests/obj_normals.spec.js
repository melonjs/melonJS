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
	// ── review-hardening: cases the first cut got wrong (#1572) ─────────

	describe("normal resolution is per-vertex, never per-file", () => {
		const unitLength = (normals) => {
			const lengths = [];
			for (let i = 0; i < normals.length; i += 3) {
				lengths.push(Math.hypot(normals[i], normals[i + 1], normals[i + 2]));
			}
			return lengths;
		};

		it("generates for faces that omit `vn` in a file where others carry it", () => {
			// mixed authoring: the un-normalled face used to come out (0,0,0)
			// because generation was gated on "the file declared any vn"
			const data = parse([
				...QUAD,
				"v 3 -1 0",
				"v 5 -1 0",
				"v 3 1 0",
				"vn 0 0 1",
				"f 1/1/1 2/2/1 3/3/1",
				"f 5 6 7",
			]);
			expect(
				unitLength(data.normals).every((l) => {
					return Math.abs(l - 1) < 1e-5;
				}),
			).toBe(true);
		});

		it("generates when `vn` is declared but no face references it", () => {
			const data = parse([...QUAD, "vn 0 0 1", "f 1/1 2/2 3/3"]);
			expect(
				unitLength(data.normals).every((l) => {
					return Math.abs(l - 1) < 1e-5;
				}),
			).toBe(true);
		});

		it("an out-of-range `vn` index degrades to a generated normal, never NaN", () => {
			// `sourceNormals[vn3]` is undefined past the end; writing it
			// straight through produced NaN, which no downstream guard catches
			const data = parse([...QUAD, "vn 0 0 1", "f 1//9 2//9 3//9"]);
			expect(Array.from(data.normals).some(Number.isNaN)).toBe(false);
			expect(
				unitLength(data.normals).every((l) => {
					return Math.abs(l - 1) < 1e-5;
				}),
			).toBe(true);
		});

		it("resolves a `vn` declared AFTER the face that references it", () => {
			// legal enough to appear in the wild, and single-pass resolution
			// read it before it existed
			const data = parse([...QUAD, "f 1//1 2//1 3//1", "vn 0 0 1"]);
			expect(Array.from(data.normals.slice(0, 3))).toEqual([0, 0, 1]);
		});

		it("an empty normal field (`v/vt/`) is treated as absent", () => {
			const data = parse([...QUAD, "vn 0 0 1", "f 1/1/ 2/2/ 3/3/"]);
			expect(Array.from(data.normals).some(Number.isNaN)).toBe(false);
			expect(
				unitLength(data.normals).every((l) => {
					return Math.abs(l - 1) < 1e-5;
				}),
			).toBe(true);
		});
	});

	describe("generated normals are angle-weighted", () => {
		// a unit cube as six QUADS — the shape that exposes fan bias, since
		// fan-triangulating a quad hands its pivot corners two triangles'
		// worth of one face and the others only one
		const CUBE = [
			"v -1 -1 -1",
			"v 1 -1 -1",
			"v 1 1 -1",
			"v -1 1 -1",
			"v -1 -1 1",
			"v 1 -1 1",
			"v 1 1 1",
			"v -1 1 1",
			"f 1 4 3 2",
			"f 5 6 7 8",
			"f 1 2 6 5",
			"f 2 3 7 6",
			"f 3 4 8 7",
			"f 4 1 5 8",
		];

		it("every corner of a quad-built cube points along its own diagonal", () => {
			// area weighting gives (1, 0.5, 0.5) at a corner instead of
			// (1, 1, 1) — 19.5 degrees off, and asymmetric on a symmetric model
			const data = parse(CUBE);
			const inv = 1 / Math.sqrt(3);
			for (let i = 0; i < data.vertexCount; i++) {
				const at = i * 3;
				const expected = [
					Math.sign(data.vertices[at]) * inv,
					Math.sign(data.vertices[at + 1]) * inv,
					Math.sign(data.vertices[at + 2]) * inv,
				];
				const dot =
					data.normals[at] * expected[0] +
					data.normals[at + 1] * expected[1] +
					data.normals[at + 2] * expected[2];
				// within a degree of the exact diagonal
				expect(Math.acos(Math.min(1, dot)) * (180 / Math.PI)).toBeLessThan(1);
			}
		});

		it("is unaffected by how the polygon was triangulated", () => {
			// the same cube authored as triangles must shade identically
			const quads = parse(CUBE);
			const tris = parse([
				...CUBE.slice(0, 8),
				"f 1 4 3",
				"f 1 3 2",
				"f 5 6 7",
				"f 5 7 8",
				"f 1 2 6",
				"f 1 6 5",
				"f 2 3 7",
				"f 2 7 6",
				"f 3 4 8",
				"f 3 8 7",
				"f 4 1 5",
				"f 4 5 8",
			]);
			for (let i = 0; i < quads.normals.length; i++) {
				expect(tris.normals[i]).toBeCloseTo(quads.normals[i], 5);
			}
		});

		it("stay smooth across a `usemtl` boundary", () => {
			// generation accumulates per SOURCE POSITION: the per-material
			// dedup scope splits one corner into several unified vertices, and
			// accumulating per unified vertex creased the model at every
			// material seam
			const data = parse([
				...CUBE.slice(0, 8),
				"usemtl a",
				"f 1 4 3 2",
				"f 5 6 7 8",
				"f 1 2 6 5",
				"usemtl b",
				"f 2 3 7 6",
				"f 3 4 8 7",
				"f 4 1 5 8",
			]);
			// find the unified vertices sharing one corner position
			const seen = new Map();
			for (let i = 0; i < data.vertexCount; i++) {
				const at = i * 3;
				const key = `${data.vertices[at]}|${data.vertices[at + 1]}|${data.vertices[at + 2]}`;
				const previous = seen.get(key);
				if (previous !== undefined) {
					expect(data.normals[at]).toBeCloseTo(data.normals[previous], 5);
					expect(data.normals[at + 1]).toBeCloseTo(
						data.normals[previous + 1],
						5,
					);
					expect(data.normals[at + 2]).toBeCloseTo(
						data.normals[previous + 2],
						5,
					);
				} else {
					seen.set(key, at);
				}
			}
			// the fixture must actually produce the duplicates it is testing
			expect(seen.size).toBeLessThan(data.vertexCount);
		});
	});

	describe("index buffer width", () => {
		it("widens to Uint32 when normal splitting pushes past 65 536 vertices", () => {
			// REGRESSION: splitting a position per distinct normal can treble
			// a flat-shaded model's unified vertex count. A hard-coded Uint16
			// index buffer then wraps mod 65 536 in silence, stitching the tail
			// of the model to its head.
			const lines = [];
			const side = 150;
			for (let y = 0; y <= side; y++) {
				for (let x = 0; x <= side; x++) {
					lines.push(`v ${x} ${y} 0`);
				}
			}
			// one distinct normal per quad, so every corner splits
			const stride = side + 1;
			const faces = [];
			for (let y = 0; y < side; y++) {
				for (let x = 0; x < side; x++) {
					const n = y * side + x + 1;
					lines.push(`vn 0 0 ${1 + n * 1e-6}`);
					const a = y * stride + x + 1;
					faces.push(`f ${a}//${n} ${a + 1}//${n} ${a + stride}//${n}`);
				}
			}
			const data = parse([...lines, ...faces]);

			expect(data.vertexCount).toBeGreaterThan(65536);
			expect(data.indices).toBeInstanceOf(Uint32Array);
			let max = 0;
			for (let i = 0; i < data.indices.length; i++) {
				max = Math.max(max, data.indices[i]);
			}
			// every index still addresses a real vertex
			expect(max).toBe(data.vertexCount - 1);
		});

		it("stays Uint16 for an ordinary model", () => {
			const data = parse([...QUAD, "vn 0 0 1", "f 1/1/1 2/2/1 3/3/1"]);
			expect(data.indices).toBeInstanceOf(Uint16Array);
		});
	});
});
