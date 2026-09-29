/**
 * `toneMapping` as a renderer setting — the settings-screen entry point.
 *
 * A game exposing HDR options to a player needs three things it can drive
 * from a menu: a curve, a brightness, and a peak. Before this they had to
 * construct a `ToneMappingEffect` and add it to the camera by hand, know that
 * it belongs last, and know not to let a second one accumulate.
 *
 * The load-bearing default is `"none"`. A curve maps 1 to less than 1, so
 * switching one on changes any game whose art is authored against a clamp —
 * which is most 2D art. It is a look decision, and it is NOT implied by
 * `hdr`. That pairing was tried and had to be reverted: it restyled a shipped
 * demo the moment the setting went on.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ToneMappingEffect } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

describe("toneMapping", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	afterEach(() => {
		// shared across specs: a curve left on would grade every later suite
		renderer?.setToneMapping("none");
	});

	/** a stand-in for a camera (managed) or a sprite (not) */
	const host = (managed, effects) => {
		return { postEffects: effects, _postEffectManaged: managed };
	};

	/** an effect that is not a tone map, to stand in for the game's own */
	const someEffect = () => {
		return { enabled: true };
	};

	it("is off by default, and adds nothing", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		expect(renderer.settings.toneMapping).toBe("none");
		const mine = someEffect();
		expect(renderer._effectChainFor(host(true, [mine]))).toEqual([mine]);
	});

	it("appends the curve LAST once a mode is set", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		renderer.setToneMapping("aces");
		const mine = someEffect();
		const chain = renderer._effectChainFor(host(true, [mine]));
		expect(chain).toHaveLength(2);
		// last, so whatever the game put in front of it is mapped too rather
		// than clipping where the two overlap
		expect(chain[0]).toBe(mine);
		expect(chain[1]).toBeInstanceOf(ToneMappingEffect);
		expect(chain[1].mode).toBe("aces");
	});

	it("leaves SPRITE chains alone", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// a sprite's chain is composited back over the scene, and the camera
		// maps that composite — mapping here too would grade the same pixels
		// twice
		renderer.setToneMapping("aces");
		const mine = someEffect();
		expect(renderer._effectChainFor(host(false, [mine]))).toEqual([mine]);
	});

	it("leaves an empty chain empty", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// a camera with no effects needs no render target at all; adding one
		// would force an offscreen round trip for a curve nobody asked to
		// pay for
		renderer.setToneMapping("aces");
		expect(renderer._effectChainFor(host(true, []))).toHaveLength(0);
	});

	it("rebuilds on a mode change and reuses otherwise", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// the curve is BAKED into the program, so the mode is the only
		// parameter that cannot be a uniform write
		renderer.setToneMapping("aces");
		const first = renderer._toneMapEffect;
		renderer.setToneMapping("aces", { exposure: 2 });
		expect(renderer._toneMapEffect).toBe(first);
		expect(first.exposure).toBe(2);

		renderer.setToneMapping("reinhard");
		expect(renderer._toneMapEffect).not.toBe(first);
		expect(renderer._toneMapEffect.mode).toBe("reinhard");
		// and the exposure it was given survives the rebuild
		expect(renderer._toneMapEffect.exposure).toBe(2);
	});

	it("carries exposure and white through, and keeps them on later calls", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		renderer.setToneMapping("reinhard", { exposure: 0.4, white: 2 });
		expect(renderer._toneMapEffect.exposure).toBeCloseTo(0.4, 5);
		expect(renderer._toneMapEffect.white).toBeCloseTo(2, 5);

		// omitted parameters are left as they are, so a settings screen can
		// drive one slider without resetting the others
		renderer.setToneMapping("reinhard", { exposure: 0.8 });
		expect(renderer._toneMapEffect.exposure).toBeCloseTo(0.8, 5);
		expect(renderer._toneMapEffect.white).toBeCloseTo(2, 5);
	});

	it('"none" removes it again', (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		renderer.setToneMapping("aces");
		expect(renderer._toneMapEffect).toBeDefined();
		renderer.setToneMapping("none");
		expect(renderer._toneMapEffect).toBeUndefined();
		const mine = someEffect();
		expect(renderer._effectChainFor(host(true, [mine]))).toEqual([mine]);
	});

	it("is independent of hdr in both directions", (ctx) => {
		if (typeof renderer === "undefined" || !renderer.supportsFloatTargets) {
			ctx.skip();
			return;
		}
		// The pairing this file exists to prevent. `hdr` is headroom through
		// the chain; a curve is a grade. Either without the other is a
		// legitimate thing to want, and coupling them restyled a shipped
		// scene the moment headroom was switched on.
		const realHdr = renderer.settings.hdr;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			renderer.setHDR(true);
			expect(renderer.supportsHDR).toBe(true);
			expect(renderer._toneMapEffect).toBeUndefined();

			renderer.setHDR(false);
			renderer.setToneMapping("aces");
			expect(renderer.supportsHDR).toBe(false);
			expect(renderer._toneMapEffect).toBeDefined();
		} finally {
			warn.mockRestore();
			renderer.setHDR(realHdr === true);
			releaseWebGLRenderer();
		}
	});
});
