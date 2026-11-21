import "./helpers/webgpu-globals.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	ColorMatrixEffect,
	FlashEffect,
	ShaderEffect,
	TintPulseEffect,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * A flash and a tint pulse blend every pixel toward one color. On the
 * premultiplied colors an effect is given, that is a color matrix, so both
 * are a `ColorMatrixEffect` and share its shader, where each had one of its
 * own.
 *
 * What has to hold: the picture is the one the old shaders drew, the colors
 * and options mean what they did, and a game that set the old uniforms by
 * name still works.
 */

/** the sixteen floats of an effect's matrix, column-major */
const matrixOf = (effect) => {
	return Array.from(effect._matrix.val).map((v) => {
		return Math.round(v * 1e6) / 1e6;
	});
};

/** the matrix of a blend toward [r, g, b], `k` of the way */
const blend = ([r, g, b], k) => {
	const keep = Math.round((1 - k) * 1e6) / 1e6;
	const part = (v) => {
		return Math.round(v * k * 1e6) / 1e6;
	};
	return [
		keep,
		0,
		0,
		0,
		0,
		keep,
		0,
		0,
		0,
		0,
		keep,
		0,
		part(r),
		part(g),
		part(b),
		1,
	];
};

const IDENTITY = blend([0, 0, 0], 0);

const wgslRenderer = { shaderLanguage: "wgsl", width: 64, height: 64 };

/** an effect on a WGSL renderer, with no device needed to check its matrix */
const make = (Effect, options) => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = new Effect(wgslRenderer, options);
	warn.mockRestore();
	return effect;
};

