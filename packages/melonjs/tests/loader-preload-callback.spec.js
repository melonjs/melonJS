import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	event,
	loader,
	Stage,
	state,
	video,
} from "../src/index.js";

/**
 * Each `loader.preload()` calls its OWN completion callback, and only that.
 *
 * The loader used to keep the last callback it was handed in module state and
 * fall back to it in `completeLoading`. A later preload that passed none —
 * which is what `await loader.preload(levelAssets)` does — therefore called
 * the PREVIOUS preload's callback again: typically the boot callback, a
 * `state.change(state.PLAY)` that sent the game back to its first screen in
 * the middle of loading a level. `loader.reload()` completed with that same
 * leftover callback, whichever preload the retried asset belonged to.
 */
describe("loader.preload completion callback", () => {
	const imgURI =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
	const badURI = "data:image/png;base64,Zm9v";

	const img = (name, src = imgURI) => {
		return { name, type: "image", src };
	};

	// a type whose loads finish when the test says so, to overlap preloads
	// and to fail and then succeed on retry
	const pending = new Map();
	const deferred = (name) => {
		return { name, type: "pc-deferred", src: name };
	};
	const finish = (name, ok = true) => {
		const entry = pending.get(name);
		pending.delete(name);
		if (ok) {
			entry.onload();
		} else {
			entry.onerror(new Error("pc-deferred " + name));
		}
	};
	const flush = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	const names = ["pc1", "pc2", "pc3", "pc4", "pc5", "pc-bad", "pc-bad2"];

	beforeAll(() => {
		boot();
		loader.setParser("pc-deferred", (asset, onload, onerror) => {
			pending.set(asset.name, { onload, onerror });
			return 1;
		});
	});

	afterEach(() => {
		pending.clear();
		for (const name of names) {
			loader.unload({ name, type: "image" });
		}
	});

	it("an awaited preload with no callback does not call the previous preload's callback", async () => {
		let calls = 0;
		await loader.preload(
			[img("pc1")],
			() => {
				calls++;
			},
			false,
		);
		expect(calls).toBe(1);

		await loader.preload([img("pc2")], undefined, false);
		expect(calls).toBe(1);
	});

	it("an empty list completes without calling an earlier callback", async () => {
		let calls = 0;
		await loader.preload(
			[img("pc1")],
			() => {
				calls++;
			},
			false,
		);
		let completed = 0;
		const onComplete = () => {
			completed++;
		};
		event.on(event.LOADER_COMPLETE, onComplete);
		try {
			await loader.preload([], undefined, false);
		} finally {
			event.off(event.LOADER_COMPLETE, onComplete);
		}
		expect(calls).toBe(1);
		// completion is still announced
		expect(completed).toBe(1);
	});

	it("re-preloading cached assets without a callback calls nothing", async () => {
		let calls = 0;
		const onload = () => {
			calls++;
		};
		await loader.preload([img("pc1"), img("pc2")], onload, false);
		// both already in the cache
		await loader.preload([img("pc1"), img("pc2")], undefined, false);
		expect(calls).toBe(1);
	});

	it("each preload calls its own callback, once", async () => {
		const seen = [];
		await loader.preload(
			[img("pc1")],
			() => {
				seen.push("a");
			},
			false,
		);
		await loader.preload(
			[img("pc2")],
			() => {
				seen.push("b");
			},
			false,
		);
		await loader.preload([img("pc3")], undefined, false);
		expect(seen).toEqual(["a", "b"]);
	});

	it("overlapping preloads each call their own callback, when their own assets are in", async () => {
		const seen = [];
		const first = loader.preload(
			[deferred("pc1"), deferred("pc2")],
			() => {
				seen.push("first");
			},
			false,
		);
		const second = loader.preload(
			[deferred("pc3")],
			() => {
				seen.push("second");
			},
			false,
		);
		const third = loader.preload([deferred("pc4")], undefined, false);

		finish("pc3");
		await second;
		expect(seen).toEqual(["second"]);

		finish("pc4");
		await third;
		expect(seen).toEqual(["second"]);

		finish("pc1");
		finish("pc2");
		await first;
		expect(seen).toEqual(["second", "first"]);
	});

	it("a failed preload does not call its callback, nor does a later preload", async () => {
		let calls = 0;
		await expect(
			loader.preload(
				[img("pc-bad", badURI)],
				() => {
					calls++;
				},
				false,
			),
		).rejects.toThrow(/Failed loading resource/);
		expect(calls).toBe(0);

		await loader.preload([img("pc1")], undefined, false);
		expect(calls).toBe(0);
	});

	it("reload() completes the preload the asset failed in, with that preload's callback", async () => {
		const seen = [];
		const failing = loader.preload(
			[deferred("pc-bad"), deferred("pc1")],
			() => {
				seen.push("failed-one");
			},
			false,
		);
		failing.catch(() => {});
		finish("pc1");
		finish("pc-bad", false);
		await expect(failing).rejects.toBeDefined();

		// a different preload, with a callback of its own, in between
		await loader.preload(
			[img("pc2")],
			() => {
				seen.push("other");
			},
			false,
		);
		expect(seen).toEqual(["other"]);

		loader.reload("pc-bad");
		finish("pc-bad");
		await flush();
		expect(seen).toEqual(["other", "failed-one"]);
	});

	it("reload() waits for every failed asset of its preload before completing it", async () => {
		const seen = [];
		const failing = loader.preload(
			[deferred("pc-bad"), deferred("pc-bad2")],
			() => {
				seen.push("done");
			},
			false,
		);
		failing.catch(() => {});
		finish("pc-bad", false);
		finish("pc-bad2", false);
		await expect(failing).rejects.toBeDefined();

		loader.reload("pc-bad");
		finish("pc-bad");
		await flush();
		// one asset of that preload is still missing
		expect(seen).toEqual([]);

		loader.reload("pc-bad2");
		finish("pc-bad2");
		await flush();
		expect(seen).toEqual(["done"]);
	});

	describe("through the loading screen", () => {
		let app;

		beforeAll(async () => {
			app = new Application(320, 240, {
				parent: "screen",
				renderer: video.CANVAS,
			});
			await app.init();
		});

		afterAll(() => {
			app?.destroy();
		});

		it("a level preload does not re-run the boot callback that changed state", async () => {
			let entered = 0;
			class Play extends Stage {
				onResetEvent() {
					entered++;
				}
			}
			state.set(state.PLAY, new Play());

			// the boot preload, the documented callback form
			await loader.preload([img("pc1")], () => {
				state.change(state.PLAY, true);
			});
			expect(state.isCurrent(state.PLAY)).toBe(true);
			expect(entered).toBe(1);

			// later, a level's own assets, awaited: back on the loading screen
			// until the game moves on itself
			await loader.preload([img("pc2")]);
			expect(state.isCurrent(state.LOADING)).toBe(true);
			expect(entered).toBe(1);

			state.change(state.PLAY, true);
			expect(entered).toBe(2);
		});
	});
});
