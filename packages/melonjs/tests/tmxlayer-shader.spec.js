import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import { BufferTextureResource } from "../src/video/texture/resource.js";
import OrthogonalTMXLayerGPURenderer from "../src/video/webgl/renderers/tmxlayer/orthogonal.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";

describe("TMXLayer shader path", () => {
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
			// ignore — nothing to restore if boot/init never succeeded
		}
	});

	// Runtime skip helper. Produces a real "skipped" test status (visible
	// in the reporter and CI summaries) instead of silently no-op'ing,
	// which would hide a regression behind a green check.
	const requireWebGL2 = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	it("lazily constructs the GPU renderer when first asked", (ctx) => {
		requireWebGL2(ctx);
		// `_getTMXGPURendererFor` is the lazy factory on WebGLRenderer
		const r1 = renderer._getTMXGPURendererFor("orthogonal");
		const r2 = renderer._getTMXGPURendererFor("orthogonal");
		expect(r1).toBeInstanceOf(OrthogonalTMXLayerGPURenderer);
		expect(r2).toBe(r1);
	});

	/**
	 * Regression: the GPU renderer used to bind its index texture to a
	 * hardcoded unit (7) without telling the batcher. That left
	 * `boundTextures[7]` stale and any other texture allocated to unit 7
	 * later collided silently — every subsequent atlas draw on that unit
	 * sampled the index texture and went invisible.
	 *
	 * Now the index texture flows through `cache.getUnit` /
	 * `batcher.uploadTexture` like everything else. This test confirms
	 * the unit it receives is whatever the cache allocator hands out
	 * (not a fixed magic number) and matches what the cache reports.
	 */
	it("allocates the index texture's unit through the standard cache", (ctx) => {
		requireWebGL2(ctx);
		const gpu = renderer._getTMXGPURendererFor("orthogonal");

		const cols = 4;
		const rows = 3;
		const layer = {
			cols,
			rows,
			layerData: new Uint16Array(cols * rows * 2),
			dataVersion: 0,
		};
		layer.layerData[0] = 1;
		layer.layerData[2] = 17;
		layer.layerData[4] = 42;

		const resource = gpu._getResource(layer);
		expect(resource).toBeInstanceOf(BufferTextureResource);
		expect(resource.premultipliedAlpha).toBe(false);
		expect(resource.filter).toBe(renderer.gl.NEAREST);

		const batcher = renderer.setBatcher("quad");
		const unit = batcher.uploadTexture(resource, cols, rows);

		// unit comes from the dynamic cache allocator — not a hardcoded slot
		expect(Number.isInteger(unit)).toBe(true);
		expect(unit).toBeGreaterThanOrEqual(0);
		expect(renderer.cache.getUnit(resource)).toBe(unit);

		gpu.reset();
	});

	/**
	 * Regression: the index data has A=0 on every texel (the high byte of
	 * the flip mask is unused). The standard texture pipeline keeps
	 * `UNPACK_PREMULTIPLY_ALPHA_WEBGL = true`, which would have the driver
	 * multiply RGB by A/255 = 0 and silently wipe every GID. The resource
	 * declares `premultipliedAlpha: false` and the batcher reconciles GL
	 * state per upload — bytes round-trip intact.
	 */
	it("preserves GID bytes through upload (no premultiply alpha)", (ctx) => {
		requireWebGL2(ctx);
		const gl = renderer.gl;
		const gpu = renderer._getTMXGPURendererFor("orthogonal");

		const cols = 2;
		const rows = 1;
		const layer = {
			cols,
			rows,
			layerData: new Uint16Array(cols * rows * 2),
			dataVersion: 0,
		};
		// cell (0,0): GID = 0x0001 — bytes 01 00 00 00
		layer.layerData[0] = 1;
		// cell (1,0): GID = 0x00FF — bytes FF 00 00 00
		layer.layerData[2] = 0xff;

		const batcher = renderer.setBatcher("quad");
		const resource = gpu._getResource(layer);
		batcher.uploadTexture(resource, cols, rows);
		const texture = batcher.getTexture2D(renderer.cache.getUnit(resource));

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

		const pixels = new Uint8Array(cols * rows * 4);
		gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		expect(pixels[0]).toBe(1);
		expect(pixels[4]).toBe(0xff);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(fbo);
		gpu.reset();
	});

	/**
	 * `reset()` (invoked from `WebGLRenderer.reset()` on `GAME_RESET`)
	 * must drop every cached per-layer resource so each level transition
	 * starts with a clean cache.
	 */
	it("drops every cached layer resource on reset()", (ctx) => {
		requireWebGL2(ctx);
		const gpu = renderer._getTMXGPURendererFor("orthogonal");
		const batcher = renderer.setBatcher("quad");

		const makeLayer = (cols, rows) => {
			return {
				cols,
				rows,
				layerData: new Uint16Array(cols * rows * 2),
				dataVersion: 0,
			};
		};

		const l1 = makeLayer(2, 2);
		const l2 = makeLayer(3, 3);
		batcher.uploadTexture(gpu._getResource(l1), l1.cols, l1.rows);
		batcher.uploadTexture(gpu._getResource(l2), l2.cols, l2.rows);
		expect(gpu.resources.size).toBe(2);

		gpu.reset();
		expect(gpu.resources.size).toBe(0);
	});

	/**
	 * Animation lookup: non-animated tilesets don't allocate a lookup
	 * entry at all (saves a texture unit + a GL texture); animated
	 * tilesets get a `tileCount × 1` RGBA8 texture initialized to
	 * identity (localId → localId).
	 */
	it("only allocates an animation lookup for animated tilesets", (ctx) => {
		requireWebGL2(ctx);
		const gpu = renderer._getTMXGPURendererFor("orthogonal");

		const staticTileset = {
			isAnimated: false,
			animations: new Map(),
		};
		const animatedTileset = {
			isAnimated: true,
			animations: new Map([[5, { cur: { tileid: 5 } }]]),
		};

		expect(gpu._getOrUpdateAnimLookup(staticTileset, 16)).toBeUndefined();

		const entry = gpu._getOrUpdateAnimLookup(animatedTileset, 16);
		expect(entry).toBeDefined();
		expect(entry.tileCount).toBe(16);
		// identity initialization: texel 7 encodes localId 7 → (R=7, G=0)
		expect(entry.data[7 * 4 + 0]).toBe(7);
		expect(entry.data[7 * 4 + 1]).toBe(0);
		// the animated entry at localId 5 has been written too — same as
		// its current frame, so still 5
		expect(entry.data[5 * 4 + 0]).toBe(5);

		gpu.reset();
	});

	/**
	 * When an animation ticks (the tileset's `anim.cur.tileid` changes),
	 * the lookup data is rewritten and the `dirty` flag flips so the
	 * batcher knows to force-reupload on the next bind.
	 */
	it("marks the animation lookup dirty when a frame changes", (ctx) => {
		requireWebGL2(ctx);
		const gpu = renderer._getTMXGPURendererFor("orthogonal");

		const anim = { cur: { tileid: 10 } };
		const tileset = { isAnimated: true, animations: new Map([[10, anim]]) };

		// initial: identity at slot 10 → (10, 0)
		const entry = gpu._getOrUpdateAnimLookup(tileset, 32);
		expect(entry.data[10 * 4 + 0]).toBe(10);
		expect(entry.dirty).toBe(false);

		// advance the frame to a value spanning the lo/hi byte boundary
		anim.cur.tileid = 258; // 258 = 0x0102  → lo=2, hi=1
		gpu._getOrUpdateAnimLookup(tileset, 32);
		expect(entry.data[10 * 4 + 0]).toBe(2);
		expect(entry.data[10 * 4 + 1]).toBe(1);
		expect(entry.dirty).toBe(true);

		gpu.reset();
	});

	/**
	 * The animation lookup must round-trip through GL: a known-bad
	 * version of this would silently get its bytes mangled by
	 * UNPACK_PREMULTIPLY_ALPHA_WEBGL = true (A=0 wipes RGB), the same
	 * trap the index texture had to navigate.
	 */
	it("preserves animation lookup bytes through upload", (ctx) => {
		requireWebGL2(ctx);
		const gl = renderer.gl;
		const gpu = renderer._getTMXGPURendererFor("orthogonal");
		const batcher = renderer.setBatcher("quad");

		// tile 0 → frame 3 (lo=3, hi=0), tile 1 → frame 256 (lo=0, hi=1)
		const tileset = {
			isAnimated: true,
			animations: new Map([
				[0, { cur: { tileid: 3 } }],
				[1, { cur: { tileid: 256 } }],
			]),
		};
		const entry = gpu._getOrUpdateAnimLookup(tileset, 4);
		batcher.uploadTexture(entry.resource, entry.tileCount, 1, true);
		const texture = batcher.getTexture2D(
			renderer.cache.getUnit(entry.resource),
		);

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

		const pixels = new Uint8Array(4 * 4);
		gl.readPixels(0, 0, 4, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		// tile 0 → 3
		expect(pixels[0 * 4 + 0]).toBe(3);
		expect(pixels[0 * 4 + 1]).toBe(0);
		// tile 1 → 256 = 0x0100
		expect(pixels[1 * 4 + 0]).toBe(0);
		expect(pixels[1 * 4 + 1]).toBe(1);
		// tile 2 / 3 stay identity
		expect(pixels[2 * 4 + 0]).toBe(2);
		expect(pixels[3 * 4 + 0]).toBe(3);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(fbo);
		gpu.reset();
	});

	/**
	 * `reset()` must drop the animation-lookup map too, not just the
	 * per-layer index-texture map. Otherwise the lookup textures leak
	 * across level transitions.
	 */
	it("drops every animation lookup on reset()", (ctx) => {
		requireWebGL2(ctx);
		const gpu = renderer._getTMXGPURendererFor("orthogonal");

		gpu._getOrUpdateAnimLookup(
			{ isAnimated: true, animations: new Map([[0, { cur: { tileid: 0 } }]]) },
			4,
		);
		gpu._getOrUpdateAnimLookup(
			{ isAnimated: true, animations: new Map([[1, { cur: { tileid: 1 } }]]) },
			8,
		);
		expect(gpu.animLookups.size).toBe(2);

		gpu.reset();
		expect(gpu.animLookups.size).toBe(0);
	});
});
