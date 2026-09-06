import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	event,
	level,
	loader,
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
 * timer, and `async: true` hands that completion back instead of a boolean.
 *
 * The level content is irrelevant here: `GLTFScene.addTo` is stubbed so these
 * tests pin the SCHEDULING, which is what changed. `getGLTF` returns null for
 * an unregistered asset, so a scene registers without one.
 */
const MAP = {
	type: "map",
	version: "1.10",
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	width: 4,
	height: 4,
	tilewidth: 16,
	tileheight: 16,
	nextlayerid: 2,
	nextobjectid: 1,
	layers: [
		{
			id: 1,
			name: "ground",
			type: "tilelayer",
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			width: 4,
			height: 4,
			data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		},
		{
			id: 2,
			name: "entities",
			type: "objectgroup",
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			objects: [
				{
					id: 1,
					name: "spawn",
					type: "",
					x: 8,
					y: 8,
					width: 8,
					height: 8,
					rotation: 0,
					visible: true,
				},
			],
		},
	],
	tilesets: [],
};

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
		// registered up here rather than inside the TMX describe: "the option
		// defaults" needs the map too, and a sibling describe's `beforeAll`
		// only runs for that describe — the tests passed purely on declaration
		// order, which is not a thing to rely on
		await loader.preload(
			[{ name: "unit-test-map", type: "tmx", data: MAP }],
			undefined,
			false,
		);
	});

	afterAll(() => {
		GLTFScene.prototype.addTo = originalAddTo;
		app?.destroy();
	});

	afterEach(async () => {
		// leave the loop stopped between tests; each one sets what it needs
		state.stop();
		// and flush any timer-deferred load still pending, so it cannot land in
		// the middle of the next test
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
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
			// the LAST registered level — see the top-level beforeAll
			await level.load("unit-test-map", {
				container: container(),
				setViewportBounds: false,
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
			// three levels are registered: unit-test-level, unit-test-level-2,
			// then the TMX map — so walking forward twice reaches the end
			level.load("unit-test-level", { container: container() });
			expect(level.reload({ container: container() })).toBe(true);
			expect(level.next({ container: container() })).toBe(true);
			expect(
				level.next({ container: container(), setViewportBounds: false }),
			).toBe(true);
			// now on the last level: no next
			expect(level.next({ container: container() })).toBe(false);
			expect(level.previous({ container: container() })).toBe(true);
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

		it("awaiting WITHOUT the flag does NOT wait for the load", async () => {
			// The cost of putting the switch in the options: `await true` is
			// valid JavaScript, so forgetting the flag is silent. The deferral
			// is a timer, and awaiting a boolean yields only one microtask —
			// nowhere near it. This is the whole reason the flag exists.
			const seen = track();
			state.restart();
			const value = level.load("unit-test-level", { container: container() });
			expect(value).toBe(true);
			expect(value).not.toBeInstanceOf(Promise);
			await value;
			expect(seen).toHaveLength(0);
		});
	});

	describe("a real TMX map, not just a stubbed scene", () => {
		// Every other test here stubs `GLTFScene.addTo`, which exercises the
		// non-TMX arm of `safeLoadLevel`'s format branch. Tiled maps are the
		// main use of `level.load` and go down the other arm — `loadTMXLevel`,
		// with GUID reset, object flattening and viewport bounds — so the flag
		// has to work there too. The map is passed inline via the loader's
		// `data` field, so this needs no fixture file.
		it("loads a TMX map in the boolean form", () => {
			state.stop();
			const target = container();
			expect(
				level.load("unit-test-map", {
					container: target,
					setViewportBounds: false,
				}),
			).toBe(true);
			expect(target.children.length).toBeGreaterThan(0);
		});

		it("loads a TMX map in the async form, resolving once it is in the world", async () => {
			state.restart();
			const target = container();
			const promise = level.load("unit-test-map", {
				container: target,
				setViewportBounds: false,
				async: true,
			});
			// deferred: nothing yet (`children` is undefined until the first add)
			expect(target.children ?? []).toHaveLength(0);
			await expect(promise).resolves.toBe(true);
			expect(target.children.length).toBeGreaterThan(0);
		});

		it("still honours flatten on the TMX arm in the async form", async () => {
			// `flatten: false` wraps each Tiled group in its own Container named
			// after it — behaviour only `loadTMXLevel` produces, so this also
			// pins that a TMX map goes down the TMX arm rather than the generic
			// `addTo` one, which would silently load it with the wrong arguments
			state.restart();
			const target = container();
			await level.load("unit-test-map", {
				container: target,
				setViewportBounds: false,
				flatten: false,
				async: true,
			});
			expect(target.children.length).toBeGreaterThan(0);
			// only `loadTMXLevel` wraps an object group in a Container named
			// after it. The generic `addTo` arm takes (container, flatten,
			// setViewportBounds) positionally, so routing a map through it
			// passes the whole options object as `flatten` and flattens
			// everything — no wrapper, and this assertion catches it.
			expect(target.getChildByName("entities")).toHaveLength(1);
		});
	});

	describe("the option defaults", () => {
		// These are pre-existing defaults rather than anything this change
		// introduced, but nothing called `level.load` before, so nothing pinned
		// them either. They are the contract a game gets when it passes no
		// options at all, which is the common case.

		it("defaults the container to the app's world", () => {
			const seen = track();
			state.stop();
			level.load("unit-test-level");
			expect(seen).toHaveLength(1);
			expect(seen[0]).toBe(app.world);
		});

		it("defaults setViewportBounds to TRUE on the TMX arm", async () => {
			// the TMX arm reads `container.getRootAncestor().app`, so this has
			// to go through the attached default container
			const calls = [];
			const original = app.viewport.setBounds.bind(app.viewport);
			app.viewport.setBounds = (...args) => {
				calls.push(args);
				return original(...args);
			};
			state.stop();
			level.load("unit-test-map");
			const withDefault = calls.length;

			calls.length = 0;
			level.load("unit-test-map", { setViewportBounds: false });
			const withFalse = calls.length;
			app.viewport.setBounds = original;

			expect(withDefault).toBeGreaterThan(0);
			expect(withFalse).toBe(0);
		});

		it("defaults flatten to the app's mergeGroup", () => {
			// `flatten` decides whether a Tiled object group keeps its own
			// Container. The default is not `true` or `false` but whatever the
			// application says, which is the part worth pinning.
			const previous = app.mergeGroup;
			state.stop();

			app.mergeGroup = false;
			level.load("unit-test-map", { setViewportBounds: false });
			const wrappedWhenFalse = app.world.getChildByName("entities").length;

			app.mergeGroup = true;
			level.load("unit-test-map", { setViewportBounds: false });
			const wrappedWhenTrue = app.world.getChildByName("entities").length;

			app.mergeGroup = previous;

			expect(wrappedWhenFalse).toBe(1);
			expect(wrappedWhenTrue).toBe(0);
		});
	});

	describe("ordering and failure surfaces", () => {
		it("emits LEVEL_LOADED before the promise resolves", async () => {
			// what a caller awaiting the load then reading world state depends
			// on: the event must not arrive after the await has resumed
			track();
			state.restart();
			const order = [];
			const handler = () => {
				order.push("event");
			};
			event.on(event.LEVEL_LOADED, handler);
			await level.load("unit-test-level", {
				container: container(),
				async: true,
			});
			order.push("resolved");
			event.off(event.LEVEL_LOADED, handler);
			expect(order).toEqual(["event", "resolved"]);
		});

		it("calls onLoaded before the promise resolves", async () => {
			track();
			state.restart();
			const order = [];
			await level.load("unit-test-level", {
				container: container(),
				async: true,
				onLoaded: () => {
					order.push("onLoaded");
				},
			});
			order.push("resolved");
			expect(order).toEqual(["onLoaded", "resolved"]);
		});

		it("REJECTS when onLoaded throws, in the async form", async () => {
			// the callback runs inside the load, so its failure belongs to the
			// same surface as any other load failure
			track();
			state.restart();
			const boom = new Error("onLoaded exploded");
			await expect(
				level.load("unit-test-level", {
					container: container(),
					async: true,
					onLoaded: () => {
						throw boom;
					},
				}),
			).rejects.toBe(boom);
		});

		it("THROWS when onLoaded throws with no loop running, in the boolean form", () => {
			// the synchronous path stays synchronous, errors included, so a
			// caller can still `try { level.load(id) } catch`
			track();
			state.stop();
			const boom = new Error("onLoaded exploded");
			expect(() => {
				return level.load("unit-test-level", {
					container: container(),
					onLoaded: () => {
						throw boom;
					},
				});
			}).toThrow(boom);
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

		it("defers the ASYNC form past every microtask too", async () => {
			// the promise branch schedules through its own helper, so the
			// fire-and-forget test above does not cover it: without this, that
			// branch could quietly revert to a microtask
			const seen = track();
			state.restart();
			const promise = level.load("unit-test-level", {
				container: container(),
				async: true,
			});
			for (let i = 0; i < 10; i++) {
				await Promise.resolve();
			}
			expect(seen).toHaveLength(0);
			await expect(promise).resolves.toBe(true);
			expect(seen).toHaveLength(1);
		});

		it("defers past every microtask, onto a macrotask", async () => {
			// A macrotask cannot run inside another, so the load lands after the
			// current frame whatever that frame does. A microtask would only
			// land there while the whole update-and-draw path stays synchronous
			// — true today, but it would start running mid-frame the day
			// anything in that path awaits.
			const seen = track();
			state.restart();
			level.load("unit-test-level", { container: container() });

			// drain the microtask queue: a microtask-deferred load runs here
			for (let i = 0; i < 10; i++) {
				await Promise.resolve();
			}
			expect(seen).toHaveLength(0);

			// ...this one lands on the next macrotask
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
			expect(seen).toHaveLength(1);
		});
	});
});
