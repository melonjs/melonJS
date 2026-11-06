import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, event, loader, ProgressBar } from "../src/index.js";

/**
 * `LOADER_PROGRESS` reports the progress of the preload in flight, from its
 * first asset to 1 with its last.
 *
 * The counters behind it (`resourceCount` / `loadCount`) lived for the whole
 * session and only ever grew: a second preload of two assets reported
 * `0.75, 1` rather than `0.5, 1` (the first preload's assets still counted
 * as done), and once one asset had failed it stayed counted in the total but
 * never as loaded, so no later preload ever reached 1 — a loading bar stuck
 * short of full for the rest of the game.
 *
 * Preloads that overlap share one tally: a second preload started before the
 * first has settled joins it, so the one bar keeps counting both rather than
 * the two calls taking turns to move it back and forth. Once everything in
 * flight has settled, the next preload counts from zero.
 */
describe("loader.preload progress", () => {
	const imgURI =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
	const badURI = "data:image/png;base64,Zm9v";

	const img = (name, src = imgURI) => {
		return { name, type: "image", src };
	};

	// loads that finish when the test says so
	const pending = new Map();
	const deferred = (name) => {
		return { name, type: "pp-deferred", src: name };
	};
	const finish = (name, ok = true) => {
		const entry = pending.get(name);
		pending.delete(name);
		if (ok) {
			entry.onload();
		} else {
			entry.onerror(new Error("pp-deferred " + name));
		}
	};
	const flush = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	let progress = [];
	const onProgress = (value) => {
		progress.push(value);
	};

	const names = ["pp1", "pp2", "pp3", "pp4", "pp-bad"];

	beforeAll(() => {
		boot();
		loader.setParser("pp-deferred", (asset, onload, onerror) => {
			pending.set(asset.name, { onload, onerror });
			return 1;
		});
	});

	afterEach(() => {
		event.off(event.LOADER_PROGRESS, onProgress);
		progress = [];
		pending.clear();
		for (const name of names) {
			loader.unload({ name, type: "image" });
		}
	});

	const listen = () => {
		progress = [];
		event.on(event.LOADER_PROGRESS, onProgress);
	};

	it("a second preload reports its own progress, from its first asset", async () => {
		listen();
		await loader.preload([img("pp1"), img("pp2")], undefined, false);
		expect(progress).toEqual([0.5, 1]);

		progress = [];
		await loader.preload([img("pp3"), img("pp4")], undefined, false);
		expect(progress).toEqual([0.5, 1]);
	});

	it("cached assets count towards progress, and still reach 1", async () => {
		await loader.preload([img("pp1"), img("pp2")], undefined, false);
		listen();
		await loader.preload([img("pp1"), img("pp2")], undefined, false);
		expect(progress).toEqual([0.5, 1]);
	});

	it("progress reaches 1 again after an earlier preload had a failed asset", async () => {
		listen();
		await expect(
			loader.preload([img("pp1"), img("pp-bad", badURI)], undefined, false),
		).rejects.toThrow(/Failed loading resource/);
		await flush();
		// the failed preload stops short of full, as it should
		expect(progress).toEqual([0.5]);

		progress = [];
		await loader.preload([img("pp3"), img("pp4")], undefined, false);
		expect(progress).toEqual([0.5, 1]);
	});

	it("a single-asset preload goes straight to 1, an empty one reports nothing", async () => {
		listen();
		await loader.preload([], undefined, false);
		expect(progress).toEqual([]);
		await loader.preload([img("pp1")], undefined, false);
		expect(progress).toEqual([1]);
	});

	it("a preload started while another is loading joins its progress", async () => {
		listen();
		const first = loader.preload(
			[deferred("pp1"), deferred("pp2")],
			undefined,
			false,
		);
		finish("pp1");
		await flush();
		expect(progress).toEqual([0.5]);

		// joins: four assets in flight now, two of them its own
		const second = loader.preload(
			[deferred("pp3"), deferred("pp4")],
			undefined,
			false,
		);
		finish("pp3");
		finish("pp2");
		await first;
		finish("pp4");
		await second;
		expect(progress).toEqual([0.5, 0.5, 0.75, 1]);

		// everything settled: the next preload counts from zero
		progress = [];
		await loader.preload([img("pp1"), img("pp2")], undefined, false);
		expect(progress).toEqual([0.5, 1]);
	});

	it("reload() counts the retried asset towards its own preload", async () => {
		listen();
		const failing = loader.preload(
			[deferred("pp1"), deferred("pp-bad")],
			undefined,
			false,
		);
		failing.catch(() => {});
		finish("pp1");
		finish("pp-bad", false);
		await expect(failing).rejects.toBeDefined();
		expect(progress).toEqual([0.5]);

		loader.reload("pp-bad");
		finish("pp-bad");
		await flush();
		expect(progress).toEqual([0.5, 1]);
	});

	it("drives a ProgressBar bound to LOADER_PROGRESS to full on every preload", async () => {
		const bar = new ProgressBar(0, 0, {
			width: 100,
			height: 4,
			bindEvent: event.LOADER_PROGRESS,
		});
		try {
			await loader.preload([img("pp1"), img("pp2")], undefined, false);
			expect(bar.value).toBe(1);
			bar.value = 0;
			await loader.preload([img("pp3")], undefined, false);
			expect(bar.value).toBe(1);
		} finally {
			bar.destroy();
		}
	});
});
