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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

	// ADVERSARIAL — the failure mode the store's ownership newly makes possible:
	// something frees a GL texture the store still has a record for, and the
	// next resolve hands the DEAD handle to a draw. Silent: GL does not error on
	// a deleted texture, it samples black.
	it("deleting a source's texture does not leave a dead handle resident", (ctx) => {
		requireWebGL(ctx);
		const source = images[1];
		const quad = renderer.batchers.get("quad");
		renderer.cache.resetUnitAssignments();
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();

		const atlas = renderer.cache.get(source);
		const dead = renderer.textureStore.peek(atlas.getTexture()).handle;
		expect(gl.isTexture(dead)).toBe(true);

		quad.deleteTexture2D(atlas);
		// the record must go WITH the texture, not outlive it
		expect(renderer.textureStore.peek(atlas.getTexture())).toBeUndefined();
		expect(gl.isTexture(dead)).toBe(false);

		// and drawing it again rebuilds rather than binding the corpse
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		const revived = renderer.textureStore.peek(
			renderer.cache.get(source).getTexture(),
		);
		expect(revived).toBeDefined();
		expect(revived.handle).not.toBe(dead);
		expect(gl.isTexture(revived.handle)).toBe(true);
	});

	// ADVERSARIAL — a content change must still re-upload. The whole change is
	// about NOT re-uploading, so the obvious way to get it wrong is to skip an
	// upload that was genuinely needed and render a stale frame forever.
	it("a content change still re-uploads, into the same handle", (ctx) => {
		requireWebGL(ctx);
		const source = images[2];
		renderer.cache.resetUnitAssignments();
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();
		const before = renderer.textureStore.peek(
			renderer.cache.get(source).getTexture(),
		);

		let uploads = 0;
		const real = gl.texSubImage2D.bind(gl);
		gl.texSubImage2D = (...a) => {
			uploads++;
			return real(...a);
		};
		try {
			// a canvas re-bake: same object, new pixels, bumped revision
			source.version = (source.version ?? 0) + 1;
			renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
		} finally {
			gl.texSubImage2D = real;
		}

		expect(uploads).toBeGreaterThan(0);
		// re-uploaded IN PLACE — a new handle would mean the storage was
		// thrown away, which is the churn this all exists to stop
		const after = renderer.textureStore.peek(
			renderer.cache.get(source).getTexture(),
		);
		expect(after.handle).toBe(before.handle);
	});

	// ADVERSARIAL — `markTextureDirty` is how a re-baked canvas (Text, a
	// gradient, any dynamic surface) announces new pixels behind an UNCHANGED
	// source object. It is live in production, from `CanvasRenderTarget`, and
	// nothing covered it: skipping this upload renders the previous text
	// forever, which is exactly the failure a re-upload-avoiding change invites.
	it("markTextureDirty forces a re-upload in place", (ctx) => {
		requireWebGL(ctx);
		const source = images[3];
		const quad = renderer.setBatcher("quad");
		renderer.cache.resetUnitAssignments();
		renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.flush();

		const atlas = renderer.cache.get(source);
		const before = renderer.textureStore.peek(atlas.getTexture());
		const unit = renderer.cache.getUnit(atlas);

		let uploads = 0;
		let creates = 0;
		const realSub = gl.texSubImage2D.bind(gl);
		const realCreate = gl.createTexture.bind(gl);
		gl.texSubImage2D = (...a) => {
			uploads++;
			return realSub(...a);
		};
		gl.createTexture = (...a) => {
			creates++;
			return realCreate(...a);
		};
		try {
			// the canvas re-baked: same object, same version, new pixels
			quad.markTextureDirty(unit);
			renderer.drawImage(source, 0, 0, 16, 16, 0, 0, 16, 16);
			renderer.flush();
		} finally {
			gl.texSubImage2D = realSub;
			gl.createTexture = realCreate;
		}

		expect(uploads).toBeGreaterThan(0);
		// in place: immutable storage makes a same-shape re-upload a pure
		// texSubImage2D, so no new texture object should appear
		expect(creates).toBe(0);
		expect(renderer.textureStore.peek(atlas.getTexture()).handle).toBe(
			before.handle,
		);
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
