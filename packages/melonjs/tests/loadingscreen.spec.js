import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, event, video } from "../src/index.js";
import DefaultLoadingScreen from "../src/loader/loadingscreen.js";

/**
 * The built-in loading screen's lifecycle.
 *
 * It owns two things that used to be conflated: knowing the preloader has
 * finished, and taking itself off the screen. They are not the same moment,
 * and merging them is what made a `state.transition()` fade over an empty
 * world — the screen had already erased itself a beat earlier.
 */
describe("DefaultLoadingScreen", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	/**
	 * Bring a loading screen up on the application's world.
	 * @returns the stage, reset and drawn into `app.world`
	 */
	const mount = () => {
		const screen = new DefaultLoadingScreen();
		screen.reset(app);
		return screen;
	};

	/**
	 * Wait until `test()` holds, a few frames at most.
	 * @param {Function} test - the condition
	 * @returns {Promise<boolean>} whether it came true in time
	 */
	const until = async (test) => {
		for (let i = 0; i < 100 && !test(); i++) {
			await new Promise((resolve) => {
				setTimeout(resolve, 10);
			});
		}
		return test();
	};

	it("shows the bar and the logo together, once the logo is decoded", async () => {
		// The logo decodes a frame or so after the screen comes up. A bar put
		// on screen at once made the logo pop in after it; now neither shows
		// until both can.
		const screen = mount();
		try {
			const bar = screen.progressBar;
			expect(bar).toBeDefined();
			expect(app.world.hasChild(bar)).toBe(false);
			expect(screen.logoSprite).toBe(null);

			expect(
				await until(() => {
					return screen.logoSprite !== null;
				}),
			).toBe(true);
			expect(app.world.hasChild(screen.logoSprite)).toBe(true);
			expect(app.world.hasChild(bar)).toBe(true);
		} finally {
			screen.destroy(app);
		}
	});

	it("shows the bar alone when the logo cannot be decoded", async () => {
		const decode = vi
			.spyOn(globalThis, "createImageBitmap")
			.mockRejectedValue(new Error("cannot decode"));
		const screen = mount();
		try {
			const bar = screen.progressBar;
			expect(
				await until(() => {
					return app.world.hasChild(bar);
				}),
			).toBe(true);
			expect(screen.logoSprite).toBe(null);
		} finally {
			decode.mockRestore();
			screen.destroy(app);
		}
	});

	it("tracks the load before the bar is on screen", () => {
		const screen = mount();
		try {
			event.emit(event.LOADER_PROGRESS, 0.4);
			expect(screen.progressBar.value).toBe(0.4);
		} finally {
			screen.destroy(app);
		}
	});

	it("destroys a bar that was never shown, and its subscription with it", () => {
		// torn down before the logo or the assets came in: the bar never
		// reached the world, so the world will not destroy it
		const screen = mount();
		const bar = screen.progressBar;
		screen.destroy(app);
		event.emit(event.LOADER_PROGRESS, 0.7);
		expect(bar.value).toBe(0);
	});

	it("stays on screen after the preloader reports done", () => {
		// The regression. `LOADER_COMPLETE` fires when the ASSETS are in —
		// which is before the game has finished its own post-preload setup and
		// well before it calls `state.change()`. Tearing down here blanked the
		// screen for that whole gap, and left a transition nothing to cover:
		// the bar and logo vanished in one frame, a beat ahead of the fade that
		// was supposed to carry them out.
		const screen = mount();
		try {
			const bar = screen.progressBar;
			event.emit(event.LOADER_COMPLETE);
			expect(screen.progressBar).toBe(bar);
			expect(app.world.hasChild(bar)).toBe(true);
		} finally {
			screen.destroy(app);
		}
	});

	it("takes itself down when the stage is destroyed", () => {
		const screen = mount();
		event.emit(event.LOADER_COMPLETE);
		screen.destroy(app);
		// `removeChild` defers to the end of the frame, so the world is not
		// the thing to assert on synchronously — the stage dropping its own
		// handle is what says the teardown ran, and ran here rather than
		// back at LOADER_COMPLETE
		expect(screen.progressBar).toBe(null);
	});

	it("is torn down even if the state changes before the preloader finishes", () => {
		// `destroy` has to drop the LOADER_COMPLETE listener as well, or a
		// later load would call back into a stage that is already gone.
		const screen = mount();
		screen.destroy(app);
		expect(screen.progressBar).toBe(null);
		// must not resurrect anything, and must not throw
		expect(() => {
			event.emit(event.LOADER_COMPLETE);
		}).not.toThrow();
		expect(screen.progressBar).toBe(null);
	});

	it("does not add a logo that arrives after the preloader finished", async () => {
		// The 18.2.1 race, and the reason the LOADER_COMPLETE latch exists at
		// all: the logo image loads asynchronously and, since the promise-based
		// loader, can resolve AFTER the game's own assets do — so the sprite
		// was added to a world that had already moved on, with nobody left to
		// remove it. The latch is what fixes that; it must keep doing so now
		// that it no longer tears the screen down as a side effect.
		const screen = mount();
		try {
			event.emit(event.LOADER_COMPLETE);
			// give the logo's own load callback every chance to land
			await new Promise((resolve) => {
				setTimeout(resolve, 250);
			});
			expect(screen.logoSprite).toBe(null);
		} finally {
			screen.destroy(app);
		}
	});
});
