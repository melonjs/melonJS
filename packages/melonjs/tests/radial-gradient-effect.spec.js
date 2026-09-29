/**
 * `RadialGradientEffect` — reachable from `melonjs`.
 *
 * It has always been a complete preset: both language bodies, the standard
 * `(renderer, options)` constructor, and a documented `@category Effects`
 * block with five worked examples. It was simply never exported, so every one
 * of those examples was unrunnable and a game wanting a soft spot, a pickup
 * highlight or a damage flash had to bake a canvas instead.
 *
 * The renderers reach it by direct import for `drawLight`, which is why
 * nothing ever failed and nobody noticed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { Color, RadialGradientEffect } from "../src/index.js";

const glslRenderer = { shaderLanguage: "glsl", gl: undefined };
const wgslRenderer = { shaderLanguage: "wgsl" };

const created = [];

function make(renderer, options) {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = new RadialGradientEffect(renderer, options);
	warn.mockRestore();
	created.push(effect);
	return effect;
}

afterEach(() => {
	for (const effect of created.splice(0)) {
		if (!effect.destroyed) {
			effect.destroy();
		}
	}
});

describe("RadialGradientEffect", () => {
	it("is exported from the package entry point", () => {
		// the whole point of this file: `import { RadialGradientEffect } from
		// "melonjs"` used to be a TypeError
		expect(RadialGradientEffect).toBeTypeOf("function");
	});

	it("realizes on both backends, as its siblings do", () => {
		const wgsl = make(wgslRenderer);
		expect(wgsl.wgslRealization).toBeDefined();
		expect(wgsl.wgslRealization.body).toContain("fn apply(");
		// a preset that only carried GLSL would silently do nothing under
		// `video.AUTO` on a machine that picks WebGPU
		expect(make(glslRenderer)).toBeDefined();
	});

	it("defaults to white at full intensity", () => {
		const effect = make(wgslRenderer);
		expect(Array.from(effect._uniformValues.get("uColor"))).toEqual([1, 1, 1]);
		expect(effect._uniformValues.get("uIntensity")).toBe(1);
	});

	it("takes a Color, normalized to 0..1", () => {
		const effect = make(wgslRenderer, {
			color: new Color(255, 128, 64),
			intensity: 0.5,
		});
		const rgb = Array.from(effect._uniformValues.get("uColor"));
		expect(rgb[0]).toBeCloseTo(1, 5);
		expect(rgb[1]).toBeCloseTo(128 / 255, 5);
		expect(rgb[2]).toBeCloseTo(64 / 255, 5);
		expect(effect._uniformValues.get("uIntensity")).toBe(0.5);
	});

	it("reuses one buffer across setColor, rather than allocating per light", () => {
		// `drawLight` drives this per light per frame, which is why the
		// buffer is held rather than rebuilt
		const effect = make(wgslRenderer);
		const first = effect._uniformValues.get("uColor");
		effect.setColor(new Color(10, 20, 30));
		expect(effect._uniformValues.get("uColor")).toBe(first);
		expect(first[0]).toBeCloseTo(10 / 255, 5);
	});

	it("takes an intensity above 1, which over-saturates the centre", () => {
		const effect = make(wgslRenderer);
		effect.setIntensity(2);
		expect(effect._uniformValues.get("uIntensity")).toBe(2);
	});
});
