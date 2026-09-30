/**
 * Adversarial cases for the `hdr` / `hdrOutput` / `toneMapping` setters.
 *
 * These are the calls a settings screen makes, which means they are driven by
 * whatever a slider or a saved config file happens to hold: a stale curve
 * name from an older build, a field that came back from JSON as a string, a
 * value a player dragged to an end stop. None of that should cost a shader
 * rebuild per frame or put a NaN on a uniform.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ToneMappingEffect } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

describe("HDR and tone mapping — adversarial", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	afterEach(() => {
		// shared across specs: a curve or an HDR target left on would grade
		// or reformat every later suite
		renderer?.setToneMapping("none");
		renderer?.setHDR(false);
		renderer?.setHDROutput(false);
	});

	afterAll(() => {
		// this suite moves the colour format, which empties the render-target
		// pool, so hand back a fresh renderer rather than a used one
		releaseWebGLRenderer();
	});

	describe("setToneMapping with a mode it does not know", () => {
		it("refuses a plausible typo instead of substituting a curve", () => {
			// Substituting a default silently is what made this worth testing.
			// `mode` is baked into the program, so `_resolveToneMapping`
			// rebuilds only when it changed — and it compares against the
			// effect's OWN mode, which a substituting effect reports as the
			// substitute. The comparison then never matches, so a settings
			// screen holding one stale name recompiled the program on every
			// call, forever, while showing a curve nobody asked for.
			expect(() => {
				return renderer.setToneMapping("reinhardt");
			}).toThrow(/unknown mode "reinhardt"/);
		});

		it("is case sensitive, and says so rather than guessing", () => {
			expect(() => {
				return renderer.setToneMapping("ACES");
			}).toThrow(/unknown mode/);
		});

		it("names the curves it does have", () => {
			// the message is the whole value of refusing: a caller who cannot
			// see the valid set just tries another guess
			expect(() => {
				return renderer.setToneMapping("filmic");
			}).toThrow(/"aces"/);
		});

		it("leaves the settings untouched when it refuses", () => {
			// half-applied, the next `_resolveToneMapping` from a resize or a
			// context restore would pick the bad value up on its own and throw
			// somewhere with no connection to this call
			renderer.setToneMapping("reinhard");
			expect(() => {
				return renderer.setToneMapping("nope");
			}).toThrow();
			expect(renderer.settings.toneMapping).toBe("reinhard");
			expect(renderer._toneMapEffect.mode).toBe("reinhard");
		});

		it("keeps the same effect across repeated known modes", () => {
			// the control, and the property the refusal above protects
			renderer.setToneMapping("reinhard");
			const first = renderer._toneMapEffect;
			renderer.setToneMapping("reinhard");
			expect(renderer._toneMapEffect).toBe(first);
		});
	});

	describe("setToneMapping with hostile numbers", () => {
		it("refuses a NaN exposure rather than putting it on the uniform", () => {
			// `Math.max(0, NaN)` is NaN, so the old clamp read like a guard
			// and was not one. A NaN uniform multiplies the whole frame to
			// NaN, which renders as black or as garbage depending on the
			// driver and reports nothing: the game's own broken arithmetic
			// surfaces as a blank screen an hour later.
			expect(() => {
				return renderer.setToneMapping("aces", { exposure: Number.NaN });
			}).toThrow(/exposure must be a finite number/);
		});

		it("refuses an infinite exposure", () => {
			expect(() => {
				return renderer.setToneMapping("aces", {
					exposure: Number.POSITIVE_INFINITY,
				});
			}).toThrow(/finite/);
		});

		it("refuses a NaN white point", () => {
			expect(() => {
				return renderer.setToneMapping("aces", { white: Number.NaN });
			}).toThrow(/white must be a finite number/);
		});

		it("leaves the settings untouched when a number is refused", () => {
			renderer.setToneMapping("aces", { exposure: 1.5 });
			expect(() => {
				return renderer.setToneMapping("reinhard", {
					exposure: Number.NaN,
				});
			}).toThrow();
			expect(renderer.settings.toneMapping).toBe("aces");
			expect(renderer.settings.toneMappingExposure).toBe(1.5);
		});

		it("clamps a negative exposure to black rather than inverting", () => {
			// negative is a finite number, and it has a sensible reading: no
			// light. Multiplying by it would invert the image and then clip.
			renderer.setToneMapping("aces", { exposure: -5 });
			expect(renderer._toneMapEffect._uniformValues.get("uExposure")).toBe(0);
		});

		it("takes a white point near zero at its word", () => {
			// `white` names the value that comes out as display white, so a
			// tiny one asks for a blown-out frame and gets one. Deliberately
			// not clamped: there is no principled bound to clamp to, and a
			// slider that reaches zero has `0` for "leave the shoulder
			// alone". Worth knowing that under `hdr` the scale can exceed
			// what a half-float target holds.
			renderer.setToneMapping("reinhard", { white: 1e-9 });
			const scale = renderer._toneMapEffect._uniformValues.get("uWhiteScale");
			expect(Number.isFinite(scale)).toBe(true);
			expect(scale).toBeGreaterThan(1e8);
		});

		it("keeps the white scale sane at the largest finite white point", () => {
			// `1 / curve(white)` where the curve saturates: the reciprocal of
			// something that came out as 0 or NaN would blow the frame out
			renderer.setToneMapping("reinhard", { white: Number.MAX_VALUE });
			const scale = renderer._toneMapEffect._uniformValues.get("uWhiteScale");
			expect(Number.isFinite(scale)).toBe(true);
			expect(scale).toBeGreaterThan(0);
		});
	});

	describe("setToneMapping state carried across calls", () => {
		it("applies parameters that were set while the curve was off", () => {
			// a settings screen writes all three whatever the curve is
			renderer.setToneMapping("none", { exposure: 3, white: 4 });
			expect(renderer._toneMapEffect).toBeUndefined();
			renderer.setToneMapping("aces");
			expect(
				renderer._toneMapEffect._uniformValues.get("uExposure"),
			).toBeCloseTo(3, 5);
			expect(renderer._toneMapEffect.white).toBeCloseTo(4, 5);
		});

		it("keeps the parameters when only the curve changes", () => {
			renderer.setToneMapping("aces", { exposure: 2.5 });
			renderer.setToneMapping("exponential");
			expect(
				renderer._toneMapEffect._uniformValues.get("uExposure"),
			).toBeCloseTo(2.5, 5);
		});

		it("drops the effect on the way back to none", () => {
			renderer.setToneMapping("aces");
			expect(renderer._toneMapEffect).toBeDefined();
			renderer.setToneMapping("none");
			expect(renderer._toneMapEffect).toBeUndefined();
		});

		it("survives being switched off twice", () => {
			renderer.setToneMapping("none");
			renderer.setToneMapping("none");
			expect(renderer._toneMapEffect).toBeUndefined();
		});
	});

	describe("ToneMappingEffect built directly", () => {
		it("refuses a curve it cannot build", () => {
			// the renderer is not the only door: an effect constructed by hand
			// with a stale mode has to fail the same way
			expect(() => {
				return new ToneMappingEffect(renderer, { mode: "filmic" });
			}).toThrow(/unknown mode "filmic"/);
		});

		it("refuses a non-finite exposure at construction", () => {
			expect(() => {
				return new ToneMappingEffect(renderer, {
					exposure: Number.NaN,
				});
			}).toThrow(/finite/);
		});

		it("refuses a non-finite white point at construction", () => {
			expect(() => {
				return new ToneMappingEffect(renderer, { white: Number.NaN });
			}).toThrow(/white must be a finite number/);
		});

		it("refuses a non-finite value on the setters themselves", () => {
			// the setters are public and documented as safe to drive per
			// frame, which is exactly where a tween that went NaN arrives
			const effect = new ToneMappingEffect(renderer, { mode: "aces" });
			expect(() => {
				return effect.setExposure(Number.NaN);
			}).toThrow(/exposure must be a finite number/);
			expect(() => {
				return effect.setWhite(Number.POSITIVE_INFINITY);
			}).toThrow(/white must be a finite number/);
			// and the refusal left the good values in place
			expect(effect.exposure).toBe(1);
			expect(effect.white).toBe(0);
			effect.destroy();
		});

		it("reports back the mode it was given", () => {
			const effect = new ToneMappingEffect(renderer, {
				mode: "exponential",
			});
			expect(effect.mode).toBe("exponential");
			effect.destroy();
		});
	});

	describe("toggling hdr and hdrOutput", () => {
		it("returns to the starting format after a round trip", () => {
			const before = renderer._colorFormat;
			renderer.setHDR(true);
			renderer.setHDR(false);
			expect(renderer._colorFormat).toBe(before);
			expect(renderer.supportsHDR).toBe(false);
		});

		it("is idempotent when asked for the same state twice", () => {
			renderer.setHDR(true);
			const granted = renderer.supportsHDR;
			const format = renderer._colorFormat;
			renderer.setHDR(true);
			expect(renderer.supportsHDR).toBe(granted);
			expect(renderer._colorFormat).toBe(format);
		});

		it("reports what was granted, not what was asked", () => {
			renderer.setHDR(true);
			// the one invariant that holds on every backend and driver
			expect(renderer.supportsHDR).toBe(
				renderer.settings.hdr === true &&
					renderer.supportsFloatTargets === true,
			);
		});

		it("does not grant HDR output on WebGL, whatever hdr says", () => {
			// the WebGL2 equivalent is an unapproved specification change that
			// no browser implements
			renderer.setHDR(true);
			renderer.setHDROutput(true);
			expect(renderer.supportsHDROutput).toBe(false);
		});

		it("records the hdrOutput request even when it cannot be granted", () => {
			// so a game can tell "asked for and refused" from "never asked"
			renderer.setHDROutput(true);
			expect(renderer.settings.hdrOutput).toBe(true);
			expect(renderer.supportsHDROutput).toBe(false);
		});
	});

	// LAST in the file on purpose: these swap the GL context underneath the
	// shared renderer, so nothing after them should rely on the old one
	describe("surviving a context loss", () => {
		const tick = () => {
			return new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		};

		/** the extension, or undefined when this browser will not lose one */
		const loseContextExt = (ctx) => {
			requireWebGL(ctx, renderer);
			const ext = renderer.gl.getExtension("WEBGL_lose_context");
			if (!ext) {
				ctx.skip("WEBGL_lose_context unavailable");
			}
			return ext;
		};

		it("holds the colour format across a restore", async (ctx) => {
			const ext = loseContextExt(ctx);
			renderer.setHDR(true);
			const granted = renderer.supportsHDR;
			const format = renderer._colorFormat;

			ext.loseContext();
			await tick();
			ext.restoreContext();
			await tick();
			await tick();

			expect(renderer.supportsHDR).toBe(granted);
			expect(renderer._colorFormat).toBe(format);
		});

		it("downgrades when the restored context will not give float targets", async (ctx) => {
			// The case the restore path exists for, and the reason the test
			// above cannot stand alone: `gl.RGBA16F` is the same number in any
			// context, so simply carrying the old format over looks identical
			// to re-resolving it. A restored context is a NEW context and need
			// not offer what the old one did; left alone, every target would
			// be asked for a half-float format the driver can no longer give.
			const ext = loseContextExt(ctx);
			renderer.setHDR(true);
			if (renderer.supportsHDR !== true) {
				ctx.skip("this driver has no float targets to begin with");
			}
			const real = renderer.extension.bind(renderer);
			renderer.extension = (name) => {
				return name.startsWith("EXT_color_buffer_") ? null : real(name);
			};
			try {
				ext.loseContext();
				await tick();
				ext.restoreContext();
				await tick();
				await tick();

				expect(renderer.supportsFloatTargets).toBe(false);
				expect(renderer.supportsHDR).toBe(false);
				expect(renderer._colorFormat).toBe(renderer.gl.RGBA8);
			} finally {
				// the stub left `supportsFloatTargets` false, and it only
				// settles again on the next loss. Re-derive now so whatever is
				// added after this test is handed a truthful renderer.
				renderer.extension = real;
				renderer._deriveCapabilities();
				renderer._resolveColorFormat();
			}
		});

		it("keeps the tone curve and its exposure across a restore", async (ctx) => {
			// the curve is renderer-owned and shared between cameras, so if
			// anything were to be left holding a dead program it would be this
			const ext = loseContextExt(ctx);
			renderer.setToneMapping("reinhard", { exposure: 2.25 });

			ext.loseContext();
			await tick();
			ext.restoreContext();
			await tick();
			await tick();

			expect(renderer._toneMapEffect.mode).toBe("reinhard");
			expect(
				renderer._toneMapEffect._uniformValues.get("uExposure"),
			).toBeCloseTo(2.25, 5);
		});
	});
});
