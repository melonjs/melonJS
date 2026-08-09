import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	CanvasRenderer,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Application create / destroy lifecycle.
 *
 * The failure this guards against is quiet: a renderer subscribes to global
 * events in its constructor, and if `destroy()` cannot unregister them the
 * handlers stay on the bus for the life of the page. Each closure captures
 * the renderer, so it pins the renderer, its batchers and its GPU objects
 * against garbage collection — and a destroyed renderer keeps reacting to
 * `GAME_RESET` / `CANVAS_ONRESIZE` long after its application is gone.
 *
 * Nothing about that is visible in a normal run; it surfaces as an unrelated
 * suite timing out much later, once enough teardowns have piled up. That is
 * exactly how it reached CI.
 *
 * ## What these can and cannot assert
 *
 * Two stronger tests were attempted and abandoned, recorded here so the dead
 * ends are not re-walked:
 *
 * 1. "destroy, then `emit(GAME_RESET)`, assert the dead renderer did not
 *    react". `emit` reaches EVERY listener in the shared browser session,
 *    including ones left behind by other spec files whose state is long gone,
 *    and throws partway through. Wrapping it in try/catch would let the test
 *    pass without ever reaching the handler under test — a silent pass.
 * 2. "spy on `event.off` and assert it was called with the registered
 *    handler". Vitest browser mode cannot spy on ESM exports (module
 *    namespaces are not configurable).
 *
 * So these assert the STRUCTURAL property that made the bug possible: the
 * handlers must be retrievable per-instance references, because an inline
 * anonymous arrow can never be passed to `off()` at all. That is necessary
 * but not sufficient — it would not catch a `destroy()` that simply forgot
 * to call `off`. A listener-count assertion would be strictly better and
 * needs a test-visible way to inspect the bus.
 */
describe("Application lifecycle: renderer event handlers are unregisterable", () => {
	let hasWebGL;

	beforeAll(async () => {
		await boot();
		const probe = new Application(32, 32, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		await probe.init();
		hasWebGL = probe.renderer instanceof WebGLRenderer;
		probe.destroy();
	});

	const mk = async (renderer) => {
		const app = new Application(64, 64, {
			parent: "screen",
			renderer,
			failIfMajorPerformanceCaveat: false,
			consoleHeader: false,
		});
		await app.init();
		return app;
	};

	it("CanvasRenderer defines destroy() and a retrievable GAME_RESET handler", async () => {
		const app = await mk(video.CANVAS);
		expect(app.renderer).toBeInstanceOf(CanvasRenderer);
		// CanvasRenderer had no destroy() at all — it inherited the base
		// no-op, so its GAME_RESET subscription outlived every application
		expect(
			Object.hasOwn(CanvasRenderer.prototype, "destroy"),
			"CanvasRenderer must define its own destroy()",
		).toBe(true);
		expect(typeof app.renderer.onGameReset).toBe("function");
		app.destroy();
	});

	it("WebGLRenderer exposes all three subscriptions as retrievable handlers", async (ctx) => {
		if (!hasWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
		const app = await mk(video.WEBGL);
		const r = app.renderer;
		// inline arrows here would be unremovable; these must be fields
		expect(typeof r.onGameReset).toBe("function");
		expect(typeof r.onContextRestoredInvalidate).toBe("function");
		expect(typeof r.onCanvasResize).toBe("function");
		app.destroy();
	});

	it("handlers are per-instance, so each teardown removes its own", async (ctx) => {
		if (!hasWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
		// Guards the drift case: were the handler shared on the prototype,
		// cycle N would unregister cycle 0's closure and leave every later
		// renderer on the bus.
		const seen = new Set();
		for (let i = 0; i < 6; i++) {
			const app = await mk(video.WEBGL);
			const handler = app.renderer.onGameReset;
			expect(seen.has(handler), `cycle ${i} reused a previous handler`).toBe(
				false,
			);
			seen.add(handler);
			app.destroy();
		}
		expect(seen.size).toBe(6);
	});
});
