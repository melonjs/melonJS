import "./helpers/webgpu-globals.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, ShaderEffect, SwayEffect, WaveEffect } from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * `WaveEffect` takes an `anchor`: the row its wave fades out at, full at the
 * top and nothing from the anchor down. 0, the default, waves every row as it
 * always did. `SwayEffect` is a wave with an anchor and sway-sized defaults,
 * sharing its shader, whose `setTime` wraps the phase to one turn so a
 * medium-precision float never runs out of digits.
 */
const wgslRenderer = { shaderLanguage: "wgsl", width: 64, height: 64 };
const TURN = Math.PI * 2;

const quiet = (make) => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = make();
	warn.mockRestore();
	return effect;
};

describe("WaveEffect anchor", () => {
	it("defaults to 0: every row waves alike, as before", () => {
		const wave = quiet(() => {
			return new WaveEffect(wgslRenderer);
		});
		expect(wave._uniformValues.get("uAnchor")).toBe(0);
		expect(wave.wgslRealization.valid).toBe(true);
		wave.destroy();
	});

	it("takes an anchor from its options and from setAnchor", () => {
		const wave = quiet(() => {
			return new WaveEffect(wgslRenderer, { anchor: 0.6 });
		});
		expect(wave._uniformValues.get("uAnchor")).toBe(0.6);
		wave.setAnchor(0.25);
		expect(wave._uniformValues.get("uAnchor")).toBe(0.25);
		wave.destroy();
	});
});

describe("SwayEffect", () => {
	const make = (options) => {
		return quiet(() => {
			return new SwayEffect(wgslRenderer, options);
		});
	};

	it("is a WaveEffect, sharing its shader", () => {
		const sway = make();
		expect(sway).toBeInstanceOf(WaveEffect);
		expect(sway).toBeInstanceOf(ShaderEffect);
		expect(sway.wgslRealization.valid).toBe(true);
		sway.destroy();
	});

	it("maps its options onto the wave's uniforms", () => {
		const sway = make({ strength: 0.03, anchor: 0.57, frequency: 4, speed: 2 });
		const value = (name) => {
			return sway._uniformValues.get(name);
		};
		expect(value("uAmplitude")).toBe(0.03);
		expect(value("uAnchor")).toBe(0.57);
		expect(value("uFrequency")).toBe(4);
		// the speed is applied on the CPU, before the wrap
		expect(value("uSpeed")).toBe(1);
		expect(sway.speed).toBe(2);
		sway.destroy();
	});

	it("defaults to a gentle sway anchored at the bottom row", () => {
		const sway = make();
		expect(sway._uniformValues.get("uAmplitude")).toBe(0.02);
		expect(sway._uniformValues.get("uAnchor")).toBe(1);
		expect(sway._uniformValues.get("uFrequency")).toBe(3);
		expect(sway.speed).toBe(1.5);
		sway.destroy();
	});

	it("wraps the phase to one turn, however long it has been running", () => {
		const sway = make({ speed: 1.5 });
		// a week in seconds: a raw clock this size leaves a medium-precision
		// float no digits for the fraction of a turn
		const week = 7 * 24 * 3600;
		sway.setTime(week);
		const phase = sway._uniformValues.get("uTime");
		expect(phase).toBeGreaterThanOrEqual(0);
		expect(phase).toBeLessThan(TURN);
		expect(phase).toBeCloseTo((week * 1.5) % TURN, 6);
		// and an early moment is the speed times the time; chainable, as
		// every effect's setTime is
		expect(sway.setTime(1)).toBe(sway);
		expect(sway._uniformValues.get("uTime")).toBeCloseTo(1.5, 6);
		sway.destroy();
	});

	it("clones as a SwayEffect, swaying the same way", () => {
		const sway = make({ strength: 0.04, anchor: 0.5, frequency: 2, speed: 3 });
		sway.setStrength(0.05);
		const copy = sway.clone();
		expect(copy).toBeInstanceOf(SwayEffect);
		expect(copy).not.toBe(sway);
		expect(copy._uniformValues.get("uAmplitude")).toBe(0.05);
		expect(copy._uniformValues.get("uAnchor")).toBe(0.5);
		expect(copy._uniformValues.get("uFrequency")).toBe(2);
		expect(copy.speed).toBe(3);
		copy.setTime(1);
		expect(copy._uniformValues.get("uTime")).toBeCloseTo(3, 6);
		sway.destroy();
		copy.destroy();
	});

	describe("on WebGL, measured in pixels", () => {
		const SIZE = 64;
		const RED = [255, 0, 0];
		let renderer;
		let bar;

		beforeAll(async () => {
			await boot();
			try {
				renderer = await getWebGLRenderer(SIZE, SIZE);
			} catch {
				// WebGL genuinely unavailable: the tests skip below
			}
			if (renderer) {
				renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
				renderer.currentBatcher.setProjection(renderer.projectionMatrix);
			}
			// 16x16: a red bar down the middle, columns 6 to 9
			bar = Renderer.createCanvas(16, 16);
			const ctx = bar.getContext("2d");
			ctx.fillStyle = "#ff0000";
			ctx.fillRect(6, 0, 4, 16);
		});

		afterAll(() => {
			releaseWebGLRenderer();
		});

		const requireWebGL = (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
			}
		};

		const pixel = (x, y) => {
			const gl = renderer.gl;
			const out = new Uint8Array(4);
			gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
			return [out[0], out[1], out[2]];
		};

		/** the bar at (16, 16), 1:1, over black, a quarter turn in */
		const draw = (effect) => {
			effect.setTime(Math.PI / 2);
			renderer.clearColor("#000000ff");
			renderer.save();
			renderer.customShader = effect;
			renderer.drawImage(bar, 0, 0, 16, 16, 16, 16, 16, 16);
			renderer.flush();
			renderer.customShader = undefined;
			renderer.restore();
			effect.destroy();
		};

		// column 8 of the bar, on its bottom row and on its top row
		const BOTTOM = [24, 30];
		const TOP = [24, 17];

		// a quarter of a width at the peak of the wave: the bar moves well
		// off column 8 wherever the wave reaches
		const strong = { amplitude: 0.25, frequency: 0, speed: 1 };

		it("moves every row with no anchor", (ctx) => {
			requireWebGL(ctx);
			draw(new WaveEffect(renderer, strong));
			expect(pixel(...TOP)).not.toEqual(RED);
			expect(pixel(...BOTTOM)).not.toEqual(RED);
		});

		it("leaves the rows below its anchor where they are", (ctx) => {
			requireWebGL(ctx);
			draw(new WaveEffect(renderer, { ...strong, anchor: 0.5 }));
			expect(pixel(...TOP)).not.toEqual(RED);
			expect(pixel(...BOTTOM)).toEqual(RED);
		});

		it("sways the top while the bottom row stays planted", (ctx) => {
			requireWebGL(ctx);
			// speed 1, so setTime(π/2) is the peak, as above
			draw(
				new SwayEffect(renderer, { strength: 0.25, frequency: 0, speed: 1 }),
			);
			expect(pixel(...TOP)).not.toEqual(RED);
			expect(pixel(24, 31)).toEqual(RED);
		});
	});
});
