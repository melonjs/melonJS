import { describe, expect, it } from "vitest";

/**
 * Tests for the quad index buffer pattern used by the QuadCompositor.
 * The IndexBuffer class itself needs a WebGL context, but we can verify
 * the index pattern logic that it generates.
 */

/**
 * Generates the same index pattern as IndexBuffer's constructor.
 * Each quad uses 4 vertices and 6 indices: [0,1,2, 2,1,3] per quad.
 */
function generateQuadIndices(maxQuads, useUint32 = false) {
	const data = useUint32
		? new Uint32Array(maxQuads * 6)
		: new Uint16Array(maxQuads * 6);

	for (let i = 0, vertex = 0; i < data.length; i += 6, vertex += 4) {
		data[i] = vertex;
		data[i + 1] = vertex + 1;
		data[i + 2] = vertex + 2;
		data[i + 3] = vertex + 2;
		data[i + 4] = vertex + 1;
		data[i + 5] = vertex + 3;
	}
	return data;
}

describe("Quad index buffer pattern", () => {
	it("should generate correct indices for a single quad", () => {
		const indices = generateQuadIndices(1);
		expect(indices.length).toBe(6);
		// two triangles: [0,1,2] and [2,1,3]
		expect([...indices]).toEqual([0, 1, 2, 2, 1, 3]);
	});

	it("should generate correct indices for multiple quads", () => {
		const indices = generateQuadIndices(3);
		expect(indices.length).toBe(18);
		expect([...indices]).toEqual([
			// quad 0: vertices 0-3
			0, 1, 2, 2, 1, 3,
			// quad 1: vertices 4-7
			4, 5, 6, 6, 5, 7,
			// quad 2: vertices 8-11
			8, 9, 10, 10, 9, 11,
		]);
	});

	it("should use Uint16Array by default", () => {
		const indices = generateQuadIndices(1);
		expect(indices).toBeInstanceOf(Uint16Array);
	});

	it("should use Uint32Array when useUint32 is true", () => {
		const indices = generateQuadIndices(1, true);
		expect(indices).toBeInstanceOf(Uint32Array);
	});

	it("each quad should reference exactly 4 unique vertices", () => {
		const indices = generateQuadIndices(4);
		for (let q = 0; q < 4; q++) {
			const offset = q * 6;
			const quadIndices = new Set();
			for (let i = 0; i < 6; i++) {
				quadIndices.add(indices[offset + i]);
			}
			// 6 indices but only 4 unique vertices per quad
			expect(quadIndices.size).toBe(4);
		}
	});

	it("vertex ranges should not overlap between quads", () => {
		const numQuads = 10;
		const indices = generateQuadIndices(numQuads);

		for (let q = 0; q < numQuads; q++) {
			const offset = q * 6;
			const baseVertex = q * 4;
			for (let i = 0; i < 6; i++) {
				const idx = indices[offset + i];
				expect(idx).toBeGreaterThanOrEqual(baseVertex);
				expect(idx).toBeLessThan(baseVertex + 4);
			}
		}
	});

	it("should form valid triangles (two per quad, sharing an edge)", () => {
		const indices = generateQuadIndices(2);

		// quad 0: triangle 1 = [0,1,2], triangle 2 = [2,1,3]
		// shared edge is vertices 1-2
		expect(indices[1]).toBe(indices[4]); // vertex 1 shared
		expect(indices[2]).toBe(indices[3]); // vertex 2 shared
	});

	it("should handle the default 1024-quad batch size (4096 verts / 4)", () => {
		const maxQuads = 4096 / 4; // 1024 quads
		const indices = generateQuadIndices(maxQuads);
		expect(indices.length).toBe(6144); // 1024 * 6

		// last quad should reference vertices 4092-4095
		const lastOffset = (maxQuads - 1) * 6;
		expect(indices[lastOffset]).toBe(4092);
		expect(indices[lastOffset + 5]).toBe(4095);
	});

	it("Uint16 should be sufficient for default batch size", () => {
		const maxQuads = 4096 / 4;
		const indices = generateQuadIndices(maxQuads);
		const maxIndex = indices[indices.length - 1]; // last index = highest vertex
		expect(maxIndex).toBeLessThan(65536); // Uint16 max
	});
});
