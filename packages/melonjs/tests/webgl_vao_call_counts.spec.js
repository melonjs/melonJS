import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, WebGLRenderer } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * The #1509 acceptance criterion, as measured GL call counts: with VAOs,
 * vertex-attribute specification happens exactly once per batcher at init
 * (19 pointer + 19 enable calls across the five default batchers:
 * quad 4 + litQuad 5 + primitive 3 + mesh 3 + litMesh 4), and steady-state
 * frames issue ZERO attribute-pointer calls — batcher switches cost a
 * single `bindVertexArray`.
 *
 * The GL context is spied by wrapping methods on the context object
 * (instance properties shadow the prototype).
 */
describe("WebGL VAO call counts (#1509 acceptance)", () => {
	let renderer;
	let gl;
	let isWebGL;
	const counts = {};

	function spy(name) {
		const original = gl[name].bind(gl);
		counts[name] = 0;
		gl[name] = (...args) => {
			counts[name]++;
			return original(...args);
		};
	}

	function resetCounts() {
		for (const key of Object.keys(counts)) {
			counts[key] = 0;
		}
	}

	beforeAll(async () => {
		boot();
		// spy BEFORE video.init so init-time calls are counted — the canvas
		// context doesn't exist yet, so instead spy right after context
		// creation by re-initializing the batchers via renderer.reset()
		renderer = await getWebGLRenderer(160, 120);
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
			for (const name of [
				"vertexAttribPointer",
				"enableVertexAttribArray",
				"disableVertexAttribArray",
				"bindVertexArray",
			]) {
				spy(name);
			}
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

	it("rebuilding all vertex states costs exactly 19 pointer + 19 enable calls", (ctx) => {
		requireWebGL(ctx);
		resetCounts();
		for (const batcher of renderer.batchers.values()) {
			batcher.createVertexState();
		}
		expect(counts.vertexAttribPointer).toBe(19);
		expect(counts.enableVertexAttribArray).toBe(19);
		expect(counts.disableVertexAttribArray).toBe(0);
	});

	it("a steady-state mixed frame issues ZERO attribute-specification calls", (ctx) => {
		requireWebGL(ctx);
		const tex = document.createElement("canvas");
		tex.width = tex.height = 16;
		// warm up (shader binds, texture upload)
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.strokeRect(0, 0, 10, 10);
		renderer.flush();

		resetCounts();
		// sprite → primitive → sprite → primitive with flushes — the
		// classic frame shape that used to re-specify attributes per switch
		for (let i = 0; i < 5; i++) {
			renderer.drawImage(tex, 0, 0, 16, 16, i, i, 16, 16);
			renderer.strokeRect(i, i, 10, 10);
		}
		renderer.flush();
		expect(counts.vertexAttribPointer).toBe(0);
		expect(counts.enableVertexAttribArray).toBe(0);
		expect(counts.disableVertexAttribArray).toBe(0);
	});

	it("100 alternating batcher switches cost ≤101 bindVertexArray and 0 pointer calls", (ctx) => {
		requireWebGL(ctx);
		resetCounts();
		for (let i = 0; i < 50; i++) {
			renderer.setBatcher("quad");
			renderer.setBatcher("primitive");
		}
		expect(counts.vertexAttribPointer).toBe(0);
		expect(counts.enableVertexAttribArray).toBe(0);
		expect(counts.bindVertexArray).toBeLessThanOrEqual(101);
	});
});
