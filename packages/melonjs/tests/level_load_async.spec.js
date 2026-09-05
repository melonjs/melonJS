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
 * `level.load({ async: true })` and the scheduling behind it (#1646).
 *
 * The deferral in `level.load()` dates to 2011 and used a timer because that
 * was the only way to defer at the time. It is still needed — `level.load()` is
 * routinely called from inside the loop, and `safeLoadLevel` resets and
 * destroys the very container the loop may be iterating — but it is now a
 * microtask, and `async: true` hands that completion back instead of a boolean.
 *
 * The level content is irrelevant here: `GLTFScene.addTo` is stubbed so these
 * tests pin the SCHEDULING, which is what changed. `getGLTF` returns null for
 * an unregistered asset, so a scene registers without one.
 */
describe("level.load({ async }) (#1646)", () => {
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

	describe("the async form", () => {
		it("resolves only once the level is in the world", async () => {
			const seen = track();
			state.restart();
			const target = container();
			const promise = level.load("unit-test-level", {
				container: target,
				async: true,
			});
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
			await level.load("unit-test-level", {
				container: container(),
				async: true,
				onLoaded: (id) => {
					calledWith = id;
				},
			});
			expect(calledWith).toBe("unit-test-level");
		});

		it("REJECTS when the load itself fails, whether or not the loop runs", async () => {
			// The failure surface must not depend on `state.isRunning()`. The
			// deferred branch naturally produces a rejection; the synchronous
			// one would let the exception escape the call, where a
			// `load(...).catch()` could never see it — the throw beats the
			// handler being attached.
			const boom = new Error("addTo exploded");
			GLTFScene.prototype.addTo = () => {
				throw boom;
			};

			state.stop();
			expect(state.isRunning()).toBe(false);
			await expect(
				level.load("unit-test-level", { container: container(), async: true }),
			).rejects.toBe(boom);

			state.restart();
			expect(state.isRunning()).toBe(true);
			await expect(
				level.load("unit-test-level", { container: container(), async: true }),
			).rejects.toBe(boom);
		});

		it("throws SYNCHRONOUSLY on an unknown level id, rather than rejecting", () => {
			// if this rejected instead, a caller that forgot `await` would get an
			// unhandled rejection in place of a stack pointing at their typo
			expect(() => {
				return level.load("no-such-level", { async: true });
			}).toThrow(/not found/);
		});
	});

	describe("reload / next / previous take the same flag", () => {
		it("reload({ async }) resolves once the current level is back in the world", async () => {
			const seen = track();
			state.stop();
			await level.load("unit-test-level", {
				container: container(),
				async: true,
			});
			seen.length = 0;
			state.restart();
			await expect(
				level.reload({ container: container(), async: true }),
			).resolves.toBe(true);
			expect(seen).toHaveLength(1);
		});

		it("next({ async }) loads the next level and resolves true", async () => {
			const seen = track();
			state.stop();
			await level.load("unit-test-level", {
				container: container(),
				async: true,
			});
			seen.length = 0;
			state.restart();
			await expect(
				level.next({ container: container(), async: true }),
			).resolves.toBe(true);
			expect(seen).toHaveLength(1);
			expect(level.getCurrentLevelId()).toBe("unit-test-level-2");
		});

		it("next({ async }) resolves FALSE without loading when there is no next", async () => {
			// `next()` returns false here rather than throwing, so the twin must
			// resolve false rather than reject — running out of levels is an
			// ordinary outcome, not an error
			const seen = track();
			state.stop();
			await level.load("unit-test-level-2", {
				container: container(),
				async: true,
			});
			seen.length = 0;
			state.restart();
			await expect(
				level.next({ container: container(), async: true }),
			).resolves.toBe(false);
			expect(seen).toHaveLength(0);
		});

		it("previous({ async }) loads the previous level and resolves true", async () => {
			const seen = track();
			state.stop();
			await level.load("unit-test-level-2", {
				container: container(),
				async: true,
			});
			seen.length = 0;
			state.restart();
			await expect(
				level.previous({ container: container(), async: true }),
			).resolves.toBe(true);
			expect(seen).toHaveLength(1);
			expect(level.getCurrentLevelId()).toBe("unit-test-level");
		});

		it("previous({ async }) resolves FALSE without loading when there is no previous", async () => {
			const seen = track();
			state.stop();
			await level.load("unit-test-level", {
				container: container(),
				async: true,
			});
			seen.length = 0;
			state.restart();
			await expect(
				level.previous({ container: container(), async: true }),
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

	describe("the flag is what decides the return", () => {
		it("returns a boolean without it, and a promise with it", () => {
			track();
			state.stop();
			expect(level.load("unit-test-level", { container: container() })).toBe(
				true,
			);
			const promise = level.load("unit-test-level", {
				container: container(),
				async: true,
			});
			expect(promise).toBeInstanceOf(Promise);
			return promise;
		});

		it("awaiting WITHOUT the flag still yields to the deferred load", async () => {
			// `await true` is valid JavaScript, so forgetting the flag is silent.
			// It happens to be harmless TODAY: the deferral is a single
			// microtask queued before the await's continuation, so the load runs
			// first either way. That is incidental ordering, not a contract —
			// hence the flag exists — so this pins the observable part (no
			// promise is returned) and merely records the rest.
			const seen = track();
			state.restart();
			const value = level.load("unit-test-level", { container: container() });
			expect(value).toBe(true);
			expect(value).not.toBeInstanceOf(Promise);
			await value;
			expect(seen).toHaveLength(1);
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
			level.load("unit-test-level", { container: container(), async: true });
			expect(seen).toHaveLength(0);
		});

		it("stops the loop when it was running", () => {
			track();
			state.restart();
			level.load("unit-test-level", { container: container(), async: true });
			expect(state.isRunning()).toBe(false);
		});

		it("still loads SYNCHRONOUSLY when the loop is not running", () => {
			// preserved from the timer version: with no loop there is no frame to
			// unwind, and deferring would change when the level exists for anyone
			// loading one before the game starts
			const seen = track();
			state.stop();
			level.load("unit-test-level", { container: container(), async: true });
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
			const promise = level.load("unit-test-level", {
				container: container(),
				async: true,
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
