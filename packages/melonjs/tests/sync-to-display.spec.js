import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, timer, video } from "../src/index.js";

/**
 * `syncToDisplay`: the update loop counts frame times in whole display frames.
 *
 * Frame times are made up here: each frame lands on the display's refresh,
 * give or take up to `jitter` milliseconds, as a browser reports them (a
 * real 60 Hz display measured within 1 ms of 16.7 ms on 99% of its frames).
 * The jitter is on when each frame lands, not on how long it took, so the
 * frame times of a steady display average out to its refresh exactly.
 */
describe("syncToDisplay", () => {
	let app;

	beforeAll(async () => {
		app = new Application(64, 64, {
			renderer: video.CANVAS,
			syncToDisplay: true,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
		timer.syncToDisplay = false;
		timer.reset();
	});

	// a seeded generator, so a failure replays
	const random = (seed) => {
		return () => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 2 ** 32;
		};
	};

	// the frame times of a display at `hz`, each frame landing within
	// `jitter` ms of its refresh; `skip` lists the refreshes it misses
	const display = (hz, frames, jitter, seed = 7, skip = []) => {
		const next = random(seed);
		const period = 1000 / hz;
		const deltas = [];
		let last = 0;
		for (let i = 1; deltas.length < frames; i++) {
			if (skip.includes(i)) {
				continue;
			}
			const at = i * period + (next() * 2 - 1) * jitter;
			deltas.push(at - last);
			last = at;
		}
		return deltas;
	};

	// run the update loop over `deltas`: the updates each frame ran, and the
	// frame time the timer reported for it
	const run = (deltas, sync) => {
		timer.syncToDisplay = sync;
		timer._displayFrame = 0;
		timer._frameLeftover = 0;
		app.accumulator = 0;
		app.accumulatorMax = app.stepSize * 10;
		app.lastUpdateDelta = 0;
		let updates = 0;
		const worldUpdate = app.world.update;
		app.world.update = () => {
			updates++;
			return false;
		};
		const counts = [];
		const reported = [];
		let time = timer.now;
		try {
			for (const delta of deltas) {
				time += delta;
				const before = updates;
				app.update(time);
				counts.push(updates - before);
				reported.push(timer.getDelta());
			}
		} finally {
			app.world.update = worldUpdate;
			timer.syncToDisplay = false;
		}
		return { counts, reported, updates };
	};

	const tally = (counts) => {
		const out = {};
		for (const count of counts) {
			out[count] = (out[count] ?? 0) + 1;
		}
		return out;
	};

	describe("the setting", () => {
		it("is off by default", async () => {
			const other = new Application(64, 64, { renderer: video.CANVAS });
			try {
				timer.syncToDisplay = true;
				await other.init();
				expect(other.settings.syncToDisplay).toBe(false);
				expect(timer.syncToDisplay).toBe(false);
			} finally {
				other.destroy();
			}
		});

		it("is handed to the timer when the application is initialized", async () => {
			const other = new Application(64, 64, {
				renderer: video.CANVAS,
				syncToDisplay: true,
			});
			try {
				timer.syncToDisplay = false;
				await other.init();
				expect(timer.syncToDisplay).toBe(true);
			} finally {
				other.destroy();
				timer.syncToDisplay = false;
			}
		});
	});

	describe("on a display as fast as the updates", () => {
		// 59.94 Hz: a common refresh, a little slower than the 60 updates
		const frames = display(59.94, 1200, 1);

		it("runs one update on every frame", () => {
			const { counts } = run(frames, true);
			expect(tally(counts)).toEqual({ 1: 1200 });
		});

		it("runs none on some frames and two on others without it", () => {
			// the stutter itself: the same frames, counted as they come
			const { counts } = run(frames, false);
			const seen = tally(counts);
			expect(seen[0]).toBeGreaterThan(0);
			expect(seen[2]).toBeGreaterThan(0);
		});

		it("reports every frame as exactly one step", () => {
			const { reported } = run(frames, true);
			for (const delta of reported) {
				expect(delta).toBe(timer.step);
			}
		});

		it("reports the frame time as measured without it", () => {
			const { reported } = run(frames, false);
			for (let i = 0; i < frames.length; i++) {
				expect(reported[i]).toBeCloseTo(frames[i], 6);
			}
		});
	});

	describe("on a display twice as fast as the updates", () => {
		it("runs one update every other frame, once it has learned the display", () => {
			// 119.88 Hz, its frames within half a millisecond
			const { counts } = run(display(119.88, 1600, 0.5), true);
			const settled = counts.slice(400);
			for (let i = 1; i < settled.length; i++) {
				expect(settled[i] + settled[i - 1]).toBe(1);
			}
		});
	});

	describe("a dropped frame", () => {
		it("counts as two, and leaves the frames after it at one", () => {
			// 60 Hz, missing its 300th refresh
			const { counts, reported } = run(display(60, 600, 1, 11, [300]), true);
			// the refreshes before it are frames 0 to 298, so frame 299 spans two
			expect(counts[299]).toBe(2);
			expect(reported[299]).toBe(timer.step * 2);
			for (let i = 300; i < counts.length; i++) {
				expect(counts[i]).toBe(1);
				expect(reported[i]).toBe(timer.step);
			}
		});
	});

	describe("whatever the time carried when the display settles", () => {
		// a few odd frames first leave the carry anywhere within a frame;
		// the jitter must not tip the count, wherever it is
		it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("seed %s", (seed) => {
			const start = [3 + seed * 1.7, 9 + seed * 0.9, 5.5];
			const at60 = run([...start, ...display(59.94, 900, 1, seed)], true);
			expect(tally(at60.counts.slice(start.length + 60))).toEqual({
				1: 900 - 60,
			});
			const at120 = run(
				[...start, ...display(119.88, 1200, 0.5, seed)],
				true,
			).counts.slice(start.length + 300);
			for (let i = 1; i < at120.length; i++) {
				expect(at120[i] + at120[i - 1]).toBe(1);
			}
		});
	});

	describe("a display whose rate changes", () => {
		it("is learned again when it slows down, as on another screen", () => {
			// ten seconds at 144 Hz, then 60 Hz: a few frames to tell it from
			// dropped ones, then one step a frame
			const fast = display(144, 1440, 0.3);
			const slow = display(60, 1200, 1, 3);
			const { counts, reported } = run([...fast, ...slow], true);
			const settled = fast.length + 30;
			for (const delta of reported.slice(settled)) {
				expect(delta).toBe(timer.step);
			}
			expect(tally(counts.slice(settled))).toEqual({ 1: 1170 });
		});

		it("is learned again when it speeds up", () => {
			const slow = display(60, 600, 1);
			const fast = display(119.88, 1600, 0.5, 5);
			const { counts } = run([...slow, ...fast], true);
			const settled = counts.slice(slow.length + 400);
			for (let i = 1; i < settled.length; i++) {
				expect(settled[i] + settled[i - 1]).toBe(1);
			}
		});

		it("is learned from the display when maxfps is faster than it", () => {
			// the learning starts from maxfps: 120 Hz, on a 60 Hz display
			timer.maxfps = 120;
			timer.reset();
			app.updateFrameRate();
			try {
				const { counts, reported } = run(display(60, 600, 1), true);
				for (const delta of reported.slice(30)) {
					expect(delta).toBe(timer.step * 2);
				}
				expect(tally(counts.slice(30))).toEqual({ 1: 570 });
			} finally {
				timer.maxfps = 60;
				timer.reset();
				app.updateFrameRate();
			}
		});
	});

	describe("a timer reset", () => {
		// a state change, a resume or a restart resets the timer: the frame
		// after it is a partial one, as short as the time left to the refresh
		const runWithResets = (deltas, resets) => {
			timer.syncToDisplay = true;
			timer._displayFrame = 0;
			timer._frameLeftover = 0;
			app.accumulator = 0;
			app.lastUpdateDelta = 0;
			let updates = 0;
			const worldUpdate = app.world.update;
			app.world.update = () => {
				updates++;
				return false;
			};
			const counts = [];
			let time = timer.now;
			try {
				deltas.forEach((delta, i) => {
					if (resets.has(i)) {
						timer.reset();
						timer.last = timer.now = time;
						delta = 5;
					}
					time += delta;
					const before = updates;
					app.update(time);
					counts.push(updates - before);
				});
			} finally {
				app.world.update = worldUpdate;
				timer.syncToDisplay = false;
			}
			return counts;
		};

		it("leaves the frames after its partial one at one update each", () => {
			const resets = new Set();
			for (let i = 100; i < 2000; i += 97) {
				resets.add(i);
			}
			const counts = runWithResets(display(60, 2000, 1), resets);
			const off = [];
			counts.forEach((count, i) => {
				if (i >= 60 && !resets.has(i) && count !== 1) {
					off.push(`${i}: ${count}`);
				}
			});
			expect(off).toEqual([]);
		});

		it("drops the time carried to the next frame", () => {
			run(display(60, 200, 1), true);
			timer._frameLeftover = 7;
			timer.reset();
			expect(timer._frameLeftover).toBe(0);
		});
	});

	describe("a maxfps above 120", () => {
		it.each([144, 165, 240])("maxfps %s still updates the game", (maxfps) => {
			// an update every `frameRate` frames, which rounded down to 0
			// above 120: the game never updated
			timer.maxfps = maxfps;
			timer.reset();
			app.updateFrameRate();
			try {
				expect(app.frameRate).toBe(1);
				const { updates } = run(display(60, 120, 0.2), false);
				expect(updates).toBeGreaterThan(110);
			} finally {
				timer.maxfps = 60;
				timer.reset();
				app.updateFrameRate();
			}
		});
	});

	describe("the rates counted exactly", () => {
		// a quarter of, a third of, half, twice, three and four times maxfps
		it.each([
			[15, 4],
			[20, 3],
			[30, 2],
			[120, 1 / 2],
			[180, 1 / 3],
			[240, 1 / 4],
		])("%s Hz: every frame counted as %s step", (hz, steps) => {
			const { reported } = run(display(hz, 900, 0.2), true);
			for (const delta of reported.slice(300)) {
				expect(delta).toBe(timer.step * steps);
			}
		});
	});

	describe("frame times that match no multiple of a step", () => {
		// the updates the time holds: what has not run yet is still in the
		// accumulator (under a step) or carried by the timer (under half a
		// display frame), so the count is within two of it
		const expected = (deltas) => {
			return (
				deltas.reduce((sum, delta) => {
					return sum + delta;
				}, 0) / timer.step
			);
		};

		it("keep the game's speed on a 144 Hz display", () => {
			const deltas = display(144, 1440, 0.3);
			const { updates } = run(deltas, true);
			expect(Math.abs(updates - expected(deltas))).toBeLessThan(2);
		});

		it.each([
			["rounded up", 34],
			["rounded down", 26],
		])(
			"keep the game's speed when they are irregular, the long ones %s",
			(_how, long) => {
				// three short frames and a long one, over and over: no display
				// rate, so every frame is rounded, and what is rounded off has to
				// be carried for the total to come out right
				const deltas = [];
				while (deltas.length < 600) {
					deltas.push(12, 12, 12, long);
				}
				const { updates, reported } = run(deltas, true);
				expect(Math.abs(updates - expected(deltas))).toBeLessThan(2);
				const real = deltas.reduce((sum, delta) => {
					return sum + delta;
				}, 0);
				const counted = reported.reduce((sum, delta) => {
					return sum + delta;
				}, 0);
				expect(Math.abs(counted - real)).toBeLessThan(timer.step);
			},
		);
	});
});
