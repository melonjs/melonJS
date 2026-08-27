/**
 * The six CSS blend modes that fixed-function blending cannot express
 * (`overlay`, `hard-light`, `color-dodge`, `color-burn`, `soft-light`,
 * `difference`), verified against the Canvas renderer.
 *
 * Two oracles, deliberately:
 *
 * - a CPU implementation of the W3C formulas (`blendReference` /
 *   `compositeReference` in `helpers/pixels.js`), which pins the exact
 *   arithmetic per channel
 * - the Canvas renderer, which implements all six natively through
 *   `globalCompositeOperation`. That one is INDEPENDENT of anything written
 *   here, so it catches a formula that was misread from the spec in the same
 *   way twice — the failure mode a hand-written reference cannot see.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, Rect, video } from "../src/index.js";
import { ADVANCED_BLEND_MODES } from "../src/video/blendmodes.js";
import BlendEffect, { wgslFragment } from "../src/video/effects/blendEffect.js";
import ShaderEffect from "../src/video/effects/shadereffect.js";
import { parseWGSLBody } from "../src/video/effects/wgsl/parse.js";
import { buildWGSLModule } from "../src/video/effects/wgsl/scaffold.js";
import { Gradient } from "../src/video/gradient.js";
import {
	blendReference,
	compositeReference,
	expectPixelClose,
	readPixel,
	readPixelFrom,
} from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

const SIZE = 64;
// two opaque colours with enough spread that every formula lands somewhere
// distinctive — a mid backdrop and a bright source
const BACKDROP = [34, 102, 221];
const SOURCE = [221, 68, 34];

describe("BlendEffect (the compositing shader)", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	it("compiles and is enabled", (ctx) => {
		requireWebGL(ctx, renderer);
		const effect = new BlendEffect(renderer);
		// a body that fails to parse or compile leaves the effect an inert
		// stub with `enabled === false` and only a console warning, so
		// asserting on `enabled` is what catches a shader syntax error
		expect(effect.enabled).toBe(true);
		expect(effect._shader).toBeDefined();
		effect.destroy();
	});

	it("declares the backdrop sampler and the mode uniform", (ctx) => {
		requireWebGL(ctx, renderer);
		const effect = new BlendEffect(renderer);
		expect(effect._shader.uniforms.backdrop).toBeDefined();
		expect(effect._shader.uniforms.uBlendMode).toBeDefined();
		effect.destroy();
	});

	it("does NOT claim the shared frame-capture slot", (ctx) => {
		requireWebGL(ctx, renderer);
		const effect = new BlendEffect(renderer);
		// it samples `screen_uv` but deliberately avoids the
		// `: screen_texture` annotation, so the renderer's shared capture
		// stays free for a user effect on the same renderable
		expect(effect._screenTextureUniforms ?? []).toHaveLength(0);
		effect.destroy();
	});

	it("maps every advanced mode to a distinct uniform index", (ctx) => {
		requireWebGL(ctx, renderer);
		const effect = new BlendEffect(renderer);
		const seen = new Set();
		for (const mode of ADVANCED_BLEND_MODES) {
			expect(effect.setBlendMode(mode), `${mode} should be accepted`).toBe(
				true,
			);
			const index = effect._shader._uniformCache?.uBlendMode;
			seen.add(index);
		}
		expect(seen.size).toBe(ADVANCED_BLEND_MODES.length);
		// a fixed-function mode is rejected rather than silently selecting 0
		expect(effect.setBlendMode("multiply")).toBe(false);
		effect.destroy();
	});
});

describe("BlendEffect WGSL body (device-free)", () => {
	// headless chromium has no WebGPU, so a device-compiled check would skip
	// in CI and let this body rot. The parser runs anywhere and still catches
	// the structural mistakes: a bad binding layout, an unsupported uniform
	// member type, a missing `apply` signature.
	it("parses cleanly", () => {
		const parsed = parseWGSLBody(wgslFragment);
		expect(parsed.error ?? null, parsed.error).toBe(null);
		expect(parsed.ok).toBe(true);
	});

	it("declares the backdrop texture with its sampler at the next binding", () => {
		const parsed = parseWGSLBody(wgslFragment);
		expect(parsed.textures).toHaveLength(1);
		expect(parsed.textures[0].name).toBe("backdrop");
		expect(parsed.textures[0].samplerBinding).toBe(
			parsed.textures[0].binding + 1,
		);
	});

	it("activates screen_uv without claiming the shared capture", () => {
		const parsed = parseWGSLBody(wgslFragment);
		expect(parsed.builtins.screenUV).toBe(true);
		// `screen_texture` is the SHARED slot builtin — this effect binds its
		// own capture instead, so a user effect on the same renderable can
		// still sample the screen
		expect(parsed.builtins.screenTexture).toBe(false);
	});

	it("assembles into a complete module", () => {
		const parsed = parseWGSLBody(wgslFragment);
		const { code } = buildWGSLModule(wgslFragment, parsed);
		expect(code).toContain("fn apply");
		expect(code).toContain("vertex_main");
		expect(code).toContain("fragment_main");
		// the scaffold places its builtin bindings ABOVE the user's, so the
		// backdrop pair must survive untouched at 1 and 2
		expect(code).toContain("@group(3) @binding(1) var backdrop");
	});

	it("keeps the GLSL and WGSL bodies structurally in step", () => {
		// the two bodies must expose the same uniform name and the same six
		// formulas — a mode added to one and not the other is the classic
		// dual-language drift, and it renders wrong on one backend only
		expect(wgslFragment).toContain("uBlendMode");
		for (const fn of [
			"ME_hardLight",
			"ME_softLight",
			"ME_colorDodge",
			"ME_colorBurn",
			"ME_blend",
		]) {
			expect(wgslFragment, `WGSL is missing ${fn}`).toContain(fn);
		}
	});
});

describe("advanced blend modes (WebGL, by pixel)", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(SIZE, SIZE);
		if (renderer !== undefined) {
			// a bare harness never runs a frame, which is what normally
			// installs the camera's ortho projection — set it up once so
			// world coordinates land on canvas pixels like in a real game
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/**
	 * paint the backdrop, then a smaller rect over it in `mode`
	 * @param {string} mode - blend mode for the second rect
	 * @param {number[]} backdrop - `[r, g, b]`
	 * @param {number[]} source - `[r, g, b]`
	 * @param {number} alpha - source alpha
	 */
	const composite = (mode, backdrop = BACKDROP, source = SOURCE, alpha = 1) => {
		renderer.setBlendMode("normal");
		renderer.setGlobalAlpha(1);
		renderer.setColor(`rgb(${backdrop.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode(mode);
		renderer.setGlobalAlpha(alpha);
		renderer.setColor(`rgb(${source.join(",")})`);
		renderer.fillRect(8, 8, SIZE - 16, SIZE - 16);
		renderer.setBlendMode("normal");
		renderer.setGlobalAlpha(1);
		renderer.flush();
	};

	// One colour pair exercises one point of each formula, and the primary
	// pair happens to be degenerate in two ways: SOURCE is very nearly
	// 255-BACKDROP, which drives `color-burn` to [0,0,0] on all three
	// channels — and "renders black" is this feature's known failure
	// signature, so a broken capture would PASS. It also never satisfies
	// `Cs > 0.5 && Cb > 0.25` on any channel, leaving soft-light's `sqrt(Cb)`
	// branch unevaluated. The second pair is chosen so `color-dodge` lands
	// interior on R, `color-burn` interior on G and B, and soft-light takes
	// the sqrt branch on G.
	const PAIRS = [
		{ name: "primary", backdrop: BACKDROP, source: SOURCE },
		{ name: "second", backdrop: [60, 150, 200], source: [180, 200, 120] },
	];
	const CASES = PAIRS.flatMap(({ name, backdrop, source }) => {
		return ADVANCED_BLEND_MODES.map((mode) => {
			return { mode, name, backdrop, source };
		});
	});

	it.for(CASES)(
		"$mode matches the W3C formula ($name colours)",
		async ({ mode, backdrop, source }, ctx) => {
			requireWebGL(ctx, renderer);
			composite(mode, backdrop, source);
			const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
			const expected = blendReference(mode, backdrop, source);
			expectPixelClose(px, [...expected, 255], 3, mode);
		},
	);

	it.for(ADVANCED_BLEND_MODES)(
		"%s composites a TRANSLUCENT source per the full W3C formula",
		async (mode, ctx) => {
			requireWebGL(ctx, renderer);
			// At alpha 1 the whole premultiply pipeline is an identity: the
			// shader's un-premultiply, its re-premultiply, and the source-over
			// that finishes the composite all collapse. Every one of those
			// steps can be deleted without an opaque test noticing. This is
			// the case that actually exercises them.
			const alpha = 0.6;
			composite(mode, BACKDROP, SOURCE, alpha);
			const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
			const expected = compositeReference(mode, BACKDROP, SOURCE, alpha);
			expectPixelClose(px, [...expected, 255], 4, `${mode} @ a=${alpha}`);
		},
	);

	it.for(ADVANCED_BLEND_MODES)(
		"%s samples the backdrop per-pixel, not at one fixed coordinate",
		async (mode, ctx) => {
			requireWebGL(ctx, renderer);
			// Every other pixel test paints a UNIFORM backdrop, which makes the
			// capture's texture coordinates unobservable — sampling it at
			// vec2(0.5), or with the y flipped, yields the same answer
			// everywhere. That matters because the two backends deliberately
			// use OPPOSITE screen_uv conventions (y-up in GLSL, y-down in
			// WGSL) to match their opposite capture orientations, and nothing
			// else pins that claim.
			const top = [40, 60, 200];
			const bottom = [200, 180, 40];
			renderer.setBlendMode("normal");
			renderer.setGlobalAlpha(1);
			renderer.setColor(`rgb(${top.join(",")})`);
			renderer.fillRect(0, 0, SIZE, SIZE / 2);
			renderer.setColor(`rgb(${bottom.join(",")})`);
			renderer.fillRect(0, SIZE / 2, SIZE, SIZE / 2);
			renderer.setBlendMode(mode);
			renderer.setColor(`rgb(${SOURCE.join(",")})`);
			renderer.fillRect(0, 0, SIZE, SIZE);
			renderer.setBlendMode("normal");
			renderer.flush();

			const upper = await readPixel(renderer, SIZE / 2, SIZE / 4);
			const lower = await readPixel(renderer, SIZE / 2, (SIZE * 3) / 4);
			expectPixelClose(
				upper,
				[...blendReference(mode, top, SOURCE), 255],
				3,
				`${mode} upper half`,
			);
			expectPixelClose(
				lower,
				[...blendReference(mode, bottom, SOURCE), 255],
				3,
				`${mode} lower half`,
			);
			// and the two halves must actually differ, or the test proves
			// nothing about coordinates
			expect(
				Math.max(
					...[0, 1, 2].map((i) => {
						return Math.abs(upper[i] - lower[i]);
					}),
				),
				`${mode}: the two halves rendered identically`,
			).toBeGreaterThan(8);
		},
	);

	it("handles the W3C corner cases for color-dodge and color-burn", async (ctx) => {
		requireWebGL(ctx, renderer);
		// The spec gives these four overrides precedence over the generic
		// division, and the guarded divisions in the shader only coincide with
		// them by luck at 8-bit. An unguarded 0/0 regression would surface
		// here and nowhere else.
		const BLACK = [0, 0, 0];
		const WHITE = [255, 255, 255];
		const corners = [
			// color-dodge: Cb == 0 -> 0, even against a full-strength source
			{ mode: "color-dodge", backdrop: BLACK, source: WHITE },
			// color-dodge: Cs == 1 -> 1
			{ mode: "color-dodge", backdrop: [128, 128, 128], source: WHITE },
			// color-burn: Cb == 1 -> 1
			{ mode: "color-burn", backdrop: WHITE, source: BLACK },
			// color-burn: Cs == 0 -> 0
			{ mode: "color-burn", backdrop: [128, 128, 128], source: BLACK },
		];
		for (const { mode, backdrop, source } of corners) {
			composite(mode, backdrop, source);
			const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
			const expected = blendReference(mode, backdrop, source);
			expectPixelClose(
				px,
				[...expected, 255],
				3,
				`${mode} Cb=${backdrop[0]} Cs=${source[0]}`,
			);
		}
	});

	it.for(ADVANCED_BLEND_MODES)(
		"%s differs from what normal would produce",
		async (mode, ctx) => {
			requireWebGL(ctx, renderer);
			// the positive control: without this, a mode that silently fell
			// back to "normal" would pass every assertion above that happens
			// to sit near the source colour
			composite("normal");
			const asNormal = await readPixel(renderer, SIZE / 2, SIZE / 2);
			composite(mode);
			const asMode = await readPixel(renderer, SIZE / 2, SIZE / 2);
			const delta = Math.max(
				...[0, 1, 2].map((i) => {
					return Math.abs(asNormal[i] - asMode[i]);
				}),
			);
			expect(delta, `${mode} rendered identically to normal`).toBeGreaterThan(
				4,
			);
		},
	);

	it("leaves the mode behind: a plain draw after an advanced one is plain", async (ctx) => {
		requireWebGL(ctx, renderer);
		// the regression this design exists to prevent — an advanced mode
		// that never gets cleared paints every subsequent draw
		composite("difference");
		renderer.setBlendMode("normal");
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.flush();
		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(px, [...SOURCE, 255], 2, "plain draw after advanced");
	});

	it("reports the mode it applied, and getBlendMode agrees", (ctx) => {
		requireWebGL(ctx, renderer);
		for (const mode of ADVANCED_BLEND_MODES) {
			expect(renderer.setBlendMode(mode), `${mode} should report itself`).toBe(
				mode,
			);
			expect(renderer.getBlendMode(), `${mode} via getBlendMode`).toBe(mode);
		}
		renderer.setBlendMode("normal");
	});
});

describe("advanced blend modes — adversarial mixing (WebGL)", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(SIZE, SIZE);
		if (renderer !== undefined) {
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const fill = (mode, color, x, y, w, h) => {
		renderer.setBlendMode(mode);
		renderer.setColor(`rgb(${color.join(",")})`);
		renderer.fillRect(x, y, w, h);
	};

	const base = () => {
		fill("normal", BACKDROP, 0, 0, SIZE, SIZE);
	};

	it("A → B → A in one frame keeps each mode's own formula", async (ctx) => {
		requireWebGL(ctx, renderer);
		// a stale uBlendMode between brackets would make the third band
		// render with the SECOND mode's formula — the uniform is on a shared
		// effect instance, so this is a live hazard rather than a theoretical
		// one
		base();
		fill("difference", SOURCE, 0, 0, SIZE, 20);
		fill("color-dodge", SOURCE, 0, 20, SIZE, 20);
		fill("difference", SOURCE, 0, 40, SIZE, 20);
		renderer.setBlendMode("normal");
		renderer.flush();

		const first = await readPixel(renderer, SIZE / 2, 10);
		const second = await readPixel(renderer, SIZE / 2, 30);
		const third = await readPixel(renderer, SIZE / 2, 50);

		expectPixelClose(
			first,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"first difference band",
		);
		expectPixelClose(
			second,
			[...blendReference("color-dodge", BACKDROP, SOURCE), 255],
			3,
			"color-dodge band",
		);
		// the one that actually catches a stale uniform
		expectPixelClose(third, first, 2, "difference after color-dodge");
	});

	it("interleaves with a fixed-function mode without disturbing it", async (ctx) => {
		requireWebGL(ctx, renderer);
		// the bracket forces normal source-over behind the fixed-function
		// blend cache's back — the same bug class as the ground-shadow cache
		// fix. Asserted by PIXEL, not by inspecting renderer state.
		base();
		fill("multiply", SOURCE, 0, 0, SIZE, 20);
		renderer.setBlendMode("normal");
		renderer.flush();
		const multiplyAlone = await readPixel(renderer, SIZE / 2, 10);

		base();
		fill("difference", SOURCE, 0, 40, SIZE, 20);
		fill("multiply", SOURCE, 0, 0, SIZE, 20);
		renderer.setBlendMode("normal");
		renderer.flush();
		const multiplyAfterAdvanced = await readPixel(renderer, SIZE / 2, 10);

		expectPixelClose(
			multiplyAfterAdvanced,
			multiplyAlone,
			2,
			"multiply after an advanced draw",
		);
	});

	it("two overlapping same-mode draws: the second sees the first's result", async (ctx) => {
		requireWebGL(ctx, renderer);
		// this is the per-draw semantics made concrete. A per-RUN design would
		// coalesce both draws against the original backdrop and fail here.
		base();
		fill("difference", SOURCE, 0, 0, SIZE, SIZE);
		fill("difference", SOURCE, 0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.flush();
		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);

		// difference applied twice with the same source returns the backdrop:
		// |‖b-s|-s| == b whenever s <= b, and these colours are chosen so the
		// round trip is exact on at least one channel
		const once = blendReference("difference", BACKDROP, SOURCE);
		const twice = blendReference("difference", once, SOURCE);
		expectPixelClose(px, [...twice, 255], 3, "difference applied twice");
		// and it must NOT look like a single application
		const delta = Math.max(
			...[0, 1, 2].map((i) => {
				return Math.abs(once[i] - twice[i]);
			}),
		);
		expect(delta, "the two draws did not stack").toBeGreaterThan(4);
	});

	it("survives save/restore nesting", async (ctx) => {
		requireWebGL(ctx, renderer);
		base();
		renderer.save();
		renderer.setBlendMode("difference");
		renderer.save();
		renderer.setBlendMode("multiply");
		renderer.restore();
		// back to difference — and the bracket must still be armed
		expect(renderer.getBlendMode()).toBe("difference");
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.restore();
		renderer.flush();
		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"difference inside save/restore",
		);
	});

	it("composites a bracketed draw that is the last of the frame", async (ctx) => {
		requireWebGL(ctx, renderer);
		// nothing calls setBatcher after the final draw, so only the flush
		// hook can close this bracket. Without it the draw is stranded in an
		// offscreen target and never reaches the canvas.
		base();
		renderer.setBlendMode("difference");
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.flush();
		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"last draw of the frame",
		);
	});

	it("blends a SPRITE, not just a shape", async (ctx) => {
		requireWebGL(ctx, renderer);
		// the example draws shapes, but `sprite.blendMode` through drawImage
		// is the path most games actually use
		const source = document.createElement("canvas");
		source.width = 8;
		source.height = 8;
		const sctx = source.getContext("2d");
		sctx.fillStyle = `rgb(${SOURCE.join(",")})`;
		sctx.fillRect(0, 0, 8, 8);

		base();
		renderer.setBlendMode("difference");
		renderer.setColor("#ffffff");
		renderer.drawImage(source, 0, 0, 8, 8, 0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.flush();

		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"difference on a textured quad",
		);
	});

	const solidCanvas = (rgb) => {
		const c = document.createElement("canvas");
		c.width = 8;
		c.height = 8;
		const x = c.getContext("2d");
		x.fillStyle = `rgb(${rgb.join(",")})`;
		x.fillRect(0, 0, 8, 8);
		return c;
	};

	it("blends a sprite with OTHER textures already in flight", async (ctx) => {
		requireWebGL(ctx, renderer);
		// Every other textured test here draws exactly one image, so the quad
		// batcher never has to juggle texture units and the blended source is
		// always already resident. A real scene never looks like that — and
		// with more than one texture in play the composite was consuming an
		// already-composited operand, which renders as the blend applied
		// twice.
		base();
		renderer.setColor("#ffffff");
		renderer.drawImage(solidCanvas([10, 200, 90]), 0, 0, 8, 8, 0, 0, 8, 8);
		renderer.drawImage(solidCanvas([250, 250, 10]), 0, 0, 8, 8, 8, 0, 8, 8);
		renderer.setBlendMode("difference");
		renderer.drawImage(solidCanvas(SOURCE), 0, 0, 8, 8, 0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.flush();

		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"sprite blended amongst other textures",
		);
	});

	it("blends two consecutive draws that use DIFFERENT textures", async (ctx) => {
		requireWebGL(ctx, renderer);
		// each bracket must composite its OWN source against the live
		// framebuffer; sharing one offscreen between them must not leak the
		// first draw's result into the second
		const first = [10, 200, 90];
		base();
		renderer.setColor("#ffffff");
		renderer.setBlendMode("difference");
		renderer.drawImage(solidCanvas(first), 0, 0, 8, 8, 0, 0, SIZE, SIZE);
		renderer.drawImage(solidCanvas(SOURCE), 0, 0, 8, 8, 0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.flush();

		const afterFirst = blendReference("difference", BACKDROP, first);
		const expected = blendReference("difference", afterFirst, SOURCE);
		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(px, [...expected, 255], 4, "two textured advanced draws");
	});

	it("clipRect confines a bracketed draw", async (ctx) => {
		requireWebGL(ctx, renderer);
		base();
		renderer.save();
		renderer.clipRect(0, 0, SIZE, 16);
		renderer.setBlendMode("difference");
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.restore();
		renderer.flush();

		const inside = await readPixel(renderer, SIZE / 2, 8);
		const outside = await readPixel(renderer, SIZE / 2, 40);
		expectPixelClose(
			inside,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"inside the clip",
		);
		expectPixelClose(outside, [...BACKDROP, 255], 2, "outside the clip");
	});

	it("setMask clips a bracketed draw", async (ctx) => {
		requireWebGL(ctx, renderer);
		// the offscreen carries its OWN zeroed stencil, so an armed mask would
		// reject every fragment and the draw would silently vanish. The GL
		// bracket disables the test for the offscreen and lets the COMPOSITE
		// carry the clip instead — this is that decision, asserted.
		base();
		renderer.setMask(new Rect(0, 0, SIZE, 16));
		renderer.setBlendMode("difference");
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.clearMask();
		renderer.flush();

		const inside = await readPixel(renderer, SIZE / 2, 8);
		const outside = await readPixel(renderer, SIZE / 2, 40);
		expectPixelClose(
			inside,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			3,
			"inside the mask",
		);
		expectPixelClose(outside, [...BACKDROP, 255], 2, "outside the mask");
	});

	it("combines with a renderable's own ShaderEffect (customShader fast path)", async (ctx) => {
		requireWebGL(ctx, renderer);
		// the single-effect fast path sets renderer.customShader, which the
		// bracket must leave alone: the effect transforms the source, then the
		// blend composites that result against the backdrop
		const source = document.createElement("canvas");
		source.width = 8;
		source.height = 8;
		const sctx = source.getContext("2d");
		sctx.fillStyle = `rgb(${SOURCE.join(",")})`;
		sctx.fillRect(0, 0, 8, 8);

		// swaps red and blue, so we can tell the effect actually ran
		const swizzle = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return vec4(color.bgr, color.a); }",
		);
		const swapped = [SOURCE[2], SOURCE[1], SOURCE[0]];

		base();
		renderer.setBlendMode("difference");
		renderer.customShader = swizzle;
		renderer.setColor("#ffffff");
		renderer.drawImage(source, 0, 0, 8, 8, 0, 0, SIZE, SIZE);
		renderer.customShader = undefined;
		renderer.setBlendMode("normal");
		renderer.flush();

		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, swapped), 255],
			3,
			"effect then blend",
		);
		swizzle.destroy();
	});

	it("does not fight a screen-sampling ShaderEffect over the capture", async (ctx) => {
		requireWebGL(ctx, renderer);
		// BOTH want a frame capture. The blend effect deliberately binds a
		// renderer-OWNED capture rather than the shared `screen_texture` slot,
		// because drawImage refreshes that shared slot on behalf of any custom
		// shader that samples the screen — sharing it would leave one of them
		// compositing against the wrong backdrop.
		const source = document.createElement("canvas");
		source.width = 8;
		source.height = 8;
		const sctx = source.getContext("2d");
		sctx.fillStyle = "#ffffff";
		sctx.fillRect(0, 0, 8, 8);

		// returns the backdrop verbatim, so the effect's own capture is what
		// reaches the blend — if the two collided this lands somewhere else
		const readsScreen = new ShaderEffect(
			renderer,
			`uniform sampler2D screenTex : screen_texture;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(texture2D(screenTex, screen_uv).rgb, color.a);
			}`,
		);
		expect(readsScreen.enabled).toBe(true);
		expect(readsScreen._screenTextureUniforms.length).toBeGreaterThan(0);

		base();
		renderer.setBlendMode("difference");
		renderer.customShader = readsScreen;
		renderer.setColor("#ffffff");
		renderer.drawImage(source, 0, 0, 8, 8, 0, 0, SIZE, SIZE);
		renderer.customShader = undefined;
		renderer.setBlendMode("normal");
		renderer.flush();

		// source == backdrop, and difference(b, b) == 0
		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(px, [0, 0, 0, 255], 4, "difference against itself");
		readsScreen.destroy();
	});

	it("composites correctly inside a camera post-effect pass", async (ctx) => {
		requireWebGL(ctx, renderer);
		// nested targets: the bracket must return to the POST-EFFECT target,
		// not to the canvas, or the draw lands outside the pass and the pass
		// then paints over it
		const tint = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		const holder = {
			postEffects: [tint, tint],
			_postEffectManaged: true,
			isDefault: true,
			screenX: 0,
			screenY: 0,
			width: SIZE,
			height: SIZE,
		};

		renderer.beginPostEffect(holder);
		base();
		renderer.setBlendMode("difference");
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.endPostEffect(holder);
		renderer.flush();

		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			4,
			"bracket inside a post-effect pass",
		);
		tint.destroy();
	});

	it("a stencil-masked gradient SHAPE falls back to normal, loudly", (ctx) => {
		requireWebGL(ctx, renderer);
		// Only the shapes that route through `#gradientMask` are excluded —
		// it drives the stencil itself and re-enters the fill methods, which
		// the bracket would corrupt. A gradient fillRect is NOT excluded: it
		// bakes to a texture and goes out through drawImage like any sprite,
		// so it brackets normally. Asserted separately below.
		const warnings = [];
		const original = console.warn;
		console.warn = (...args) => {
			warnings.push(args.join(" "));
		};
		try {
			renderer._advancedBlendWarned.clear();
			const gradient = new Gradient("linear", [0, 0, SIZE, 0]);
			gradient.addColorStop(0, "#ff0000");
			gradient.addColorStop(1, "#0000ff");
			renderer.setColor(gradient);
			renderer.setBlendMode("difference");
			// fillEllipse takes the #gradientMask path; fillRect does not
			renderer.fillEllipse(SIZE / 2, SIZE / 2, 20, 20);
			renderer.setBlendMode("normal");
			renderer.setColor("#ffffff");
			renderer.flush();
		} finally {
			console.warn = original;
		}
		expect(
			warnings.some((w) => {
				return w.includes("difference") && w.includes("gradient");
			}),
			`expected a gradient fallback warning, got: ${warnings.join(" | ")}`,
		).toBe(true);
	});

	it("a gradient fillRect blends like any other textured draw", async (ctx) => {
		requireWebGL(ctx, renderer);
		// A gradient rect bakes to a texture and goes out through drawImage, so
		// there is nothing special about it once the renderer's program cache
		// tells the truth. It used to render black, then to fall back — both
		// were symptoms of the cache desync fixed in
		// `shadereffect-program-cache.spec.js`, not of anything gradient-shaped.
		// Only the STENCIL-driven gradient shapes stay excluded, below.
		const mkGradient = () => {
			const g = new Gradient("linear", [0, 0, SIZE, 0]);
			g.addColorStop(0, `rgb(${SOURCE.join(",")})`);
			g.addColorStop(1, `rgb(${SOURCE.join(",")})`);
			return g;
		};

		base();
		renderer.setColor(mkGradient());
		renderer.setBlendMode("difference");
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.setColor("#ffffff");
		renderer.flush();

		const px = await readPixel(renderer, SIZE / 2, SIZE / 2);
		expectPixelClose(
			px,
			[...blendReference("difference", BACKDROP, SOURCE), 255],
			4,
			"gradient fillRect under difference",
		);
	});

	it("a mesh draw under an advanced mode falls back to normal, loudly", (ctx) => {
		requireWebGL(ctx, renderer);
		// the exclusion must be a DRAW-TIME decision and it must warn — a
		// silent, data-dependent fallback is what this feature exists to
		// remove
		const warnings = [];
		let opened;
		const original = console.warn;
		console.warn = (...args) => {
			warnings.push(args.join(" "));
		};
		try {
			renderer._advancedBlendWarned.clear();
			renderer.setBlendMode("difference");
			renderer.setBatcher("mesh");
			// warning AND no bracket: a fallback that warns and then brackets
			// anyway would pass a warning-only assertion while still breaking
			// the depth testing the exclusion exists to protect
			opened = renderer._advancedBlendOpen;
			renderer.setBatcher("quad");
			renderer.setBlendMode("normal");
			renderer.flush();
		} finally {
			console.warn = original;
		}
		expect(opened, "the bracket opened for a mesh draw").toBe(false);
		expect(
			warnings.some((w) => {
				return w.includes("difference") && w.includes("3D meshes");
			}),
			`expected a mesh fallback warning, got: ${warnings.join(" | ")}`,
		).toBe(true);
	});
});

