import { boot, game, plugin, video } from "melonjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DebugPanelPlugin } from "../src/index.js";

/**
 * Tests for the panel's frame-time readouts.
 *
 * Both numbers were wrong in different ways before 16.1.1:
 *
 * - **draw** printed two decimals on a raw per-frame `performance.now()`
 *   delta. That clock is clamped to 100µs unless the page is cross-origin
 *   isolated, so a single frame's value can only land on a multiple of 0.1ms
 *   and the second decimal was structurally always zero. Averaging over N
 *   frames is what makes the printed precision real.
 * - **update** was derived by subtracting the `GAME_BEFORE_UPDATE` payload
 *   from the `GAME_AFTER_UPDATE` one, but those are not a matched pair — the
 *   latter carries `lastUpdate`, assigned only inside the fixed-timestep
 *   loop, so on a frame that runs no logic step it still holds a value from
 *   an earlier frame and the difference goes negative.
 */
describe("DebugPanelPlugin frame times", () => {
	let panel;

	beforeAll(async () => {
		await boot();
		video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		plugin.register(DebugPanelPlugin, "debugPanel");
		panel = plugin.cache.debugPanel;
	});

	afterAll(() => {
		panel?.destroy?.();
	});

	it("registers and exposes the readout state", () => {
		expect(panel).toBeDefined();
		expect(typeof panel.frameUpdateTime).toBe("number");
		expect(typeof panel.frameDrawTime).toBe("number");
	});

	describe("averaging (_meanTime)", () => {
		it("returns 0 rather than NaN before any sample lands", () => {
			// the panel can be opened on frame 1; dividing by a zero count would
			// print "NaNms"
			panel._timeSampleCount = 0;
			expect(panel._meanTime(panel._drawSamples)).toBe(0);
		});

		it("divides by the sample count, not the buffer capacity", () => {
			// while the ring is still filling, dividing by capacity would report a
			// fraction of the true value
			panel._drawSamples.fill(0);
			panel._drawSamples[0] = 3;
			panel._timeSampleCount = 1;
			expect(panel._meanTime(panel._drawSamples)).toBe(3);
		});

		it("recovers a mid-tick value from readings quantised to the clock", () => {
			// the real symptom: a ~0.5ms phase reads as alternating 0.0 / 1.0 on a
			// coarse clock. The mean has to land between them, which is the whole
			// reason the panel averages at all.
			panel._drawSamples.fill(0);
			for (let i = 0; i < panel._drawSamples.length; i++) {
				panel._drawSamples[i] = i % 2 === 0 ? 0 : 1;
			}
			panel._timeSampleCount = panel._drawSamples.length;
			const mean = panel._meanTime(panel._drawSamples);
			expect(mean).toBeGreaterThan(0);
			expect(mean).toBeLessThan(1);
		});

		it("averages over a bounded window so old frames age out", () => {
			// a steady value must be reported exactly once the ring has turned
			// over, otherwise stale samples would drag the readout forever
			panel._drawSamples.fill(0.4);
			panel._timeSampleCount = panel._drawSamples.length;
			expect(panel._meanTime(panel._drawSamples)).toBeCloseTo(0.4, 5);
		});
	});

	describe("update readout", () => {
		it("reads the engine's measured step duration", () => {
			const previous = game.lastUpdateDelta;
			try {
				game.lastUpdateDelta = 2.5;
				panel._onAfterUpdate();
				expect(panel.frameUpdateTime).toBe(2.5);
			} finally {
				game.lastUpdateDelta = previous;
			}
		});

		it("never produces a negative duration", () => {
			// the old subtraction did exactly this whenever the fixed-step loop
			// skipped a frame
			const previous = game.lastUpdateDelta;
			try {
				for (const value of [0, 0.1, 5]) {
					game.lastUpdateDelta = value;
					panel._onAfterUpdate();
					expect(panel.frameUpdateTime).toBeGreaterThanOrEqual(0);
				}
			} finally {
				game.lastUpdateDelta = previous;
			}
		});

		it("falls back to updateAverageDelta on melonJS 19.x", () => {
			// this plugin supports melonjs >=19.8, where the field is still called
			// `updateAverageDelta`; 20.0.0 renamed it to `lastUpdateDelta`. Shadow
			// the instance to look like the older engine and check the fallback.
			const previous = game.lastUpdateDelta;
			try {
				delete game.lastUpdateDelta;
				Object.defineProperty(game, "updateAverageDelta", {
					value: 1.75,
					configurable: true,
					writable: true,
				});
				expect(typeof game.lastUpdateDelta).toBe("undefined");

				panel._onAfterUpdate();
				expect(panel.frameUpdateTime).toBe(1.75);
			} finally {
				delete game.updateAverageDelta;
				game.lastUpdateDelta = previous;
			}
		});

		it("prefers the new name when both are present", () => {
			// with the deprecated alias in place both resolve, and the new one has
			// to win so the fallback can be dropped later without behaviour change
			const previous = game.lastUpdateDelta;
			try {
				game.lastUpdateDelta = 9;
				panel._onAfterUpdate();
				expect(panel.frameUpdateTime).toBe(9);
			} finally {
				game.lastUpdateDelta = previous;
			}
		});
	});
});
