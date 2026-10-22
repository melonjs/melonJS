import "./helpers/webgpu-globals.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	DissolveEffect,
	DropShadowEffect,
	FlashEffect,
	GlowEffect,
	HologramEffect,
	OutlineEffect,
	ShineEffect,
	TintPulseEffect,
} from "../src/index.js";
import { rgba } from "../src/video/effects/rgba.js";
import Renderer from "../src/video/renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Every effect that takes a color takes it as `[r, g, b]` or `[r, g, b, a]`,
 * the alpha being the color's own opacity. An `[r, g, b]` color is opaque and
 * draws as it always has.
 *
 * Before, a fourth value was not ignored but written as it came into a vec3
 * uniform: WebGL rejected it, and on WebGPU it spilled into the next member
 * of the effect's block (an outline's width, for one). And the effects that
 * draw a color over transparent pixels (outline, glow, drop shadow) now hand
 * the batcher a premultiplied color, as everything else it draws is, or a
 * translucent outline would come out too bright.
 */

// [effect, its color uniform, the constructor option, the setter]
const COLORED = [
	[OutlineEffect, "uOutlineColor", "color", "setColor"],
	[GlowEffect, "uGlowColor", "color", "setColor"],
	[DropShadowEffect, "uShadowColor", "color", "setColor"],
	[FlashEffect, "uFlashColor", "color", "setColor"],
	[TintPulseEffect, "uPulseColor", "color", "setColor"],
	[HologramEffect, "uHoloColor", "color", "setColor"],
	[ShineEffect, "uShineColor", "color", "setColor"],
	[DissolveEffect, "uEdgeColor", "edgeColor", "setEdgeColor"],
];

const wgslRenderer = { shaderLanguage: "wgsl", width: 64, height: 64 };