describe("a flash and a tint pulse, as color matrices", () => {
	describe("FlashEffect", () => {
		it("is a ColorMatrixEffect, and still a ShaderEffect", () => {
			const flash = make(FlashEffect);
			expect(flash).toBeInstanceOf(ColorMatrixEffect);
			expect(flash).toBeInstanceOf(ShaderEffect);
			expect(flash.wgslRealization.valid).toBe(true);
			flash.destroy();
		});

		it("shares the color matrix shader, with a matrix as its only uniform", () => {
			const flash = make(FlashEffect);
			const matrix = make(ColorMatrixEffect);
			expect([...flash.wgslRealization.layout.keys()]).toEqual([
				...matrix.wgslRealization.layout.keys(),
			]);
			expect([...flash.wgslRealization.layout.keys()]).toEqual([
				"uColorMatrix",
			]);
			flash.destroy();
			matrix.destroy();
		});

		it("leaves the sprite as it is by default: white, at no intensity", () => {
			const flash = make(FlashEffect);
			expect(flash.intensity).toBe(0);
			expect(matrixOf(flash)).toEqual(IDENTITY);
			flash.destroy();
		});

		it("blends toward its color by its intensity", () => {
			const flash = make(FlashEffect, { color: [1, 0.5, 0], intensity: 0.25 });
			expect(matrixOf(flash)).toEqual(blend([1, 0.5, 0], 0.25));
			flash.setIntensity(1);
			expect(flash.intensity).toBe(1);
			expect(matrixOf(flash)).toEqual(blend([1, 0.5, 0], 1));
			flash.destroy();
		});

		it("scales the intensity by the color's alpha", () => {
			const flash = make(FlashEffect, { color: [1, 1, 1, 0.5], intensity: 1 });
			expect(matrixOf(flash)).toEqual(blend([1, 1, 1], 0.5));
			flash.destroy();
		});

		it("setIntensity keeps the intensity between 0 and 1", () => {
			const flash = make(FlashEffect, { color: [1, 0, 0] });
			flash.setIntensity(3);
			expect(flash.intensity).toBe(1);
			flash.setIntensity(-1);
			expect(flash.intensity).toBe(0);
			expect(matrixOf(flash)).toEqual(IDENTITY);
			flash.destroy();
		});

		it("setColor changes the color, at the intensity it had", () => {
			const flash = make(FlashEffect, { intensity: 0.5 });
			flash.setColor([0, 0, 1]);
			expect(matrixOf(flash)).toEqual(blend([0, 0, 1], 0.5));
			flash.setColor([0, 0, 1, 0.5]);
			expect(matrixOf(flash)).toEqual(blend([0, 0, 1], 0.25));
			expect(() => {
				flash.setColor([1, 0]);
			}).toThrow(TypeError);
			flash.destroy();
		});

		it("the uniforms its own shader had still set it, by name", () => {
			const flash = make(FlashEffect);
			flash.setUniform("uFlashIntensity", 0.75);
			expect(flash.intensity).toBe(0.75);
			expect(matrixOf(flash)).toEqual(blend([1, 1, 1], 0.75));
			flash.setUniform("uFlashColor", [1, 0, 0, 1]);
			expect(matrixOf(flash)).toEqual(blend([1, 0, 0], 0.75));
			flash.setUniform("uFlashIntensity", 0);
			expect(matrixOf(flash)).toEqual(IDENTITY);
			flash.destroy();
		});
	});

	describe("TintPulseEffect", () => {
		it("is a ColorMatrixEffect, sharing its shader", () => {
			const pulse = make(TintPulseEffect);
			expect(pulse).toBeInstanceOf(ColorMatrixEffect);
			expect(pulse.wgslRealization.valid).toBe(true);
			expect([...pulse.wgslRealization.layout.keys()]).toEqual([
				"uColorMatrix",
			]);
			pulse.destroy();
		});

		it("takes its defaults: red, twice a second, up to 0.3", () => {
			const pulse = make(TintPulseEffect);
			expect(pulse.speed).toBe(2);
			expect(pulse.intensity).toBe(0.3);
			// at time 0 the wave is half way up
			expect(matrixOf(pulse)).toEqual(blend([1, 0, 0], 0.15));
			pulse.destroy();
		});

		it("goes from none to its intensity and back, `speed` times a second", () => {
			const pulse = make(TintPulseEffect, {
				color: [0, 1, 0],
				speed: 1,
				intensity: 0.8,
			});
			// a quarter of a cycle in: the peak
			pulse.setTime(0.25);
			expect(matrixOf(pulse)).toEqual(blend([0, 1, 0], 0.8));
			// three quarters in: none
			pulse.setTime(0.75);
			expect(matrixOf(pulse)).toEqual(IDENTITY);
			// a whole cycle later, the same as at the start
			pulse.setTime(1);
			expect(matrixOf(pulse)).toEqual(blend([0, 1, 0], 0.4));
			// twice as fast, the peak comes at an eighth of a second
			const fast = make(TintPulseEffect, {
				color: [0, 1, 0],
				speed: 2,
				intensity: 0.8,
			});
			fast.setTime(0.125);
			expect(matrixOf(fast)).toEqual(blend([0, 1, 0], 0.8));
			pulse.destroy();
			fast.destroy();
		});

		it("scales the tint by the color's alpha, and takes a new color", () => {
			const pulse = make(TintPulseEffect, {
				color: [0, 1, 0, 0.5],
				speed: 1,
				intensity: 1,
			});
			pulse.setTime(0.25);
			expect(matrixOf(pulse)).toEqual(blend([0, 1, 0], 0.5));
			pulse.setColor([0, 0, 1]);
			expect(matrixOf(pulse)).toEqual(blend([0, 0, 1], 1));
			expect(() => {
				pulse.setColor([1, 0, 0, 1, 1]);
			}).toThrow(TypeError);
			pulse.destroy();
		});

		it("the uniforms its own shader had still set it, by name", () => {
			const pulse = make(TintPulseEffect, { color: [1, 0, 0], intensity: 1 });
			pulse.setUniform("uPulseSpeed", 1);
			pulse.setUniform("uTime", 0.25);
			expect(pulse.speed).toBe(1);
			expect(matrixOf(pulse)).toEqual(blend([1, 0, 0], 1));
			pulse.setUniform("uPulseIntensity", 0.5);
			expect(pulse.intensity).toBe(0.5);
			expect(matrixOf(pulse)).toEqual(blend([1, 0, 0], 0.5));
			pulse.setUniform("uPulseColor", [0, 0, 1, 1]);
			expect(matrixOf(pulse)).toEqual(blend([0, 0, 1], 0.5));
			pulse.destroy();
		});
	});

	describe("on WebGL, against the shaders they had", () => {
		const SIZE = 64;
		let renderer;
		let sprite;

		// the bodies the two effects were drawn with, before
		const OLD_FLASH = `
			uniform vec4 uFlashColor;
			uniform float uFlashIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(mix(color.rgb, uFlashColor.rgb * color.a, uFlashIntensity * uFlashColor.a), color.a);
			}
		`;
		const OLD_PULSE = `
			uniform vec4 uPulseColor;
			uniform float uPulseSpeed;
			uniform float uPulseIntensity;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				float pulse = (sin(uTime * uPulseSpeed * 6.2832) * 0.5 + 0.5) * uPulseIntensity;
				return vec4(mix(color.rgb, uPulseColor.rgb * color.a, pulse * uPulseColor.a), color.a);
			}
		`;

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
			// 32x32, every kind of pixel a sprite has: opaque colors, a
			// gradient, and half and quarter transparent ones over nothing
			sprite = Renderer.createCanvas(32, 32);
			const ctx = sprite.getContext("2d");
			const ramp = ctx.createLinearGradient(0, 0, 32, 0);
			ramp.addColorStop(0, "#102080");
			ramp.addColorStop(1, "#f0c020");
			ctx.fillStyle = ramp;
			ctx.fillRect(0, 0, 32, 12);
			ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
			ctx.fillRect(0, 12, 16, 10);
			ctx.fillStyle = "rgba(0, 255, 64, 0.25)";
			ctx.fillRect(16, 12, 16, 10);
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(4, 24, 24, 6);
		});

		afterAll(() => {
			releaseWebGLRenderer();
		});

		const requireWebGL = (ctx) => {
			if (renderer === undefined) {
				ctx.skip("WebGL renderer not available in this environment");
			}
		};

		/** the sprite drawn with an effect over a mid grey, as its pixels */
		const drawn = (effect) => {
			renderer.clearColor("#404040ff");
			renderer.save();
			renderer.customShader = effect;
			renderer.drawImage(sprite, 0, 0, 32, 32, 16, 16, 32, 32);
			renderer.flush();
			renderer.customShader = undefined;
			renderer.restore();
			effect.destroy();
			const gl = renderer.gl;
			const out = new Uint8Array(SIZE * SIZE * 4);
			gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
			return out;
		};

		/** the largest difference between two frames, in 8-bit steps */
		const furthest = (a, b) => {
			let most = 0;
			for (let i = 0; i < a.length; i++) {
				most = Math.max(most, Math.abs(a[i] - b[i]));
			}
			return most;
		};

		const oldFlash = (color, intensity) => {
			const effect = new ShaderEffect(renderer, OLD_FLASH);
			effect.setUniform("uFlashColor", new Float32Array(color));
			effect.setUniform("uFlashIntensity", intensity);
			return effect;
		};

		const oldPulse = (color, speed, intensity, time) => {
			const effect = new ShaderEffect(renderer, OLD_PULSE);
			effect.setUniform("uPulseColor", new Float32Array(color));
			effect.setUniform("uPulseSpeed", speed);
			effect.setUniform("uPulseIntensity", intensity);
			effect.setUniform("uTime", time);
			return effect;
		};

		it("the test sprite is drawn, and a flash changes it", (ctx) => {
			requireWebGL(ctx);
			const plain = drawn(new FlashEffect(renderer, { intensity: 0 }));
			const white = drawn(new FlashEffect(renderer, { intensity: 1 }));
			expect(furthest(plain, white)).toBeGreaterThan(100);
		});

		it.for([
			{ color: [1, 1, 1, 1], intensity: 0 },
			{ color: [1, 1, 1, 1], intensity: 0.3 },
			{ color: [1, 1, 1, 1], intensity: 1 },
			{ color: [1, 0, 0, 1], intensity: 0.6 },
			{ color: [0.2, 0.9, 0.4, 0.5], intensity: 1 },
			{ color: [0, 0, 0, 1], intensity: 0.8 },
			{ color: [1, 1, 1, 0], intensity: 1 },
		])(
			"a flash of $color at $intensity is the picture its own shader drew",
			(flash, ctx) => {
				requireWebGL(ctx);
				const now = drawn(
					new FlashEffect(renderer, {
						color: flash.color,
						intensity: flash.intensity,
					}),
				);
				const before = drawn(oldFlash(flash.color, flash.intensity));
				// the same arithmetic in another order: a rounding step at most
				expect(furthest(now, before)).toBeLessThanOrEqual(1);
			},
		);

		it.for([
			{ color: [1, 0, 0, 1], speed: 2, intensity: 0.3, time: 0 },
			{ color: [0, 1, 0, 1], speed: 1, intensity: 1, time: 0.25 },
			{ color: [0, 1, 0, 1], speed: 1, intensity: 1, time: 0.75 },
			{ color: [0.1, 0.4, 1, 0.5], speed: 3, intensity: 0.8, time: 1.37 },
			{ color: [1, 0.8, 0, 0.35], speed: 2, intensity: 0.3, time: 12.4 },
		])(
			"a pulse of $color at $time s is the picture its own shader drew",
			(pulse, ctx) => {
				requireWebGL(ctx);
				const effect = new TintPulseEffect(renderer, {
					color: pulse.color,
					speed: pulse.speed,
					intensity: pulse.intensity,
				});
				effect.setTime(pulse.time);
				const now = drawn(effect);
				const before = drawn(
					oldPulse(pulse.color, pulse.speed, pulse.intensity, pulse.time),
				);
				expect(furthest(now, before)).toBeLessThanOrEqual(1);
			},
		);
	});
});
