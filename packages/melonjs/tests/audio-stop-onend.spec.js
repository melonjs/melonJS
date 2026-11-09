import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { audio } from "../src/index.js";
import {
	loadClip,
	settle,
	startEngine,
	stopEngine,
	wait,
} from "./helpers/audio-output.js";

/**
 * `audio.stop(name)` dropped the clip's own `on.end`.
 *
 * To clear the `onend` callbacks given to `play()` for the voices it stops,
 * `stop` called `off("end", undefined, id)`. With no `id` that is the
 * backend's "remove every end listener", so the clip-level `on: { end }`
 * passed at load went with them, and never fired again for any later play
 * of that clip.
 *
 * The engine is run as on a live context (see `helpers/audio-output.js`); a
 * voice ends on the engine's own end timer, which is wall-clock time.
 */

describe("audio.stop(name) keeps the clip's own on.end", () => {
	beforeAll(startEngine);
	afterAll(stopEngine);

	afterEach(() => {
		audio.stop();
		audio.unloadAll();
	});

	/**
	 * Load a short clip that counts its own `on.end`.
	 * @param {string} name - the clip
	 * @returns {Promise<object>} `{ ends }`, the live count
	 */
	const loadCounting = async (name) => {
		const counter = { ends: 0 };
		await loadClip(
			name,
			{
				on: {
					end() {
						counter.ends++;
					},
				},
			},
			0.1,
		);
		return counter;
	};

	describe("proof", () => {
		it("on.end still fires for plays after a stop by name", async () => {
			const counter = await loadCounting("se-clip");
			audio.play("se-clip");
			await wait(300);
			expect(counter.ends).toBe(1);
			audio.play("se-clip");
			audio.stop("se-clip");
			audio.play("se-clip");
			await wait(300);
			// pre-fix: still 1, the listener was gone
			expect(counter.ends).toBe(2);
		});

		it("on.end still fires after a stop by name of a looping sound", async () => {
			const counter = await loadCounting("se-loop");
			audio.play("se-loop", true);
			await settle();
			audio.stop("se-loop");
			const before = counter.ends;
			audio.play("se-loop");
			await wait(300);
			expect(counter.ends).toBe(before + 1);
		});
	});

	describe("what must not change", () => {
		it("on.end still fires after stopTrack", async () => {
			const counter = await loadCounting("se-track");
			audio.playTrack("se-track");
			await settle();
			audio.stopTrack();
			const before = counter.ends;
			audio.play("se-track");
			await wait(300);
			expect(counter.ends).toBe(before + 1);
		});

		it("a play's own onend does not fire after its sound was stopped by name", async () => {
			await loadClip("se-own", {}, 0.1);
			let calls = 0;
			audio.play("se-own", false, () => {
				calls++;
			});
			audio.stop("se-own");
			// the next voice takes the stopped one's place in the pool
			audio.play("se-own");
			await wait(300);
			expect(calls).toBe(0);
		});

		it("a looping play's onend stops firing once its sound is stopped by name", async () => {
			await loadClip("se-own-loop", {}, 0.1);
			let calls = 0;
			audio.play("se-own-loop", true, () => {
				calls++;
			});
			await wait(250);
			expect(calls).toBeGreaterThan(0);
			audio.stop("se-own-loop");
			const after = calls;
			audio.play("se-own-loop");
			await wait(300);
			expect(calls).toBe(after);
		});

		it("stop(name, id) drops that play's onend only", async () => {
			await loadClip("se-id", {}, 0.1);
			let a = 0;
			let b = 0;
			const first = audio.play("se-id", false, () => {
				a++;
			});
			audio.play("se-id", false, () => {
				b++;
			});
			audio.stop("se-id", first);
			await wait(300);
			expect(a).toBe(0);
			expect(b).toBe(1);
		});

		it("on.end fires once per instance", async () => {
			const counter = await loadCounting("se-each");
			audio.play("se-each");
			audio.play("se-each");
			await wait(300);
			expect(counter.ends).toBe(2);
		});

		it("on.end survives stop(name, id) and stop()", async () => {
			const counter = await loadCounting("se-other-stops");
			const id = audio.play("se-other-stops");
			audio.stop("se-other-stops", id);
			audio.play("se-other-stops");
			audio.stop();
			audio.play("se-other-stops");
			await wait(300);
			expect(counter.ends).toBe(1);
		});

		it("a stopped sound does not fire on.end", async () => {
			const counter = await loadCounting("se-stopped");
			audio.play("se-stopped");
			audio.stop("se-stopped");
			await wait(300);
			expect(counter.ends).toBe(0);
		});

		it("a play's onend given in the options form still fires", async () => {
			await loadClip("se-opts", {}, 0.1);
			let calls = 0;
			audio.play("se-opts", {
				onend: () => {
					calls++;
				},
			});
			await wait(300);
			expect(calls).toBe(1);
		});
	});
});
