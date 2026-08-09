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

	beforeAll(async () => {
		boot();
		const app = new Application(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
		isWebGL = app.renderer instanceof WebGLRenderer;
	});

	const requireWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("Application.destroy() deletes every batcher's vertex state and buffers", async (ctx) => {
		requireWebGL(ctx);
		const app = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		await app.init();
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

	it("destroy() releases the GL context, and is idempotent", async (ctx) => {
		requireWebGL(ctx);
		const app = new Application(48, 48, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		await app.init();
		const gl = app.renderer.gl;
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}

		app.destroy();

		// `destroy()` now hands the context back via `WEBGL_lose_context`.
		// Dropping the GL objects and removing the canvas from the DOM does
		// NOT do this on its own — the context survives until the canvas is
		// garbage-collected, and browsers force-lose the oldest once past
		// their live-context cap (~16 on Chromium). A page that builds and
		// tears down several applications therefore used to accumulate
		// dead-but-unfreed contexts until an unrelated later `getContext`
		// stalled. This assertion is what keeps that from regressing.
		expect(gl.isContextLost()).toBe(true);

		// still idempotent: a second teardown on the now-lost context must
		// not throw. GL calls on a lost context are no-ops by spec.
		expect(() => {
			app.renderer.destroy();
		}).not.toThrow();
	});
});

// NOTE — a "create/destroy N applications past the browser's context cap"
// test was written here and REMOVED, because it passed identically with and
// without the fix. On a machine with a real GPU the cap is never reached at
// any N a unit test can afford, and eviction does not surface as a
// newly-created context reporting `isContextLost()` — it surfaces as the
// OLDEST context dying, and as `getContext` getting slower, neither of which
// is assertable cheaply or deterministically. The `isContextLost()` check
// above is the honest regression guard: it fails without the fix and passes
// with it. Left as a comment so nobody re-derives the dead end.
