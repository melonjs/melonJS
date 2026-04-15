import { describe, expect, it } from "vitest";
import VertexArrayBuffer from "../src/video/webgl/buffer/vertex.js";
import { buildMultiTextureFragment } from "../src/video/webgl/shaders/multitexture.js";

describe("VertexArrayBuffer", () => {
	describe("push()", () => {
		it("should write vertex data at the correct offsets (5 floats)", () => {
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

		it("should write vertex data with textureId (6 floats)", () => {
			// vertexSize=6 matches the multi-texture quad format
			const buf = new VertexArrayBuffer(6, 4);

			buf.push(10, 20, 0.0, 1.0, 0xffffffff, 3);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10); // x
			expect(buf.bufferF32[1]).toBe(20); // y
			expect(buf.bufferF32[2]).toBe(0.0); // u
			expect(buf.bufferF32[3]).toBe(1.0); // v
			expect(buf.bufferU32[4]).toBe(0xffffffff); // tint
			expect(buf.bufferF32[5]).toBe(3); // textureId
		});

		it("should not write textureId when not provided", () => {
			const buf = new VertexArrayBuffer(6, 4);

			buf.push(10, 20, 0.0, 1.0, 0xffffffff);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[5]).toBe(0); // untouched (default zero)
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

		it("should write multiple vertices with textureId sequentially", () => {
			const buf = new VertexArrayBuffer(6, 4);

			buf.push(1, 2, 0.0, 0.0, 0xff000000, 0);
			buf.push(3, 4, 1.0, 1.0, 0x00ff0000, 5);

			expect(buf.vertexCount).toBe(2);
			expect(buf.bufferF32[5]).toBe(0); // textureId vertex 0
			expect(buf.bufferF32[11]).toBe(5); // textureId vertex 1
		});
	});

	describe("buildMultiTextureFragment()", () => {
		it("should generate correct number of sampler uniforms", () => {
			const src = buildMultiTextureFragment(4);
			expect(src).toContain("uniform sampler2D uSampler0;");
			expect(src).toContain("uniform sampler2D uSampler1;");
			expect(src).toContain("uniform sampler2D uSampler2;");
			expect(src).toContain("uniform sampler2D uSampler3;");
			expect(src).not.toContain("uSampler4");
		});

		it("should generate if/else chain with 0.5 thresholds", () => {
			const src = buildMultiTextureFragment(3);
			expect(src).toContain("if (vTextureId < 0.5)");
			expect(src).toContain("else if (vTextureId < 1.5)");
			expect(src).toContain("else if (vTextureId < 2.5)");
		});

		it("should include fallback to uSampler0", () => {
			const src = buildMultiTextureFragment(2);
			expect(src).toContain("} else {");
			expect(src).toContain("color = texture2D(uSampler0, vRegion);");
		});

		it("should generate a single sampler for maxTextures=1", () => {
			const src = buildMultiTextureFragment(1);
			expect(src).toContain("uniform sampler2D uSampler0;");
			expect(src).not.toContain("uSampler1");
			expect(src).toContain("if (vTextureId < 0.5)");
		});

		it("should include vColor multiplication", () => {
			const src = buildMultiTextureFragment(2);
			expect(src).toContain("gl_FragColor = color * vColor;");
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
