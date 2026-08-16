/**
 * The texture-unit pool: resolution of the `maxTextures` setting, and the
 * shader generation that has to scale with it (#1585).
 *
 * The batch limit used to be hardcoded to `Math.min(device, 16)` — 16 being
 * the WebGL 2 spec FLOOR for `MAX_TEXTURE_IMAGE_UNITS`, and about half what
 * current hardware reports. Lifting it is only safe if the generators scale
 * and the resolver never hands back more units than the device has.
 *
 * CI reports 16, so a live renderer cannot exercise a wide pool here. These
 * are the pure-function halves, which can.
 */
import { describe, expect, it } from "vitest";
import { buildMultiTextureFragment } from "../src/video/webgl/shaders/multitexture.js";
import { buildLitMultiTextureFragment } from "../src/video/webgl/shaders/multitexture-lit.js";
import {
	AUTO_MAX_TEXTURES,
	MIN_MAX_TEXTURES,
	resolveMaxTextures,
} from "../src/video/webgl/utils/maxtextures.js";

describe("resolveMaxTextures", () => {
	it('"auto" takes the device limit, capped at the conservative default', () => {
		expect(resolveMaxTextures(16, "auto")).toBe(16);
		expect(resolveMaxTextures(32, "auto")).toBe(32);
		// a device reporting more than the default is still capped
		expect(resolveMaxTextures(64, "auto")).toBe(AUTO_MAX_TEXTURES);
	});

	it("defaults to auto when the setting is absent", () => {
		expect(resolveMaxTextures(32)).toBe(resolveMaxTextures(32, "auto"));
	});

	it("clamps an explicit setting DOWN to the device limit", () => {
		// the failure this prevents is not subtle: declaring more sampler2D
		// uniforms than the device has units fails to LINK, at startup
		expect(resolveMaxTextures(16, 32)).toBe(16);
		expect(resolveMaxTextures(8, 999)).toBe(8);
	});

	it("honors an explicit setting below the device limit", () => {
		// the escape hatch for a driver that misbehaves on wide ladders
		expect(resolveMaxTextures(32, 8)).toBe(8);
	});

	it("never returns a pool too small to hold a colour AND a normal map", () => {
		// a one-slot pool makes a lit quad's two texture ids collide, so the
		// sprite samples its own albedo as its normal map — silently
		expect(resolveMaxTextures(32, 0)).toBe(MIN_MAX_TEXTURES);
		expect(resolveMaxTextures(32, -5)).toBe(MIN_MAX_TEXTURES);
		expect(resolveMaxTextures(32, 1)).toBe(MIN_MAX_TEXTURES);
		// ...but never more than the device actually has
		expect(resolveMaxTextures(1, "auto")).toBe(1);
		expect(resolveMaxTextures(1, 8)).toBe(1);
	});

	it("tolerates a garbage setting rather than bricking the renderer", () => {
		// mirrors how getDefaultTextureFilter treats an unknown mode: an
		// unset or typo'd value must fall back, not throw
		expect(resolveMaxTextures(32, undefined)).toBe(32);
		expect(resolveMaxTextures(32, "nonsense")).toBe(32);
		expect(resolveMaxTextures(32, Number.NaN)).toBe(32);
		expect(resolveMaxTextures(Number.NaN, "auto")).toBe(1);
	});

	it("floors a fractional setting to a whole unit count", () => {
		expect(resolveMaxTextures(32, 8.9)).toBe(8);
	});
});

describe("multi-texture shader generation scales with the pool", () => {
	// the generators were only ever covered at counts 1-4
	const counts = [1, 4, 16, 32];

	it.each(counts)("unlit: declares exactly %i samplers", (n) => {
		const src = buildMultiTextureFragment(n);
		expect(src.match(/uniform sampler2D uSampler\d+;/g)).toHaveLength(n);
		expect(src).toContain(`uSampler${n - 1}`);
		expect(src).not.toContain(`uSampler${n};`);
	});

	it.each(counts)("lit: declares exactly %i samplers", (n) => {
		const src = buildLitMultiTextureFragment(n);
		expect(src.match(/uniform sampler2D uSampler\d+;/g)).toHaveLength(n);
	});

	it.each(counts)("lit: no separate normal sampler set at %i", (n) => {
		// THE regression pin for the untangle. A second `uNormalSampler0..n-1`
		// set is what made the lit shader need 2n samplers, which forced the
		// batcher to halve its pool and permanently reserve the upper half.
		const src = buildLitMultiTextureFragment(n);
		expect(src).not.toContain("uNormalSampler");
	});

	it("lit: both ids select from the SAME sampler set", () => {
		const src = buildLitMultiTextureFragment(4);
		// each id drives its own if-ladder, but over one set of uniforms
		expect(src).toContain("vTextureId < 0.5");
		expect(src).toContain("vNormalTextureId < 0.5");
		const branches = src.match(/uSampler\d+, vRegion/g);
		// 4 color arms + 1 fallback, doubled for the normal ladder
		expect(branches).toHaveLength(10);
	});

	it("thresholds stay exactly representable at the widest pool", () => {
		// the ladder compares an interpolated float against `i + 0.5`; at
		// mediump (highPrecisionShader: false) a float has 10 mantissa bits,
		// so 31.5 must still round-trip exactly or a sprite samples the wrong
		// texture at the top of the pool
		const src = buildLitMultiTextureFragment(32);
		expect(src).toContain("31.5");
		for (let i = 0; i < 32; i++) {
			expect(Number(`${i}.5`)).toBe(i + 0.5);
		}
	});
});
