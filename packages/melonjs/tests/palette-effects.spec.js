/**
 * `GradientMapEffect` (a sprite recolored from its brightness) and
 * `DitherEffect` (a sprite drawn in a few colors, with an ordered dither
 * between them): what they draw on WebGL, what they refuse, and that their
 * WGSL twins read the same values.
 *
 * The drawing checks are in `helpers/palette-effect-checks.js`, which
 * `palette-effects-webgpu.spec.js` runs on WebGPU.
 */
import "./helpers/webgpu-globals.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, DitherEffect, GradientMapEffect } from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import {
	ditherChecks,
	gradientMapChecks,
	SIZE,
} from "./helpers/palette-effect-checks.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

// enough of a renderer for an effect to build its WGSL twin
const wgslRenderer = { shaderLanguage: "wgsl", width: 64, height: 64 };

/** build an effect for WGSL, without the warning that no device is there */
function forWGSL(Effect, options) {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = new Effect(wgslRenderer, options);
	warn.mockRestore();
	return effect;
}

/** `count` floats of a member of an effect's WGSL uniform block */
function block(effect, member, count) {
	const { layout, f32 } = effect.wgslRealization;
	const from = layout.get(member).offset >> 2;
	return Array.from(f32.subarray(from, from + count));
}

describe("palette effects", () => {
	let renderer;

	beforeAll(async () => {
		boot();
		renderer = await getWebGLRenderer(SIZE, SIZE);
		if (renderer instanceof WebGLRenderer) {
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		} else {
			renderer = undefined;
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const getRenderer = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
		return renderer;
	};

	describe("GradientMapEffect, drawn on WebGL", () => {
		gradientMapChecks(getRenderer);
	});

	describe("DitherEffect, drawn on WebGL", () => {
		ditherChecks(getRenderer);
	});

	describe("GradientMapEffect", () => {
		it("takes two to eight colors, and nothing else", () => {
			const make = (colors) => {
				return forWGSL(GradientMapEffect, { colors });
			};
			expect(() => {
				return make([[1, 0, 0]]);
			}).toThrow(RangeError);
			expect(() => {
				return make(new Array(9).fill([1, 0, 0]));
			}).toThrow(RangeError);
			expect(() => {
				return make([
					[1, 0, 0],
					[0, 1],
				]);
			}).toThrow(TypeError);
			expect(() => {
				return make(new Array(8).fill([1, 0, 0]));
			}).not.toThrow();
		});

		it("setColors refuses a bad list and keeps the one it had", () => {
			const effect = forWGSL(GradientMapEffect, {
				colors: [
					[0, 0, 1],
					[1, 0, 0],
				],
			});
			expect(() => {
				effect.setColors([[1, 1, 1]]);
			}).toThrow(RangeError);
			expect(block(effect, "uColors", 8)).toEqual([0, 0, 1, 1, 1, 0, 0, 1]);
			expect(block(effect, "uCount", 1)).toEqual([2]);
		});

		it("keeps its intensity between 0 and 1", () => {
			const effect = forWGSL(GradientMapEffect);
			expect(effect.intensity).toBe(1);
			effect.setIntensity(4);
			expect(effect.intensity).toBe(1);
			effect.setIntensity(-1);
			expect(effect.intensity).toBe(0);
			expect(block(effect, "uIntensity", 1)).toEqual([0]);
		});

		it("gives its WGSL twin the same values", () => {
			const effect = forWGSL(GradientMapEffect, {
				colors: [
					[0.25, 0.5, 0.75],
					[1, 0, 0, 0.5],
					[0, 1, 0],
				],
				smooth: false,
				intensity: 0.5,
			});
			expect(effect.wgslRealization.valid).toBe(true);
			expect(block(effect, "uColors", 12)).toEqual([
				0.25, 0.5, 0.75, 1, 1, 0, 0, 0.5, 0, 1, 0, 1,
			]);
			expect(block(effect, "uCount", 1)).toEqual([3]);
			expect(block(effect, "uSmooth", 1)).toEqual([0]);
			expect(block(effect, "uIntensity", 1)).toEqual([0.5]);
			// a shorter list leaves none of the longer one behind
			effect.setColors([
				[1, 1, 1],
				[0, 0, 0],
			]);
			expect(block(effect, "uColors", 12)).toEqual([
				1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0,
			]);
		});
	});

	describe("DitherEffect", () => {
		it("takes a palette of two to sixteen colors, and nothing else", () => {
			const make = (palette) => {
				return forWGSL(DitherEffect, { palette });
			};
			expect(() => {
				return make([[1, 0, 0]]);
			}).toThrow(RangeError);
			expect(() => {
				return make(new Array(17).fill([1, 0, 0]));
			}).toThrow(RangeError);
			expect(() => {
				return make([
					[1, 0, 0],
					[0, 1, 0, 1, 1],
				]);
			}).toThrow(TypeError);
			expect(() => {
				return make(new Array(16).fill([1, 0, 0]));
			}).not.toThrow();
		});

		it("keeps its levels, size and strength in range", () => {
			const effect = forWGSL(DitherEffect);
			expect([effect.levels, effect.size, effect.strength]).toEqual([4, 1, 1]);
			effect.setLevels(1);
			expect(effect.levels).toBe(2);
			effect.setLevels(3.6);
			expect(effect.levels).toBe(4);
			effect.setSize(0);
			expect(effect.size).toBe(1);
			effect.setStrength(2);
			expect(effect.strength).toBe(1);
			effect.setStrength(-2);
			expect(effect.strength).toBe(0);
		});

		it("gives its WGSL twin the same values", () => {
			const effect = forWGSL(DitherEffect, {
				palette: [
					[0, 0, 0],
					[1, 1, 1, 0.5],
				],
				levels: 3,
				size: 2,
				strength: 0.25,
			});
			expect(effect.wgslRealization.valid).toBe(true);
			expect(block(effect, "uPalette", 8)).toEqual([0, 0, 0, 1, 1, 1, 1, 0.5]);
			expect(block(effect, "uCount", 1)).toEqual([2]);
			expect(block(effect, "uLevels", 1)).toEqual([3]);
			expect(block(effect, "uPixelSize", 1)).toEqual([2]);
			expect(block(effect, "uStrength", 1)).toEqual([0.25]);
			effect.setPalette(null);
			expect(block(effect, "uCount", 1)).toEqual([0]);
			expect(block(effect, "uPalette", 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
		});
	});
});
