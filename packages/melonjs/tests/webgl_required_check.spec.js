import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, Camera3d, device } from "../src/index.js";
import * as video from "../src/video/video.js";

/**
 * Issue #1479 — Application fails loudly when the engine can't satisfy the
 * user's renderer / camera requirements, instead of silently rendering a
 * broken scene.
 *
 * Two checks, both in `Application` (Camera3d stays pure-math, Stage
 * untouched — the user's `cameraClass` setting is an Application-level
 * concern):
 *
 * - `{ renderer: video.WEBGL }` throws when WebGL is unavailable. Pre-fix,
 *   `video.WEBGL` went through the same `autoDetectRenderer` path as
 *   `AUTO` and silently fell back to Canvas. `video.AUTO` keeps the
 *   silent-fallback semantics on purpose.
 *
 * - `{ cameraClass: Camera3d }` (or any subclass declaring
 *   `static defaultSortOn = "depth"`) emits a `console.warn` when the
 *   active renderer isn't a `WebGLRenderer`. Warn (not throw) so
 *   unit-level integration tests for the `cameraClass → world.sortOn`
 *   bootstrap wiring can run under Canvas without crashing — the strong
 *   user-facing signal is to set `renderer: video.WEBGL` and get the
 *   throw above when WebGL isn't available. Uses `defaultSortOn` so
 *   Application doesn't need to import the concrete `Camera3d` class.
 */
describe("Application: WebGL requirements fail loudly (#1479)", () => {
	/** every Application a test builds, torn down in afterEach */
	const built = [];

	/**
	 * Construct an Application and register it for teardown.
	 * @param {object} settings - Application settings
	 * @returns {Application} the tracked instance
	 */
	const make = (settings) => {
		const app = new Application(64, 64, settings);
		built.push(app);
		return app;
	};

	beforeAll(async () => {
		await boot();
	});

	afterEach(() => {
		// Tear down every Application a test built.
		//
		// This used to "reset the video subsystem" by constructing YET ANOTHER
		// Application per test and leaving it live, so a file with 8 tests ended
		// up holding ~18 applications, each with its own canvas and (for the
		// WebGL ones) its own GL context, none of them released. Spec files are
		// page-isolated so it could not leak into other files, but it was real
		// pressure inside this one, on a CI runner whose GL is a software
		// rasterizer.
		//
		// Since 20.0 `destroy()` is the honest reset: it releases the GL context
		// through WEBGL_lose_context and unregisters the renderer's event
		// handlers. A destroyed Application is terminal, which is fine here
		// because every test constructs its own.
		for (const app of built.splice(0)) {
			try {
				app.destroy();
			} catch {
				// a test may have left it half-built on purpose (the throwing
				// and rejecting paths below); nothing to release in that case
			}
		}
	});

	describe("renderer: video.WEBGL", () => {
		it("throws with a useful message when WebGL is unavailable", async (ctx) => {
			// `failIfMajorPerformanceCaveat: true` makes WebGL context
			// creation fail in headless chromium without GPU flags. On
			// environments where WebGL is hardware-backed and works
			// regardless, the Application succeeds → skip; the throw
			// path is exercised wherever WebGL genuinely fails.
			try {
				const app = make({
					parent: "screen",
					renderer: video.WEBGL,
					failIfMajorPerformanceCaveat: true,
				});
				await app.init();
				ctx.skip("WebGL is available in this environment");
				return;
			} catch (err) {
				expect(err.message).toMatch(/WebGL 2/);
				expect(err.message).toMatch(/video\.AUTO/);
			}
		});

		it("isWebGLSupported() and WEBGL construction agree (WebGL2-only contract)", async () => {
			// The 20.0 invariant: the support gate probes the same context
			// ("webgl2") that construction requests, so the two can never
			// disagree — pre-20.0 the gate probed WebGL 1 while construction
			// preferred WebGL 2.
			if (device.isWebGLSupported()) {
				const app = make({
					parent: "screen",
					renderer: video.WEBGL,
					consoleHeader: false,
				});
				await app.init();
				expect(app.renderer.WebGLVersion).toBe(2);
				expect(app.renderer.type).toBe("WebGL2");
				expect(app.renderer.gl).toBeInstanceOf(
					globalThis.WebGL2RenderingContext,
				);
			} else {
				const app = make({
					parent: "screen",
					renderer: video.WEBGL,
					consoleHeader: false,
				});
				// the throw moved from the constructor into `init()` with the
				// constructor/init split, so it surfaces as a rejection
				await expect(app.init()).rejects.toThrow(/WebGL 2/);
			}
		});

		it("renderer: video.AUTO falls back to Canvas silently (preserved behaviour)", async () => {
			// AUTO is the documented fallback path. The same conditions
			// that make `video.WEBGL` throw must NOT cause AUTO to reject.
			const app = make({
				parent: "screen",
				renderer: video.AUTO,
				failIfMajorPerformanceCaveat: true,
			});
			await expect(app.init()).resolves.toBeUndefined();
		});
	});

	describe("cameraClass requires WebGL", () => {
		let warnSpy;
		afterEach(() => {
			warnSpy?.mockRestore();
		});

		// Other engine paths can emit unrelated warnings during Canvas
		// Application setup (e.g. `gpuTilemap is enabled but the active
		// renderer has no GPU tile-layer support`), so each test scans all warn calls
		// for our specific Camera3d-mismatch message rather than asserting
		// total call counts.
		const findCamera3dWarn = () => {
			return warnSpy.mock.calls
				.map((args) => {
					return String(args[0] ?? "");
				})
				.find((msg) => {
					// match on the contract (the setting being complained
					// about), not on the prose — the wording moved once
					// already when the check switched from an `instanceof`
					// test to the `supportsDepthBuffer` capability flag
					return /defaultSortOn/.test(msg);
				});
		};

		it("warns when cameraClass is Camera3d but renderer is Canvas", async () => {
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const app = make({
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			await app.init();
			const msg = findCamera3dWarn();
			expect(msg).toBeDefined();
			expect(msg).toMatch(/Camera3d|depth/);
		});

		it("warn message points the user at video.WEBGL", async () => {
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const app = make({
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			await app.init();
			expect(findCamera3dWarn()).toMatch(/video\.WEBGL/);
		});

		it("subclass of Camera3d (inheriting defaultSortOn='depth') also warns on Canvas", async () => {
			class MyCamera3d extends Camera3d {}
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const app = make({
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: MyCamera3d,
			});
			await app.init();
			expect(findCamera3dWarn()).toBeDefined();
		});

		it("cameraClass without 'depth' sortOn is silent under Canvas (no false positive)", async () => {
			class MyCam2d {
				static defaultSortOn = "z";
			}
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const app = make({
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: MyCam2d,
			});
			await app.init();
			expect(findCamera3dWarn()).toBeUndefined();
		});

		it("no cameraClass setting + Canvas renderer is silent (legacy default)", async () => {
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const app = make({
				parent: "screen",
				renderer: video.CANVAS,
			});
			await app.init();
			expect(findCamera3dWarn()).toBeUndefined();
		});
	});
});
