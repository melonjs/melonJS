import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Text } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Adversarial coverage of immutable texture storage (#1556):
 * `createTexture2D` allocates every non-resource texture with
 * `texStorage2D` (complete mip chain, sized RGBA8) and updates contents
 * with `texSubImage2D`. Same-size re-uploads must keep the SAME texture
 * object (the cheap path the whole engine is built around); any shape
 * change must replace the texture outright — immutable storage can never
 * be respecified, and doing so raises INVALID_OPERATION.
 */
describe("createTexture2D — immutable storage", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeCanvas = (w, h, color = "#ff0000") => {
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, w, h);
		return canvas;
	};

	const batcher = () => {
		return renderer.batchers.get("quad");
	};

	it("a plain image upload allocates IMMUTABLE storage with a full mip chain", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const canvas = makeCanvas(64, 32);
		const atlas = renderer.cache.get(canvas);
		batcher().uploadTexture(atlas);
		// the texture the upload left bound
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_FORMAT)).toBe(
			true,
		);
		// full chain for a 64×32 base: log2(64) + 1 = 7 levels
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_LEVELS)).toBe(
			7,
		);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("same-size forced re-uploads keep the SAME texture object and never re-allocate", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const canvas = makeCanvas(32, 32);
		const atlas = renderer.cache.get(canvas);
		const b = batcher();
		const unit = b.uploadTexture(atlas, undefined, undefined, true, true);
		const texture = b.boundTextures[unit];
		expect(texture).toBeDefined();

		const storageSpy = vi.spyOn(gl, "texStorage2D");
		const subSpy = vi.spyOn(gl, "texSubImage2D");
		// repaint the SAME canvas (same size) and force re-upload — the
		// video / Text / gradient steady-state path
		canvas.getContext("2d").fillStyle = "#00ff00";
		canvas.getContext("2d").fillRect(0, 0, 32, 32);
		for (let i = 0; i < 3; i++) {
			const u = b.uploadTexture(atlas, undefined, undefined, true, true);
			expect(b.boundTextures[u]).toBe(texture); // identity stable
		}
		expect(storageSpy).not.toHaveBeenCalled(); // zero re-allocations
		expect(subSpy).toHaveBeenCalledTimes(3); // pure data copies
		expect(gl.getError()).toBe(gl.NO_ERROR);
		storageSpy.mockRestore();
		subSpy.mockRestore();
	});

	it("a size change REPLACES the texture object (immutable storage can't be respecified)", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const canvas = makeCanvas(16, 16);
		const atlas = renderer.cache.get(canvas);
		const b = batcher();
		const unit = b.uploadTexture(atlas, undefined, undefined, true, true);
		const before = b.boundTextures[unit];

		// grow the SAME canvas element (the video-gains-dimensions / Text
		// bucket-crossing scenario: same source identity, new shape)
		canvas.width = 64;
		canvas.height = 64;
		canvas.getContext("2d").fillRect(0, 0, 64, 64);
		const u2 = b.uploadTexture(atlas, undefined, undefined, true, true);
		const after = b.boundTextures[u2];
		expect(after).not.toBe(before);
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_FORMAT)).toBe(
			true,
		);
		// and the whole exchange raised no GL error — the adversarial point:
		// a respecify attempt on immutable storage would INVALID_OPERATION
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("nearest-filtered (mipmap-relevant) and blank allocations stay error-free", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		// blank allocation path (pixels === null): storage alone, WebGL
		// guarantees zero-initialized contents
		const b = batcher();
		b.createTexture2D(7, null, gl.NEAREST, "no-repeat", 8, 8, false, false);
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_FORMAT)).toBe(
			true,
		);
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_LEVELS)).toBe(
			1, // mipmap=false → single level
		);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("a ticking Text stays on texSubImage2D forever (the integration payoff)", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const t = new Text(0, 0, {
			font: "Arial",
			size: 16,
			text: "Score: 10",
			fillStyle: "#ffffff",
		});
		// first draw uploads + allocates
		t.preDraw(renderer);
		t.draw(renderer);
		t.postDraw(renderer);
		renderer.flush();

		const storageSpy = vi.spyOn(gl, "texStorage2D");
		for (const s of ["Score: 11", "Score: 12", "Score: 13"]) {
			t.setText(s);
			t.preDraw(renderer);
			t.draw(renderer);
			t.postDraw(renderer);
			renderer.flush();
		}
		// 32px buckets keep the canvas shape → immutable storage is never
		// re-allocated across ticks
		expect(storageSpy).not.toHaveBeenCalled();
		expect(gl.getError()).toBe(gl.NO_ERROR);
		storageSpy.mockRestore();
		t.destroy();
	});

	it("raw pixel-view uploads land in immutable storage too", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const b = batcher();
		const pixels = new Uint8Array(4 * 4 * 4).fill(255);
		b.createTexture2D(7, pixels, gl.LINEAR, "no-repeat", 4, 4, false, true);
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_IMMUTABLE_FORMAT)).toBe(
			true,
		);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});
});
