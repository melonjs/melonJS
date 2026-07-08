import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	NoiseTexture2d,
	ShaderEffect,
	Texture2d,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * `ShaderEffect.setTexture(name, image)` binds an extra `sampler2D` (a noise
 * map, mask, gradient, flow table…) beyond the sprite/target it post-processes
 * (`uSampler`). The engine uploads/caches the texture, (re)binds it to a
 * reserved high unit each draw, and points the sampler uniform at it — so the
 * user never touches raw WebGL texture units (issue #1532).
 */
const SIZE = 16;

function solidCanvas(r, g, b) {
	const c = document.createElement("canvas");
	c.width = SIZE;
	c.height = SIZE;
	const ctx = c.getContext("2d");
	ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
	ctx.fillRect(0, 0, SIZE, SIZE);
	return c;
}

describe("ShaderEffect.setTexture (extra sampler binding)", () => {
	let renderer;
	let gl;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(SIZE, SIZE, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
			antiAlias: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	// draw a full-screen quad through the single-effect customShader path and
	// read back the centre pixel
	function drawCentrePixel(effect, source) {
		renderer.save();
		renderer.customShader = effect;
		renderer.drawImage(source, 0, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();
		const px = new Uint8Array(4);
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	}

	it("samples an extra texture bound by name, end-to-end", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const blue = solidCanvas(0, 0, 255);
		const red = solidCanvas(255, 0, 0);

		// control: a passthrough effect draws the (blue) source unchanged
		const passthrough = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		const control = drawCentrePixel(passthrough, blue);
		expect(control[2]).toBeGreaterThan(200); // blue source
		expect(control[0]).toBeLessThan(60);

		// extra: output the extra texture (red), ignoring the blue source —
		// so a red pixel proves the extra sampler was uploaded, bound, and
		// wired to the right unit
		const extra = new ShaderEffect(
			renderer,
			"uniform sampler2D uExtra;\nvec4 apply(vec4 color, vec2 uv) { return texture2D(uExtra, uv); }",
		);
		extra.setTexture("uExtra", red);
		const sampled = drawCentrePixel(extra, blue);
		expect(sampled[0]).toBeGreaterThan(200); // red — extra texture sampled
		expect(sampled[2]).toBeLessThan(60);

		passthrough.destroy();
		extra.destroy();
	});

	it("accepts a Texture2d asset directly, without the .getTexture() dance", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const blue = solidCanvas(0, 0, 255);

		// a minimal Texture2d subclass wrapping a red canvas — the same
		// contract every texture asset (TextureAtlas, NoiseTexture2d…)
		// implements
		class CanvasTexture extends Texture2d {
			constructor(canvas) {
				super();
				this._canvas = canvas;
			}
			getTexture() {
				return this._canvas;
			}
		}

		const effect = new ShaderEffect(
			renderer,
			"uniform sampler2D uExtra;\nvec4 apply(vec4 color, vec2 uv) { return texture2D(uExtra, uv); }",
		);
		// the asset object itself — not asset.getTexture()
		effect.setTexture("uExtra", new CanvasTexture(solidCanvas(255, 0, 0)));
		const sampled = drawCentrePixel(effect, blue);
		expect(sampled[0]).toBeGreaterThan(200); // red — asset resolved + sampled
		expect(sampled[2]).toBeLessThan(60);
		effect.destroy();
	});

	it("accepts a NoiseTexture2d asset directly (the documented idiom, minus .getTexture())", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const blue = solidCanvas(0, 0, 255);
		const noise = new NoiseTexture2d({ width: SIZE, height: SIZE });
		const effect = new ShaderEffect(
			renderer,
			"uniform sampler2D uNoise;\nvec4 apply(vec4 color, vec2 uv) { return vec4(vec3(texture2D(uNoise, uv).r), 1.0); }",
		);
		effect.setTexture("uNoise", noise);
		const sampled = drawCentrePixel(effect, blue);
		// noise output is greyscale: not the blue source, and alpha intact —
		// proves the asset was resolved to its baked canvas and sampled
		expect(sampled[0]).toBe(sampled[2]); // grey: r === b
		expect(sampled[3]).toBe(255);
		effect.destroy();
		noise.destroy();
	});

	it("uploads to a reserved unit, sets the sampler, caches, and frees on destroy", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const red = solidCanvas(255, 0, 0);
		const fx = new ShaderEffect(
			renderer,
			"uniform sampler2D uExtra;\nvec4 apply(vec4 color, vec2 uv) { return texture2D(uExtra, uv); }",
		);
		expect(fx.setTexture("uExtra", red)).toBe(fx); // chainable

		const batcher = renderer.setBatcher("quad");
		batcher.useShader(fx);
		fx._prepareTextures(batcher);

		// bound to the top reserved unit, not the low rotating pool
		const unit = batcher.maxBatchTextures - 1;
		const entry = fx._extraTextures.get("uExtra");
		expect(gl.isTexture(entry.tex)).toBe(true);
		expect(entry.tex).toBe(batcher.boundTextures[unit]);

		// sampler uniform points at that unit
		const loc = gl.getUniformLocation(fx._shader.program, "uExtra");
		expect(gl.getUniform(fx._shader.program, loc)).toBe(unit);

		// a second prepare reuses the same GL texture (upload once, rebind after)
		const first = entry.tex;
		fx._prepareTextures(batcher);
		expect(entry.tex).toBe(first);

		// destroy releases the GL texture and clears the map
		fx.destroy();
		expect(gl.isTexture(first)).toBe(false);
		expect(fx._extraTextures.size).toBe(0);
	});

	// #1533 review: the reserved unit must be held out of the texture cache's
	// allocator, or a sprite's own texture could be handed the same unit in the
	// single-effect customShader path and clobber the extra sampler.
	it("reserves its unit against the allocator and releases it on destroy", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const cache = renderer.cache;
		cache.resetUnitAssignments();

		const red = solidCanvas(255, 0, 0);
		const fx = new ShaderEffect(
			renderer,
			"uniform sampler2D uExtra;\nvec4 apply(vec4 color, vec2 uv) { return texture2D(uExtra, uv); }",
		);
		fx.setTexture("uExtra", red);

		const batcher = renderer.setBatcher("quad");
		batcher.useShader(fx);
		fx._prepareTextures(batcher);

		const unit = batcher.maxBatchTextures - 1;
		expect(cache.reservedUnits.has(unit)).toBe(true);

		// fill every unit below the reserved one, then the next allocation must
		// SKIP the reserved unit rather than hand it out
		for (let u = 0; u < unit; u++) {
			cache.allocateTextureUnit();
		}
		expect(cache.allocateTextureUnit()).not.toBe(unit);
		cache.resetUnitAssignments(); // clean up (reservations survive)

		fx.destroy();
		expect(cache.reservedUnits.has(unit)).toBe(false);
	});
});
