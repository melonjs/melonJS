import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, Camera3d } from "../src/index.js";
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
	beforeAll(async () => {
		await boot();
	});

	afterEach(() => {
		// Reset the video subsystem so each test starts in a clean state.
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
			});
		} catch {
			// best-effort reset
		}
	});

	describe("renderer: video.WEBGL", () => {
		it("throws with a useful message when WebGL is unavailable", (ctx) => {
			// `failIfMajorPerformanceCaveat: true` makes WebGL context
			// creation fail in headless chromium without GPU flags. On
			// environments where WebGL is hardware-backed and works
			// regardless, the Application succeeds → skip; the throw
			// path is exercised wherever WebGL genuinely fails.
			try {
				void new Application(64, 64, {
					parent: "screen",
					renderer: video.WEBGL,
					failIfMajorPerformanceCaveat: true,
				});
				ctx.skip("WebGL is available in this environment");
				return;
			} catch (err) {
				expect(err.message).toMatch(/WebGL/);
				expect(err.message).toMatch(/video\.AUTO/);
			}
		});

		it("renderer: video.AUTO falls back to Canvas silently (preserved behaviour)", () => {
			// AUTO is the documented fallback path. The same conditions
			// that make `video.WEBGL` throw must NOT cause AUTO to throw.
			expect(() => {
				void new Application(64, 64, {
					parent: "screen",
					renderer: video.AUTO,
					failIfMajorPerformanceCaveat: true,
				});
			}).not.toThrow();
		});
	});

	describe("cameraClass requires WebGL", () => {
		let warnSpy;
		afterEach(() => {
			warnSpy?.mockRestore();
		});

		// Other engine paths can emit unrelated warnings during Canvas
		// Application setup (e.g. `gpuTilemap is enabled but the active
		// renderer is not WebGL 2`), so each test scans all warn calls
		// for our specific Camera3d-mismatch message rather than asserting
		// total call counts.
		const findCamera3dWarn = () => {
			return warnSpy.mock.calls
				.map((args) => {
					return String(args[0] ?? "");
				})
				.find((msg) => {
					return /requires the WebGL renderer/.test(msg);
				});
		};

		it("warns when cameraClass is Camera3d but renderer is Canvas", () => {
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			void new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			const msg = findCamera3dWarn();
			expect(msg).toBeDefined();
			expect(msg).toMatch(/Camera3d|depth/);
		});

		it("warn message points the user at video.WEBGL", () => {
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			void new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: Camera3d,
			});
			expect(findCamera3dWarn()).toMatch(/video\.WEBGL/);
		});

		it("subclass of Camera3d (inheriting defaultSortOn='depth') also warns on Canvas", () => {
			class MyCamera3d extends Camera3d {}
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			void new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: MyCamera3d,
			});
			expect(findCamera3dWarn()).toBeDefined();
		});

		it("cameraClass without 'depth' sortOn is silent under Canvas (no false positive)", () => {
			class MyCam2d {
				static defaultSortOn = "z";
			}
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			void new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
				cameraClass: MyCam2d,
			});
			expect(findCamera3dWarn()).toBeUndefined();
		});

		it("no cameraClass setting + Canvas renderer is silent (legacy default)", () => {
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			void new Application(64, 64, {
				parent: "screen",
				renderer: video.CANVAS,
			});
			expect(findCamera3dWarn()).toBeUndefined();
		});
	});
});
