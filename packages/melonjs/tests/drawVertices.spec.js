import { describe, expect, it } from "vitest";
import VertexArrayBuffer from "../src/video/webgl/buffer/vertex.js";

describe("drawVertices regression", () => {
	// The primitive compositor's vertexSize is 5 (x, y, nx, ny, color packed into 5 floats)
	// and objSize is 1 (one vertex per "object")
	const VERTEX_SIZE = 5;
	const OBJ_SIZE = 1;

	/**
	 * Simulates drawVertices logic (identity matrix path, lineWidth=1).
	 * Normals are (0, 0) for non-expanded vertices.
	 */
	function drawVertices(vertexData, verts, vertexCount = verts.length) {
		for (let i = 0; i < vertexCount; i++) {
			const vert = verts[i];
			vertexData.push(vert.x, vert.y, 0, 0, 0xffffffff);
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

describe("lineWidth expansion", () => {
	// Primitive compositor vertex size: x, y, nx, ny, color
	const VERTEX_SIZE = 5;
	const OBJ_SIZE = 1;

	/**
	 * Simulates the #expandLinesToTriangles logic from PrimitiveCompositor.
	 * Takes line pairs and expands them into triangle quads with perpendicular normals.
	 */
	function expandLinesToTriangles(vertexData, verts, vertexCount) {
		for (let i = 0; i < vertexCount; i += 2) {
			const from = verts[i];
			const to = verts[i + 1];

			const dx = to.x - from.x;
			const dy = to.y - from.y;
			const len = Math.sqrt(dx * dx + dy * dy);

			if (len === 0) {
				continue;
			}

			const nx = -dy / len;
			const ny = dx / len;

			// triangle 1: from+n, from-n, to-n
			vertexData.push(from.x, from.y, nx, ny, 0xffffffff);
			vertexData.push(from.x, from.y, -nx, -ny, 0xffffffff);
			vertexData.push(to.x, to.y, -nx, -ny, 0xffffffff);

			// triangle 2: from+n, to-n, to+n
			vertexData.push(from.x, from.y, nx, ny, 0xffffffff);
			vertexData.push(to.x, to.y, -nx, -ny, 0xffffffff);
			vertexData.push(to.x, to.y, nx, ny, 0xffffffff);
		}
	}

	it("should expand one line pair into 6 vertices (2 triangles)", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		expect(vertexData.vertexCount).toBe(6);
	});

	it("should expand multiple line pairs independently", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		];

		expandLinesToTriangles(vertexData, verts, 4);

		// 2 line pairs * 6 vertices each = 12
		expect(vertexData.vertexCount).toBe(12);
	});

	it("should skip zero-length line segments", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 5, y: 5 },
			{ x: 5, y: 5 }, // zero length
		];

		expandLinesToTriangles(vertexData, verts, 2);

		expect(vertexData.vertexCount).toBe(0);
	});

	it("should produce unit normals perpendicular to a horizontal line", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		const f32 = vertexData.toFloat32();
		// For a horizontal line (dx=10, dy=0), normal should be (0, 1) and (0, -1)
		// vertex 0: from with +normal -> nx=0, ny=1
		expect(f32[2]).toBeCloseTo(0);
		expect(f32[3]).toBeCloseTo(1);
		// vertex 1: from with -normal -> nx=0, ny=-1
		expect(f32[VERTEX_SIZE + 2]).toBeCloseTo(0);
		expect(f32[VERTEX_SIZE + 3]).toBeCloseTo(-1);
	});

	it("should produce unit normals perpendicular to a vertical line", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 0, y: 10 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		const f32 = vertexData.toFloat32();
		// For a vertical line (dx=0, dy=10), normal should be (-1, 0) and (1, 0)
		// vertex 0: from with +normal -> nx=-1, ny=0
		expect(f32[2]).toBeCloseTo(-1);
		expect(f32[3]).toBeCloseTo(0);
	});

	it("should produce unit-length normals for a diagonal line", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		const f32 = vertexData.toFloat32();
		const nx = f32[2];
		const ny = f32[3];
		const normalLength = Math.sqrt(nx * nx + ny * ny);
		expect(normalLength).toBeCloseTo(1);
	});

	it("should store zero normals for non-expanded vertices", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, OBJ_SIZE);
		const vert = { x: 42, y: 84 };

		// Simulate drawVertices with lineWidth=1 (no expansion)
		vertexData.push(vert.x, vert.y, 0, 0, 0xffffffff);

		const f32 = vertexData.toFloat32();
		expect(f32[0]).toBe(42);
		expect(f32[1]).toBe(84);
		expect(f32[2]).toBe(0); // nx
		expect(f32[3]).toBe(0); // ny
	});
});
