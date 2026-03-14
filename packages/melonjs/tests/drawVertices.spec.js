import { describe, expect, it } from "vitest";
import VertexArrayBuffer from "../src/video/webgl/buffer/vertex.js";

describe("VertexArrayBuffer", () => {
	const VERTEX_SIZE = 5; // x, y, u/nx, v/ny, tint

	it("should initialize with correct state", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		expect(vab.vertexSize).toBe(VERTEX_SIZE);
		expect(vab.maxVertex).toBe(256);
		expect(vab.vertexCount).toBe(0);
		expect(vab.bufferF32).toBeInstanceOf(Float32Array);
		expect(vab.bufferU32).toBeInstanceOf(Uint32Array);
		// both views share the same underlying buffer
		expect(vab.bufferF32.buffer).toBe(vab.bufferU32.buffer);
	});

	it("should allocate correct buffer size", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		// 256 vertices * 5 floats * 4 bytes = 5120 bytes
		expect(vab.buffer.byteLength).toBe(256 * VERTEX_SIZE * 4);
	});

	it("should push vertices and increment count", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		vab.push(10, 20, 0.5, 0.5, 0xffffffff);
		expect(vab.vertexCount).toBe(1);

		vab.push(30, 40, 0.0, 1.0, 0xff00ff00);
		expect(vab.vertexCount).toBe(2);
	});

	it("should store correct float data", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		vab.push(100, 200, 0.25, 0.75, 0xffffffff);

		const f32 = vab.toFloat32();
		expect(f32[0]).toBe(100);
		expect(f32[1]).toBe(200);
		expect(f32[2]).toBe(0.25);
		expect(f32[3]).toBe(0.75);
	});

	it("should store tint as Uint32 in the correct offset", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const tint = 0xaabbccdd;
		vab.push(0, 0, 0, 0, tint);

		const u32 = vab.toUint32();
		expect(u32[4]).toBe(tint);
	});

	it("should write sequential vertices at correct offsets", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		vab.push(1, 2, 3, 4, 0x11111111);
		vab.push(5, 6, 7, 8, 0x22222222);

		const f32 = vab.toFloat32();
		// second vertex starts at offset VERTEX_SIZE
		expect(f32[VERTEX_SIZE]).toBe(5);
		expect(f32[VERTEX_SIZE + 1]).toBe(6);
		expect(f32[VERTEX_SIZE + 2]).toBe(7);
		expect(f32[VERTEX_SIZE + 3]).toBe(8);
	});

	it("clear should reset vertex count but not deallocate", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		vab.push(1, 2, 3, 4, 0xffffffff);
		vab.push(5, 6, 7, 8, 0xffffffff);
		expect(vab.vertexCount).toBe(2);

		const bufferRef = vab.buffer;
		vab.clear();
		expect(vab.vertexCount).toBe(0);
		expect(vab.buffer).toBe(bufferRef); // same buffer
	});

	it("isFull should return true when adding vertices would exceed capacity", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 64);
		expect(vab.isFull(64)).toBe(true); // exactly at limit
		expect(vab.isFull(63)).toBe(false);
		expect(vab.isFull(1)).toBe(false);

		// fill up most of the buffer
		for (let i = 0; i < 60; i++) {
			vab.push(i, i, 0, 0, 0xffffffff);
		}
		expect(vab.isFull(4)).toBe(true); // 60 + 4 >= 64
		expect(vab.isFull(3)).toBe(false); // 60 + 3 < 64
	});

	it("should accept a custom maxVertex size", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 128);
		expect(vab.maxVertex).toBe(128);
		expect(vab.buffer.byteLength).toBe(128 * VERTEX_SIZE * 4);
	});

	it("toFloat32 with subarray range", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		vab.push(10, 20, 0, 0, 0xffffffff);
		vab.push(30, 40, 0, 0, 0xffffffff);

		const sub = vab.toFloat32(0, VERTEX_SIZE);
		expect(sub.length).toBe(VERTEX_SIZE);
		expect(sub[0]).toBe(10);
		expect(sub[1]).toBe(20);
	});

	it("toUint32 with subarray range", () => {
		const vab = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const tint1 = 0xaabbccdd;
		const tint2 = 0x11223344;
		vab.push(0, 0, 0, 0, tint1);
		vab.push(0, 0, 0, 0, tint2);

		const sub = vab.toUint32(VERTEX_SIZE, VERTEX_SIZE * 2);
		expect(sub[4]).toBe(tint2);
	});
});

describe("drawVertices regression", () => {
	const VERTEX_SIZE = 5;

	function drawVertices(vertexData, verts, vertexCount = verts.length) {
		for (let i = 0; i < vertexCount; i++) {
			const vert = verts[i];
			vertexData.push(vert.x, vert.y, 0, 0, 0xffffffff);
		}
	}

	it("should push all vertices when vertexCount is not specified", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
			{ x: 20, y: 20 },
		];

		drawVertices(vertexData, verts);

		expect(vertexData.vertexCount).toBe(3);
	});

	it("should only push vertexCount vertices when specified", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
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
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
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
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
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

		expect(vertexData.vertexCount).toBe(vertexCount);
	});
});

describe("lineWidth expansion", () => {
	const VERTEX_SIZE = 5;

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

			vertexData.push(from.x, from.y, nx, ny, 0xffffffff);
			vertexData.push(from.x, from.y, -nx, -ny, 0xffffffff);
			vertexData.push(to.x, to.y, -nx, -ny, 0xffffffff);

			vertexData.push(from.x, from.y, nx, ny, 0xffffffff);
			vertexData.push(to.x, to.y, -nx, -ny, 0xffffffff);
			vertexData.push(to.x, to.y, nx, ny, 0xffffffff);
		}
	}

	it("should expand one line pair into 6 vertices (2 triangles)", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		expect(vertexData.vertexCount).toBe(6);
	});

	it("should expand multiple line pairs independently", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		];

		expandLinesToTriangles(vertexData, verts, 4);

		expect(vertexData.vertexCount).toBe(12);
	});

	it("should skip zero-length line segments", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const verts = [
			{ x: 5, y: 5 },
			{ x: 5, y: 5 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		expect(vertexData.vertexCount).toBe(0);
	});

	it("should produce unit normals perpendicular to a horizontal line", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		const f32 = vertexData.toFloat32();
		expect(f32[2]).toBeCloseTo(0);
		expect(f32[3]).toBeCloseTo(1);
		expect(f32[VERTEX_SIZE + 2]).toBeCloseTo(0);
		expect(f32[VERTEX_SIZE + 3]).toBeCloseTo(-1);
	});

	it("should produce unit normals perpendicular to a vertical line", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const verts = [
			{ x: 0, y: 0 },
			{ x: 0, y: 10 },
		];

		expandLinesToTriangles(vertexData, verts, 2);

		const f32 = vertexData.toFloat32();
		expect(f32[2]).toBeCloseTo(-1);
		expect(f32[3]).toBeCloseTo(0);
	});

	it("should produce unit-length normals for a diagonal line", () => {
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
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
		const vertexData = new VertexArrayBuffer(VERTEX_SIZE, 256);
		const vert = { x: 42, y: 84 };

		vertexData.push(vert.x, vert.y, 0, 0, 0xffffffff);

		const f32 = vertexData.toFloat32();
		expect(f32[0]).toBe(42);
		expect(f32[1]).toBe(84);
		expect(f32[2]).toBe(0);
		expect(f32[3]).toBe(0);
	});
});