describe("effect colors", () => {
	describe("rgba", () => {
		it("gives an [r, g, b] color an opaque alpha", () => {
			expect(Array.from(rgba([0.25, 0.5, 0.75]))).toEqual([0.25, 0.5, 0.75, 1]);
		});

		it("keeps the alpha of an [r, g, b, a] color", () => {
			expect(Array.from(rgba([1, 0, 0, 0.5]))).toEqual([1, 0, 0, 0.5]);
			expect(Array.from(rgba(new Float32Array([0, 1, 0, 0.25])))).toEqual([
				0, 1, 0, 0.25,
			]);
		});

		it("throws for any other length, rather than spilling", () => {
			expect(() => {
				return rgba([1, 0]);
			}).toThrow(TypeError);
			expect(() => {
				return rgba([1, 0, 0, 1, 1]);
			}).toThrow(TypeError);
		});
	});

	describe.each(COLORED)("%o", (Effect, uniform, option, setter) => {
		const make = (options) => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const effect = new Effect(wgslRenderer, options);
			warn.mockRestore();
			return effect;
		};
		// the color's four floats in the WGSL block, as the GPU will read them
		const read = (effect) => {
			const { layout, f32 } = effect.wgslRealization;
			const at = layout.get(uniform).offset >> 2;
			return Array.from(f32.subarray(at, at + 4));
		};
		// every float of the block outside the color
		const others = (effect) => {
			const { layout, f32 } = effect.wgslRealization;
			const at = layout.get(uniform).offset >> 2;
			return Array.from(f32).filter((_, i) => {
				return i < at || i >= at + 4;
			});
		};

		it("holds its color in a vec4f, clear of every other uniform", () => {
			const effect = make();
			expect(effect.wgslRealization.valid).toBe(true);
			const { layout } = effect.wgslRealization;
			const color = layout.get(uniform);
			expect(color.size).toBe(16);
			for (const [name, place] of layout) {
				if (name !== uniform) {
					const overlaps =
						place.offset < color.offset + 16 &&
						color.offset < place.offset + place.size;
					expect(overlaps, name).toBe(false);
				}
			}
			effect.destroy();
		});

		it("takes [r, g, b, a] from its options", () => {
			const effect = make({ [option]: [0.25, 0.5, 0.75, 0.5] });
			expect(read(effect)).toEqual([0.25, 0.5, 0.75, 0.5]);
			effect.destroy();
		});

		it("draws an [r, g, b] color opaque, as before", () => {
			const effect = make({ [option]: [0.25, 0.5, 0.75] });
			expect(read(effect)).toEqual([0.25, 0.5, 0.75, 1]);
			effect.destroy();
		});

		it("sets an [r, g, b, a] color without touching the next uniform", () => {
			const effect = make();
			const before = others(effect);
			effect[setter]([1, 0, 0, 0.25]);
			expect(read(effect)).toEqual([1, 0, 0, 0.25]);
			expect(others(effect)).toEqual(before);
			effect.destroy();
		});

		it("throws for a color of any other length", () => {
			const effect = make();
			expect(() => {
				effect[setter]([1, 0]);
			}).toThrow(TypeError);
			effect.destroy();
		});
	});

	describe("on WebGL, measured in pixels", () => {
		const SIZE = 64;
		let renderer;
		let sprite;

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
			// 16x16: transparent, with an opaque red square from (2, 2) to
			// (14, 14), so an outline or a shadow has room inside the frame
			sprite = Renderer.createCanvas(16, 16);
			const ctx = sprite.getContext("2d");
			ctx.fillStyle = "#ff0000";
			ctx.fillRect(2, 2, 12, 12);
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

		/** the sprite at (16, 16), 1:1, over black */
		const draw = (effect) => {
			renderer.clearColor("#000000ff");
			renderer.save();
			renderer.customShader = effect;
			renderer.drawImage(sprite, 0, 0, 16, 16, 16, 16, 16, 16);
			renderer.flush();
			renderer.customShader = undefined;
			renderer.restore();
			effect.destroy();
		};

		const near = (actual, expected) => {
			actual.forEach((value, i) => {
				expect(
					Math.abs(value - expected[i]),
					`${actual} vs ${expected}`,
				).toBeLessThanOrEqual(3);
			});
		};

		// the column just left of the red square (texel 1), half way down
		const EDGE = [17, 24];

		it("draws a half-transparent outline at half strength", (ctx) => {
			requireWebGL(ctx);
			draw(
				new OutlineEffect(renderer, {
					color: [1, 1, 1],
					textureSize: [16, 16],
				}),
			);
			near(pixel(...EDGE), [255, 255, 255]);
			// premultiplied over black: half of white. Left straight, it
			// would add the full white and read 255 again
			draw(
				new OutlineEffect(renderer, {
					color: [1, 1, 1, 0.5],
					textureSize: [16, 16],
				}),
			);
			near(pixel(...EDGE), [128, 128, 128]);
		});

		it("draws a half-transparent glow at half strength", (ctx) => {
			requireWebGL(ctx);
			draw(
				new GlowEffect(renderer, {
					color: [1, 1, 1],
					width: 1,
					textureSize: [16, 16],
				}),
			);
			const full = pixel(...EDGE);
			expect(full[0]).toBeGreaterThan(40);
			draw(
				new GlowEffect(renderer, {
					color: [1, 1, 1, 0.5],
					width: 1,
					textureSize: [16, 16],
				}),
			);
			near(
				pixel(...EDGE),
				full.map((v) => {
					return Math.round(v / 2);
				}),
			);
		});

		it("draws a half-transparent drop shadow at half strength", (ctx) => {
			requireWebGL(ctx);
			// 2 texels down and right of the square: texel 15 on the right
			const SHADOW = [31, 24];
			const options = {
				offsetX: 2,
				offsetY: 2,
				opacity: 1,
				textureSize: [16, 16],
			};
			draw(new DropShadowEffect(renderer, { ...options, color: [0, 0, 1] }));
			near(pixel(...SHADOW), [0, 0, 255]);
			draw(
				new DropShadowEffect(renderer, { ...options, color: [0, 0, 1, 0.5] }),
			);
			near(pixel(...SHADOW), [0, 0, 128]);
		});

		it("draws a colored shadow below full opacity at that opacity", (ctx) => {
			requireWebGL(ctx);
			// opacity, not the color's alpha, this time: it was added at full
			// strength too, so a colored shadow came out too bright
			draw(
				new DropShadowEffect(renderer, {
					offsetX: 2,
					offsetY: 2,
					opacity: 0.5,
					color: [0, 0, 1],
					textureSize: [16, 16],
				}),
			);
			near(pixel(31, 24), [0, 0, 128]);
		});

		// the whole frame, to compare two draws pixel for pixel
		const frame = () => {
			const gl = renderer.gl;
			const out = new Uint8Array(SIZE * SIZE * 4);
			gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, out);
			return out;
		};

		it("tints nothing with a fully transparent hologram color", (ctx) => {
			requireWebGL(ctx);
			draw(new HologramEffect(renderer, { color: [0, 1, 1, 0], intensity: 1 }));
			const clear = frame();
			draw(new HologramEffect(renderer, { color: [0, 1, 1], intensity: 0 }));
			expect(clear).toEqual(frame());
			draw(new HologramEffect(renderer, { color: [0, 1, 1], intensity: 1 }));
			expect(clear).not.toEqual(frame());
		});

		it("adds no glint with a fully transparent shine color", (ctx) => {
			requireWebGL(ctx);
			// a wide glint, mid-sweep, so it crosses the sprite
			const shine = (color, intensity) => {
				const effect = new ShineEffect(renderer, {
					color,
					intensity,
					width: 0.5,
				});
				effect.setTime(0.5);
				return effect;
			};
			draw(shine([1, 1, 1, 0], 1));
			const clear = frame();
			draw(shine([1, 1, 1], 0));
			expect(clear).toEqual(frame());
			draw(shine([1, 1, 1], 1));
			expect(clear).not.toEqual(frame());
		});

		it("draws no edge color with a fully transparent dissolve edge", (ctx) => {
			requireWebGL(ctx);
			// half dissolved, a wide edge: whatever the color, at alpha 0 the
			// edge looks the same
			const dissolve = (edgeColor) => {
				return new DissolveEffect(renderer, {
					progress: 0.5,
					edgeWidth: 0.4,
					edgeColor,
				});
			};
			draw(dissolve([0, 0, 1, 0]));
			const blue = frame();
			draw(dissolve([0, 1, 0, 0]));
			expect(blue).toEqual(frame());
			draw(dissolve([0, 1, 0]));
			expect(blue).not.toEqual(frame());
		});

		it("flashes half way with a half-transparent color", (ctx) => {
			requireWebGL(ctx);
			const RED = [24, 24];
			draw(new FlashEffect(renderer, { color: [1, 1, 1], intensity: 1 }));
			near(pixel(...RED), [255, 255, 255]);
			draw(new FlashEffect(renderer, { color: [1, 1, 1, 0.5], intensity: 1 }));
			near(pixel(...RED), [255, 128, 128]);
		});

		it("tints half way with a half-transparent pulse color", (ctx) => {
			requireWebGL(ctx);
			const RED = [24, 24];
			// a quarter of a cycle in: the pulse is at its peak
			const peak = (color) => {
				const pulse = new TintPulseEffect(renderer, {
					color,
					speed: 1,
					intensity: 1,
				});
				pulse.setTime(0.25);
				return pulse;
			};
			draw(peak([0, 1, 0]));
			near(pixel(...RED), [0, 255, 0]);
			draw(peak([0, 1, 0, 0.5]));
			near(pixel(...RED), [128, 128, 0]);
		});
	});
});
