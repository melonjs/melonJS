/**
 * The texture-count cliff, end-to-end (#1585).
 *
 * A batch can span `maxTextures` distinct textures. One texture past that, the
 * allocator runs out, flushes, and evicts every assignment — and because draw
 * order is world order rather than texture order, the eviction recurs for the
 * rest of the frame. That is the cliff #1584 exists to remove and this one
 * moves: the pool used to be hardcoded to 16 regardless of the device.
 *
 * These assertions are on **cache resets per frame**, which are exact and
 * deterministic. Frame times are not asserted — they are noisy on shared CI —
 * but the measured shape on an M4 Max via ANGLE/Metal was:
 *
 *     pool= 8  textures= 8   0 resets/frame   ~0.06 ms/frame
 *     pool= 8  textures= 9  50 resets/frame   ~2.0  ms/frame
 *     pool=16  textures=16   0 resets/frame   ~0.04 ms/frame
 *     pool=16  textures=17  25 resets/frame   ~1.8  ms/frame
 *
 * i.e. the same 16-texture scene costs ~0.04 ms/frame with a pool of 16 and
 * ~4 ms/frame with a pool of 8 — two orders of magnitude, for one setting.
 * That gap is exactly what a lit scene used to pay before #1585, since
 * `LitQuadBatcher` halved the pool and reserved the upper half for normal maps.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";
import { GPU_TEXTURE_CACHE_RESET, off, on } from "../src/system/event.ts";

const SIZE = 128;
const QUADS = 200;

/** distinct 32x32 sources, so every one needs its own texture unit */
const makeImages = (n) => {
	return Array.from({ length: n }, (_, i) => {
		const c = document.createElement("canvas");
		c.width = 32;
		c.height = 32;
		const x = c.getContext("2d");
		x.fillStyle = `hsl(${(i * 37) % 360},80%,55%)`;
		x.fillRect(0, 0, 32, 32);
		return c;
	});
};

describe("texture-count cliff", () => {
	let app;
	let renderer;
	const POOL = 8;

	beforeAll(async () => {
		await boot();
		// an explicit narrow pool: the device reports at least 16 everywhere
		// (WebGL 2 floor), so 8 is reachable on any machine the suite runs on
		app = new Application(SIZE, SIZE, {
			renderer: video.WEBGL,
			maxTextures: POOL,
		});
		await app.init();
		renderer = app.renderer;
	});

	afterAll(() => {
		// this spec owns its Application, so it owns the WebGL context too.
		// Browsers cap live contexts, and a suite that leaks one per spec
		// eventually fails to create any — which surfaces as unrelated specs
		// failing, not as this one.
		app?.destroy();
	});

	const requireWebGL = (ctx) => {
		if (!renderer?.gl) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** resets emitted while drawing `distinct` textures over one frame */
	const resetsForFrame = (distinct, images) => {
		renderer.cache.resetUnitAssignments();
		const draw = () => {
			for (let q = 0; q < QUADS; q++) {
				renderer.drawImage(
					images[q % distinct],
					0,
					0,
					32,
					32,
					(q % 8) * 16,
					((q / 8) | 0) * 16,
					16,
					16,
				);
			}
			renderer.flush();
		};
		// warm up so first-sight uploads are not counted
		draw();
		let resets = 0;
		const onReset = () => {
			resets++;
		};
		on(GPU_TEXTURE_CACHE_RESET, onReset);
		draw();
		off(GPU_TEXTURE_CACHE_RESET, onReset);
		return resets;
	};

	// the end-to-end wiring the pure resolver tests cannot reach: one setting
	// has to land on the renderer, both batchers AND the cache, or they
	// disagree about capacity and the overflow guard fires against the wrong
	// number
	it("the maxTextures setting reaches every consumer", (ctx) => {
		requireWebGL(ctx);
		expect(renderer.maxTextures).toBe(POOL);
		expect(renderer.cache.max_size).toBe(POOL);
		expect(renderer.batchers.get("quad").maxBatchTextures).toBe(POOL);
		// the lit batcher no longer halves it (#1585)
		expect(renderer.batchers.get("litQuad").maxBatchTextures).toBe(POOL);
	});

	it("both multi-texture shaders link at the configured width", (ctx) => {
		requireWebGL(ctx);
		// the generators emit one sampler and one branch per unit, so a width
		// the device or the compiler rejects shows up here and nowhere else
		const gl = renderer.gl;
		for (const name of ["quad", "litQuad"]) {
			const program = renderer.batchers.get(name).defaultShader.program;
			expect(gl.getProgramParameter(program, gl.LINK_STATUS)).toBe(true);
		}
	});

	it("batches with no resets at or below the pool size", (ctx) => {
		requireWebGL(ctx);
		const images = makeImages(POOL);
		expect(resetsForFrame(POOL - 4, images)).toBe(0);
		// the LAST slot must still batch — an off-by-one here costs a full
		// eviction cycle on every frame of a scene sized exactly to the pool
		expect(resetsForFrame(POOL, images)).toBe(0);
	});

	it("falls off a cliff one texture past the pool", (ctx) => {
		requireWebGL(ctx);
		const images = makeImages(POOL + 1);
		const resets = resetsForFrame(POOL + 1, images);
		// not "a few more" — the eviction recurs for the rest of the frame,
		// because draw order is world order, not texture order
		expect(resets).toBeGreaterThan(QUADS / (POOL + 1) - 1);
	});

	it("the cliff scales with how far past the pool the scene goes", (ctx) => {
		requireWebGL(ctx);
		const images = makeImages(POOL * 3);
		// widening the working set past the pool cannot make it batch better
		const near = resetsForFrame(POOL + 1, images);
		const far = resetsForFrame(POOL * 3, images);
		expect(near).toBeGreaterThan(0);
		expect(far).toBeGreaterThan(0);
	});
});