describe("advanced blend modes: WebGL vs the Canvas renderer", () => {
	// The INDEPENDENT oracle. `blendReference` and the shader were both
	// written from the same W3C text by the same author, so a formula
	// misread in the same way twice passes every test above. Canvas
	// implements all six natively through `globalCompositeOperation`, which
	// is the browser's own implementation and shares nothing with this
	// repository.
	let gl;
	let canvas2d;
	let canvasApp;

	beforeAll(async () => {
		gl = await getWebGLRenderer(SIZE, SIZE);
		if (gl !== undefined) {
			gl.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			gl.currentBatcher.setProjection(gl.projectionMatrix);
		}
		canvasApp = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: video.CANVAS,
			antiAlias: false,
		});
		await canvasApp.init();
		canvas2d = canvasApp.renderer;
	});

	afterAll(() => {
		releaseWebGLRenderer();
		// browsers cap live contexts — a leak surfaces as UNRELATED specs failing
		canvasApp?.destroy();
	});

	const paint = (renderer, mode, alpha) => {
		renderer.setBlendMode("normal");
		renderer.setGlobalAlpha(1);
		renderer.setColor(`rgb(${BACKDROP.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode(mode);
		renderer.setGlobalAlpha(alpha);
		renderer.setColor(`rgb(${SOURCE.join(",")})`);
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.setBlendMode("normal");
		renderer.setGlobalAlpha(1);
		renderer.flush();
	};

	it.for(ADVANCED_BLEND_MODES)(
		"%s matches what the browser's own implementation produces",
		async (mode, ctx) => {
			requireWebGL(ctx, gl);
			expect(
				canvas2d.setBlendMode(mode),
				`Canvas must support ${mode} for this comparison to mean anything`,
			).toBe(mode);
			paint(gl, mode, 1);
			paint(canvas2d, mode, 1);
			const [fromGL, fromCanvas] = await readPixelFrom(
				[gl, canvas2d],
				SIZE / 2,
				SIZE / 2,
			);
			expectPixelClose(fromGL, fromCanvas, 3, `${mode} vs Canvas`);
		},
	);

	it.for(ADVANCED_BLEND_MODES)(
		"%s matches Canvas with a translucent source too",
		async (mode, ctx) => {
			requireWebGL(ctx, gl);
			// The GPU path composites through a PREMULTIPLIED capture where
			// Canvas works on straight colour, so this is the case most likely
			// to diverge — and the one a hand-written reference cannot judge,
			// since it encodes the same assumption the shader does.
			paint(gl, mode, 0.6);
			paint(canvas2d, mode, 0.6);
			const [fromGL, fromCanvas] = await readPixelFrom(
				[gl, canvas2d],
				SIZE / 2,
				SIZE / 2,
			);
			expectPixelClose(fromGL, fromCanvas, 4, `${mode} @ a=0.6 vs Canvas`);
		},
	);
});
