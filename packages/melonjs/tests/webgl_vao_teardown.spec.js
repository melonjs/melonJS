import { beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video, WebGLRenderer } from "../src/index.js";

/**
 * GL resource teardown (#1509): every object a batcher creates — its
 * vertex state, its own vertex/index buffers, its default shader — must be
 * released when the renderer is destroyed, and the renderer's shared
 * vertex buffer with it. Without this, an app that tears down and rebuilds
 * Applications against a surviving context accumulates GL objects.
 */
describe("WebGL batcher teardown releases GL objects", () => {
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		isWebGL = video.renderer instanceof WebGLRenderer;
	});

	const requireWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("Application.destroy() deletes every batcher's vertex state and buffers", (ctx) => {
		requireWebGL(ctx);
		const app = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		const renderer = app.renderer;
		const gl = renderer.gl;

		// snapshot the GL objects the renderer owns before teardown
		const owned = [];
		for (const [name, batcher] of renderer.batchers) {
			owned.push({ name, kind: "vao", handle: batcher.vertexState.handle });
			if (batcher.glVertexBuffer) {
				owned.push({ name, kind: "vbo", handle: batcher.glVertexBuffer });
			}
			if (batcher.indexBuffer) {
				owned.push({ name, kind: "ibo", handle: batcher.indexBuffer.buffer });
			}
		}
		const sharedBuffer = renderer.vertexBuffer;
		expect(owned.length).toBeGreaterThan(5);
		for (const o of owned) {
			const live =
				o.kind === "vao" ? gl.isVertexArray(o.handle) : gl.isBuffer(o.handle);
			expect(live, `${o.name}.${o.kind} live before destroy`).toBe(true);
		}

		app.destroy();

		for (const o of owned) {
			const live =
				o.kind === "vao" ? gl.isVertexArray(o.handle) : gl.isBuffer(o.handle);
			expect(live, `${o.name}.${o.kind} released after destroy`).toBe(false);
		}
		expect(gl.isBuffer(sharedBuffer), "shared vertex buffer released").toBe(
			false,
		);
		expect(renderer.vertexBuffer).toBe(null);
	});

	it("destroy() is idempotent and does not queue GL errors", (ctx) => {
		requireWebGL(ctx);
		const app = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		const gl = app.renderer.gl;
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}
		app.destroy();
		app.renderer.destroy();
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});
});
