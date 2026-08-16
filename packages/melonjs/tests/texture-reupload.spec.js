/**
 * A texture-cache overflow must not re-upload textures (#1585).
 *
 * The GL handle used to be reachable only through a batcher's `boundTextures`
 * array, so dropping a unit assignment destroyed it and the next draw rebuilt
 * the texture from scratch. Past the batching limit that meant a full
 * `createTexture` + `texStorage2D` + `texSubImage2D` + `generateMipmap` PER
 * QUAD, every frame — measured at 542 of each per frame on a 512-quad scene.
 *
 * Residency is keyed by source now and survives a unit reassignment, so an
 * overflow costs a flush and some re-binds.
 *
 * These assertions count GL calls, which is exact — no timing, so nothing here
 * is flaky. Frame time was the symptom; call counts are the mechanism.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";

const SIZE = 128;
const QUADS = 240;

describe("texture re-upload on overflow", () => {
	let app;
	let renderer;
	let gl;
	let images;
	let pool;

	beforeAll(async () => {
		await boot();
		app = new Application(SIZE, SIZE, { renderer: video.WEBGL });
		await app.init();
		renderer = app.renderer;
		gl = renderer.gl;
		pool = renderer.batchers.get("quad").maxBatchTextures;
		// one more distinct source than the pool can hold, so the set cannot
		// stay resident and the allocator must recycle
		images = Array.from({ length: pool + 1 }, (_, i) => {
			const c = document.createElement("canvas");
			c.width = 16;
			c.height = 16;
			const x = c.getContext("2d");
			x.fillStyle = `hsl(${(i * 37) % 360},80%,55%)`;
			x.fillRect(0, 0, 16, 16);
			return c;
		});
	});

	const requireWebGL = (ctx) => {
		if (!renderer?.gl) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** GL calls issued while drawing one frame over `n` distinct textures */
	const callsForFrame = (n) => {
		const watched = [
			"createTexture",
			"texStorage2D",
			"texSubImage2D",
			"texImage2D",
			"generateMipmap",
			"deleteTexture",
			"drawElements",
		];
		const counts = {};
		const real = {};
		const draw = () => {
			for (let q = 0; q < QUADS; q++) {
				renderer.drawImage(images[q % n], 0, 0, 16, 16, 0, 0, 16, 16);
			}
			renderer.flush();
		};

		renderer.cache.resetUnitAssignments();
		draw(); // warm: first-sight uploads happen here, not in the measurement
		gl.finish();

		for (const name of watched) {
			counts[name] = 0;
			real[name] = gl[name].bind(gl);
			gl[name] = (...a) => {
				counts[name]++;
				return real[name](...a);
			};
		}
		draw();
		gl.finish();
		for (const name of watched) {
			gl[name] = real[name];
		}
		return counts;
	};

	it("an overflowing frame uploads nothing", (ctx) => {
		requireWebGL(ctx);
		const over = callsForFrame(pool + 1);

		// THE assertion. Every one of these was ~QUADS before the fix.
		expect(over.createTexture).toBe(0);
		expect(over.texStorage2D).toBe(0);
		expect(over.texSubImage2D).toBe(0);
		expect(over.texImage2D).toBe(0);
		expect(over.generateMipmap).toBe(0);
	});

	it("costs no more uploads than a frame that fits", (ctx) => {
		requireWebGL(ctx);
		// stated relatively too, so the test still means something if the
		// steady state ever legitimately uploads (an animated source, say)
		const fits = callsForFrame(pool);
		const over = callsForFrame(pool + 1);
		for (const key of ["createTexture", "texSubImage2D", "generateMipmap"]) {
			expect(over[key]).toBe(fits[key]);
		}
		// the overflow is real — it still costs extra draw calls, which is the
		// part only more slots or texture arrays can remove
		expect(over.drawElements).toBeGreaterThan(fits.drawElements);
	});

	it("does not trade the upload storm for a delete storm", (ctx) => {
		requireWebGL(ctx);
		// the displaced handles used to be dropped unreferenced and left to GC;
		// freeing them per overflow instead would be just as bad
		const over = callsForFrame(pool + 1);
		expect(over.deleteTexture).toBe(0);
	});

	it("a source keeps ONE handle across a unit reassignment", (ctx) => {
		requireWebGL(ctx);
		const source = images[0];
		renderer.cache.resetUnitAssignments();
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		const before = renderer.textureStore.peek(
			renderer.cache.get(source).getTexture(),
		);

		renderer.cache.resetUnitAssignments();
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		const after = renderer.textureStore.peek(
			renderer.cache.get(source).getTexture(),
		);

		expect(after).toBeDefined();
		expect(after.handle).toBe(before.handle);
	});
});
