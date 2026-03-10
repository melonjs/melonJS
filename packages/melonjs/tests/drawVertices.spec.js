import { describe, expect, it } from "vitest";
import VertexArrayBuffer from "../src/video/webgl/buffer/vertex.js";

describe("drawVertices regression", () => {
	// The primitive compositor's vertexSize is 3 (x, y, color packed into 3 floats)
	// and objSize is 1 (one vertex per "object")
	const VERTEX_SIZE = 3;
	const OBJ_SIZE = 1;

	/**
	 * Simulates drawVertices logic (identity matrix path).
	 * After the fix, this should use a for loop respecting vertexCount.
	 */
	function drawVertices(vertexData, verts, vertexCount = verts.length) {
		for (let i = 0; i < vertexCount; i++) {
			const vert = verts[i];
			vertexData.push(vert.x, vert.y, undefined, undefined, 0xffffffff);
		}
	}

	it("should push all vertices when vertexCount is not specified", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 20 },
		];

		drawVertices(vertexData, verts);

		expect(vertexData.vertexCount).toBe(3);
	});

	it("should only push vertexCount vertices when specified", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 20 },
			{ x: 30, y: 30 },
			{ x: 40, y: 40 },
		];

		drawVertices(vertexData, verts, 3);

		expect(vertexData.vertexCount).toBe(3);
	});

	it("should write correct vertex data for the specified count", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 100, y: 200 },
			{ x: 300, y: 400 },
			{ x: 500, y: 600 }, // should NOT be pushed
		];

		drawVertices(vertexData, verts, 2);

		expect(vertexData.vertexCount).toBe(2);

		const f32 = vertexData.toFloat32();
		expect(f32[0]).toBe(100);
		expect(f32[1]).toBe(200);
		expect(f32[VERTEX_SIZE]).toBe(300);
		expect(f32[VERTEX_SIZE + 1]).toBe(400);
		// third vertex slot should be untouched
		expect(f32[VERTEX_SIZE * 2]).toBe(0);
		expect(f32[VERTEX_SIZE * 2 + 1]).toBe(0);
	});

	it("isFull check should be consistent with actual vertices pushed", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 20 },
			{ x: 30, y: 30 },
			{ x: 40, y: 40 },
		];

		const vertexCount = 3;
		const needsFlush = vertexData.isFull(vertexCount);
		expect(needsFlush).toBe(false);

		drawVertices(vertexData, verts, vertexCount);

		// The number of vertices actually pushed must match what isFull checked
		expect(vertexData.vertexCount).toBe(vertexCount);
	});
});
