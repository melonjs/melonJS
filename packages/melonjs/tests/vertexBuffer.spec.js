import { describe, expect, it } from "vitest";
import VertexArrayBuffer from "../src/video/webgl/buffer/vertex.js";

describe("VertexArrayBuffer", () => {
	describe("push()", () => {
		it("should write vertex data at the correct offsets", () => {
			// vertexSize=5 matches the quad format: x, y, u, v, tint
			const buf = new VertexArrayBuffer(5, 4);

			buf.push(10, 20, 0.0, 1.0, 0xffffffff);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10); // x
			expect(buf.bufferF32[1]).toBe(20); // y
			expect(buf.bufferF32[2]).toBe(0.0); // u
			expect(buf.bufferF32[3]).toBe(1.0); // v
			expect(buf.bufferU32[4]).toBe(0xffffffff); // tint
		});

		it("should write multiple vertices sequentially", () => {
			const buf = new VertexArrayBuffer(5, 4);

			buf.push(1, 2, 0.0, 0.0, 0xff000000);
			buf.push(3, 4, 1.0, 1.0, 0x00ff0000);

			expect(buf.vertexCount).toBe(2);
			// second vertex starts at offset 5
			expect(buf.bufferF32[5]).toBe(3); // x
			expect(buf.bufferF32[6]).toBe(4); // y
			expect(buf.bufferF32[7]).toBe(1.0); // u
			expect(buf.bufferF32[8]).toBe(1.0); // v
			expect(buf.bufferU32[9]).toBe(0x00ff0000); // tint
		});
	});

	describe("pushFloats()", () => {
		it("should copy float data for a single vertex", () => {
			const buf = new VertexArrayBuffer(4, 4);
			const data = new Float32Array([10, 20, 0.5, 0.5]);

			buf.pushFloats(data, 0, 4);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10);
			expect(buf.bufferF32[1]).toBe(20);
			expect(buf.bufferF32[2]).toBe(0.5);
			expect(buf.bufferF32[3]).toBe(0.5);
		});

		it("should copy from a source offset", () => {
			const buf = new VertexArrayBuffer(3, 4);
			const data = new Float32Array([99, 99, 99, 1, 2, 3]);

			buf.pushFloats(data, 3, 3);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(1);
			expect(buf.bufferF32[1]).toBe(2);
			expect(buf.bufferF32[2]).toBe(3);
		});
	});

	describe("isFull()", () => {
		it("should return true when adding vertices would exceed capacity", () => {
			const buf = new VertexArrayBuffer(5, 2);

			expect(buf.isFull(2)).toBe(true);
			expect(buf.isFull(1)).toBe(false);

			buf.push(0, 0, 0, 0, 0);
			expect(buf.isFull(1)).toBe(true);
		});
	});

	describe("clear()", () => {
		it("should reset vertex count to zero", () => {
			const buf = new VertexArrayBuffer(5, 4);

			buf.push(1, 2, 3, 4, 0);
			expect(buf.vertexCount).toBe(1);

			buf.clear();
			expect(buf.vertexCount).toBe(0);
		});
	});
});
