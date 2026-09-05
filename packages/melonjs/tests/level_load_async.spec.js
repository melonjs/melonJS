import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	event,
	level,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";
import state from "../src/state/state.ts";

/**
 * `level.loadAsync()` and the scheduling behind `level.load()` (#1646).
 *
 * The deferral in `level.load()` dates to 2011 and used a timer because that
 * was the only way to defer at the time. It is still needed — `level.load()` is
 * routinely called from inside the loop, and `safeLoadLevel` resets and
 * destroys the very container the loop may be iterating — but it is now a
 * microtask, and the completion it produces is what `loadAsync()` hands back.
 *
 * The level content is irrelevant here: `GLTFScene.addTo` is stubbed so these
 * tests pin the SCHEDULING, which is what changed. `getGLTF` returns null for
 * an unregistered asset, so a scene registers without one.
 */
describe("level.loadAsync (#1646)", () => {
	let app;
	let calls;
	let originalAddTo;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		originalAddTo = GLTFScene.prototype.addTo;
		level.add("gltf", "unit-test-level");
		level.add("gltf", "unit-test-level-2");
	});

	afterAll(() => {
		GLTFScene.prototype.addTo = originalAddTo;
		app?.destroy();
	});

	afterEach(() => {
		// leave the loop stopped between tests; each one sets what it needs
		state.stop();
	});

	/** record every time the level director actually puts a scene in the world */
	const track = () => {
		calls = [];
		GLTFScene.prototype.addTo = function (container) {
			calls.push(container);
		};
		return calls;
	};

	const container = () => {
		return new Container(0, 0, 320, 240);
	};

	describe("the legacy load() contract is unchanged", () => {
		it("still returns true, not a promise", () => {
			track();
			state.stop();
			const result = level.load("unit-test-level", { container: container() });
			expect(result).toBe(true);
			expect(typeof result).toBe("boolean");
			expect(result).not.toBeInstanceOf(Promise);
		});

		it("still fires options.onLoaded and emits LEVEL_LOADED", async () => {
			track();
			state.stop();
			let calledWith = null;
			let emitted = null;
			const handler = (id) => {
				emitted = id;
			};
			event.on(event.LEVEL_LOADED, handler);
			level.load("unit-test-level", {
				container: container(),
				onLoaded: (id) => {
					calledWith = id;
				},
			});
			await Promise.resolve();
			event.off(event.LEVEL_LOADED, handler);
			expect(calledWith).toBe("unit-test-level");
			expect(emitted).toBe("unit-test-level");
		});

		it("still throws SYNCHRONOUSLY on an unknown level id", () => {
			// a programmer error, not a load failure — it must not need `await`
			expect(() => {
				return level.load("no-such-level");
			}).toThrow(/not found/);
		});
	});

	describe("loadAsync", () => {
		it("resolves only once the level is in the world", async () => {
			const seen = track();
			state.restart();
			const target = container();
			const promise = level.loadAsync("unit-test-level", { container: target });
			expect(promise).toBeInstanceOf(Promise);
			// resolves with what `load()` returns, so a port is mechanical
			await expect(promise).resolves.toBe(true);
			expect(seen).toHaveLength(1);
			expect(seen[0]).toBe(target);
		});

		it("fires onLoaded as well, so the two forms can be mixed", async () => {
			track();
			state.restart();
			let calledWith = null;
			await level.loadAsync("unit-test-level", {
				container: container(),
				onLoaded: (id) => {
					calledWith = id;
				},
			});
			expect(calledWith).toBe("unit-test-level");
		});

		it("throws SYNCHRONOUSLY on an unknown level id, rather than rejecting", () => {
			// if this rejected instead, a caller that forgot `await` would get an
			// unhandled rejection in place of a stack pointing at their typo
			expect(() => {
				return level.loadAsync("no-such-level");
			}).toThrow(/not found/);
		});
	});

	describe("the reload / next / previous twins", () => {
		it("reloadAsync resolves once the current level is back in the world", async () => {
			const seen = track();
			state.stop();
			await level.loadAsync("unit-test-level", { container: container() });
			seen.length = 0;
			state.restart();
			await expect(level.reloadAsync({ container: container() })).resolves.toBe(
				true,
			);
			expect(seen).toHaveLength(1);
		});

		it("nextAsync loads the next level and resolves true", async () => {
			const seen = track();
			state.stop();
			await level.loadAsync("unit-test-level", { container: container() });
			seen.length = 0;
			state.restart();
			await expect(level.nextAsync({ container: container() })).resolves.toBe(
				true,
			);
			expect(seen).toHaveLength(1);
			expect(level.getCurrentLevelId()).toBe("unit-test-level-2");
		});

		it("nextAsync resolves FALSE without loading when there is no next", async () => {
			// `next()` returns false here rather than throwing, so the twin must
			// resolve false rather than reject — running out of levels is an
			// ordinary outcome, not an error
			const seen = track();
			state.stop();
			await level.loadAsync("unit-test-level-2", { container: container() });
			seen.length = 0;
			state.restart();
			await expect(level.nextAsync({ container: container() })).resolves.toBe(
				false,
			);
			expect(seen).toHaveLength(0);
		});

		it("previousAsync loads the previous level and resolves true", async () => {
			const seen = track();
			state.stop();
			await level.loadAsync("unit-test-level-2", { container: container() });
			seen.length = 0;
			state.restart();
			await expect(
				level.previousAsync({ container: container() }),
			).resolves.toBe(true);
			expect(seen).toHaveLength(1);
			expect(level.getCurrentLevelId()).toBe("unit-test-level");
		});

		it("previousAsync resolves FALSE without loading when there is no previous", async () => {
			const seen = track();
			state.stop();
			await level.loadAsync("unit-test-level", { container: container() });
			seen.length = 0;
			state.restart();
			await expect(
				level.previousAsync({ container: container() }),
			).resolves.toBe(false);
			expect(seen).toHaveLength(0);
		});

		it("each sync twin still returns the same value, unchanged", () => {
			track();
			state.stop();
			level.load("unit-test-level", { container: container() });
			expect(level.reload({ container: container() })).toBe(true);
			expect(level.next({ container: container() })).toBe(true);
			// now on the last level: no next
			expect(level.next({ container: container() })).toBe(false);
			expect(level.previous({ container: container() })).toBe(true);
			// back on the first: no previous
			expect(level.previous({ container: container() })).toBe(false);
		});
	});

	describe("the deferral it schedules", () => {
		it("does NOT mutate the world synchronously while the loop runs", () => {
			// the whole reason the deferral exists: `level.load` is called from
			// trigger handlers mid-loop, and `safeLoadLevel` resets and destroys
			// the container the loop may be iterating
			const seen = track();
			state.restart();
			expect(state.isRunning()).toBe(true);
			level.loadAsync("unit-test-level", { container: container() });
			expect(seen).toHaveLength(0);
		});

		it("stops the loop when it was running", () => {
			track();
			state.restart();
			level.loadAsync("unit-test-level", { container: container() });
			expect(state.isRunning()).toBe(false);
		});

		it("still loads SYNCHRONOUSLY when the loop is not running", () => {
			// preserved from the timer version: with no loop there is no frame to
			// unwind, and deferring would change when the level exists for anyone
			// loading one before the game starts
			const seen = track();
			state.stop();
			level.loadAsync("unit-test-level", { container: container() });
			expect(seen).toHaveLength(1);
		});

		it("defers by a MICROTASK, not a timer", async () => {
			// A timer is clamped to >= 1s in a background tab, which would strand
			// a level load queued as the tab hides. A microtask drains when the
			// stack empties, so it lands before any macrotask queued alongside it.
			const order = [];
			track();
			GLTFScene.prototype.addTo = () => {
				order.push("load");
			};
			state.restart();
			const promise = level.loadAsync("unit-test-level", {
				container: container(),
			});
			const timer = new Promise((resolve) => {
				setTimeout(() => {
					order.push("timer");
					resolve();
				}, 0);
			});
			await Promise.all([promise, timer]);
			expect(order).toEqual(["load", "timer"]);
		});
	});
});
