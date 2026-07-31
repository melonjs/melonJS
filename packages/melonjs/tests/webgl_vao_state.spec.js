import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video, WebGLRenderer } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * VAO (vertex state) isolation — every batcher owns one immutable Vertex
 * Array Object built at init, capturing its frozen vertex buffer layout
 * (the engine's `GPUVertexState` analogue, #1509). These specs pin the
 * frozen state via GL readback: strides, enabled flags, per-attribute
 * buffer attachment (shared renderer buffer vs the batcher's own), and
 * the element binding travelling with the VAO across switches.
 */
describe("WebGL vertex state (VAO) isolation", () => {
	let renderer;
	let gl;
	let isWebGL;

	// (batcher name → expected stride in bytes)
	const STRIDES = {
		quad: 28,
		litQuad: 32,
		primitive: 24,
		mesh: 36,
		litMesh: 48,
	};

	beforeAll(async () => {
		boot();
		await getWebGLRenderer(160, 120);
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		// hand the shared context back and reset renderer state so the next
		// spec file does not inherit ours
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("each batcher owns a distinct, valid vertex state", (ctx) => {
		requireWebGL(ctx);
		const seen = new Set();
		for (const [name, batcher] of renderer.batchers) {
			expect(gl.isVertexArray(batcher.vertexState.handle), name).toBe(true);
			expect(seen.has(batcher.vertexState.handle), name).toBe(false);
			seen.add(batcher.vertexState.handle);
		}
	});

	it("setBatcher binds the batcher's own vertex state", (ctx) => {
		requireWebGL(ctx);
		for (const name of Object.keys(STRIDES)) {
			renderer.setBatcher(name);
			expect(gl.getParameter(gl.VERTEX_ARRAY_BINDING)).toBe(
				renderer.batchers.get(name).vertexState.handle,
			);
		}
	});

	it("the frozen layout is readable back per batcher: stride, enabled, buffer attachment", (ctx) => {
		requireWebGL(ctx);
		for (const [name, expectedStride] of Object.entries(STRIDES)) {
			const batcher = renderer.batchers.get(name);
			renderer.setBatcher(name);
			const expectedBuffer = batcher.glVertexBuffer ?? renderer.vertexBuffer;
			for (const attr of batcher.attributes) {
				const loc = batcher.defaultShader.getAttribLocation(attr.name);
				if (loc === -1) {
					continue;
				}
				const label = `${name}.${attr.name}`;
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED),
					label,
				).toBe(true);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
					label,
				).toBe(expectedStride);
				expect(
					gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
					label,
				).toBe(expectedBuffer);
			}
		}
	});

	it("the element-buffer binding travels with the vertex state across switches", (ctx) => {
		requireWebGL(ctx);
		// quad (static index pattern) → primitive (none) → mesh (dynamic)
		renderer.setBatcher("quad");
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
			renderer.batchers.get("quad").indexBuffer.buffer,
		);
		renderer.setBatcher("primitive");
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(null);
		renderer.setBatcher("mesh");
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
			renderer.batchers.get("mesh").indexBuffer.buffer,
		);
		// and back — the quad VAO still remembers its own
		renderer.setBatcher("quad");
		expect(gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING)).toBe(
			renderer.batchers.get("quad").indexBuffer.buffer,
		);
	});

	it("a mixed-layout frame leaves no GL error", (ctx) => {
		requireWebGL(ctx);
		const tex = document.createElement("canvas");
		tex.width = tex.height = 16;
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.strokeRect(4, 4, 30, 20);
		renderer.drawImage(tex, 0, 0, 16, 16, 32, 32, 16, 16);
		renderer.flush();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("addAttribute throws once the vertex state is frozen", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		expect(() => {
			quad.addAttribute("aLate", 1, gl.FLOAT, false, 28);
		}).toThrow(/frozen/);
	});
});
