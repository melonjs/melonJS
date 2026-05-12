import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import {
	BufferTextureResource,
	TextureResource,
} from "../src/video/texture/resource.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";

describe("TextureResource", () => {
	it("requires subclasses to implement upload()", () => {
		const r = new TextureResource({ width: 4, height: 4 });
		expect(() => {
			r.upload(null, 0);
		}).toThrow();
	});

	it("exposes a TextureAtlas-shaped surface for the cache", () => {
		const r = new TextureResource({
			width: 16,
			height: 8,
			premultipliedAlpha: false,
			repeat: "repeat",
			filter: 9728, // gl.NEAREST
		});
		expect(r.width).toBe(16);
		expect(r.height).toBe(8);
		expect(r.premultipliedAlpha).toBe(false);
		expect(r.repeat).toBe("repeat");
		expect(r.filter).toBe(9728);
		// minimal `TextureAtlas`-shaped surface the cache walks via
		// `sources.get(activeAtlas)`
		expect(r.sources).toBeInstanceOf(Map);
		expect(r.sources.size).toBe(1);
		expect(r.sources.get(r.activeAtlas)).toBe(r);
		expect(r.getTexture()).toBe(r);
	});

	it("defaults to safe values when options are omitted", () => {
		const r = new TextureResource({ width: 4, height: 4 });
		expect(r.premultipliedAlpha).toBe(false);
		expect(r.repeat).toBe("no-repeat");
		expect(r.filter).toBeUndefined();
	});
});

describe("BufferTextureResource", () => {
	it("stores the data buffer alongside the resource metadata", () => {
		const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		const r = new BufferTextureResource(data, {
			width: 2,
			height: 1,
			premultipliedAlpha: false,
			filter: 9728,
		});
		expect(r.data).toBe(data);
		expect(r.width).toBe(2);
		expect(r.height).toBe(1);
		expect(r.premultipliedAlpha).toBe(false);
		// participates in the cache like any other texture-shaped object
		expect(r.getTexture()).toBe(r);
		expect(r.sources.get("default")).toBe(r);
	});
});

describe("BufferTextureResource — WebGL2 integration", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.WEBGL,
			});
			if (
				video.renderer instanceof WebGLRenderer &&
				video.renderer.WebGLVersion === 2
			) {
				renderer = video.renderer;
			}
		} catch {
			// CI runners without GL acceleration can't construct a WebGL2
			// renderer; tests below mark themselves skipped at runtime
		}
	});

	afterAll(() => {
		try {
			video.init(64, 64, {
				parent: "screen",
				renderer: video.AUTO,
			});
		} catch {
			// nothing to restore if boot/init never succeeded
		}
	});

	const requireWebGL2 = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	/**
	 * Regression for the previously-reserved fixed texture unit: a
	 * `BufferTextureResource` must receive its unit from the standard
	 * cache allocator, not from a hardcoded slot. With dynamic allocation
	 * the unit number depends on what else is in the cache, but it must
	 * (a) be a valid non-negative integer, and (b) not collide with the
	 * unit of any other live cached texture.
	 */
	it("gets a dynamically-allocated unit from the texture cache", (ctx) => {
		requireWebGL2(ctx);
		const batcher = renderer.setBatcher("quad");

		const r = new BufferTextureResource(new Uint8Array([1, 0, 0, 0]), {
			width: 1,
			height: 1,
			premultipliedAlpha: false,
			filter: renderer.gl.NEAREST,
		});

		const unit = batcher.uploadTexture(r, 1, 1);
		expect(unit).toBeGreaterThanOrEqual(0);
		expect(Number.isInteger(unit)).toBe(true);

		// the cache must report the same unit for the resource — i.e. it's
		// really tracked, not just a one-shot bind
		expect(renderer.cache.getUnit(r)).toBe(unit);

		// cleanup
		batcher.deleteTexture2D(r);
	});

	/**
	 * Two resources must receive distinct units (no collision). Catches
	 * a hypothetical regression where the cache key collapses or where
	 * a resource is treated as "the same" as another for unit purposes.
	 */
	it("assigns distinct units to distinct resources", (ctx) => {
		requireWebGL2(ctx);
		const batcher = renderer.setBatcher("quad");

		const a = new BufferTextureResource(new Uint8Array([1, 0, 0, 0]), {
			width: 1,
			height: 1,
			premultipliedAlpha: false,
		});
		const b = new BufferTextureResource(new Uint8Array([2, 0, 0, 0]), {
			width: 1,
			height: 1,
			premultipliedAlpha: false,
		});

		const ua = batcher.uploadTexture(a, 1, 1);
		const ub = batcher.uploadTexture(b, 1, 1);
		expect(ua).not.toBe(ub);

		batcher.deleteTexture2D(a);
		batcher.deleteTexture2D(b);
	});

	/**
	 * The resource path must apply its own `premultipliedAlpha` setting
	 * at upload time. With premultiply enabled and A=0 the driver would
	 * multiply RGB by zero and wipe the data; the resource opts out via
	 * its constructor flag and the GIDs survive the round-trip.
	 *
	 * Read-back via a tiny FBO: write 2 texels with R=1 and R=255, A=0,
	 * confirm the bytes come back intact.
	 */
	it("respects the resource's premultipliedAlpha=false flag on upload", (ctx) => {
		requireWebGL2(ctx);
		const gl = renderer.gl;
		const batcher = renderer.setBatcher("quad");

		// cell 0: R=1, A=0  /  cell 1: R=255, A=0
		const data = new Uint8Array([1, 0, 0, 0, 255, 0, 0, 0]);
		const r = new BufferTextureResource(data, {
			width: 2,
			height: 1,
			premultipliedAlpha: false,
			filter: gl.NEAREST,
		});

		batcher.uploadTexture(r, 2, 1);
		// uploadTexture flushes pending state — the GL texture handle is
		// the one the cache parked at our unit
		const texture = batcher.getTexture2D(renderer.cache.getUnit(r));

		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			texture,
			0,
		);
		expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(
			gl.FRAMEBUFFER_COMPLETE,
		);

		const pixels = new Uint8Array(2 * 1 * 4);
		gl.readPixels(0, 0, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		expect(pixels[0]).toBe(1);
		expect(pixels[4]).toBe(0xff);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(fbo);
		batcher.deleteTexture2D(r);
	});

	/**
	 * Re-uploading the same resource via the `force` argument must
	 * preserve its allocated unit (so the cache stays consistent) and
	 * the second upload must reflect the latest contents of the buffer.
	 */
	it("force-reuploads on demand without changing the allocated unit", (ctx) => {
		requireWebGL2(ctx);
		const gl = renderer.gl;
		const batcher = renderer.setBatcher("quad");

		const data = new Uint8Array([0, 0, 0, 0]);
		const r = new BufferTextureResource(data, {
			width: 1,
			height: 1,
			premultipliedAlpha: false,
			filter: gl.NEAREST,
		});

		const unit1 = batcher.uploadTexture(r, 1, 1);
		// mutate the underlying buffer and force a re-upload
		data[0] = 77;
		const unit2 = batcher.uploadTexture(r, 1, 1, true);
		expect(unit2).toBe(unit1);

		const texture = batcher.getTexture2D(unit2);
		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			texture,
			0,
		);
		const pixels = new Uint8Array(4);
		gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		expect(pixels[0]).toBe(77);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(fbo);
		batcher.deleteTexture2D(r);
	});
});
