import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	Bounds,
	boot,
	CanvasRenderer,
	Rect,
	ShaderEffect,
	Texture2d,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * `renderer.toFrameTexture()` captures the current framebuffer into a
 * {@link Texture2d} entirely on the GPU (copyTexImage2D to allocate, then
 * copyTexSubImage2D to refresh — no readPixels round-trip), for screen-space
 * effects (water refraction, heat haze, glass). The fourth member of the
 * toDataURL / toBlob / toImageBitmap family; the only one that never leaves the
 * GPU. Ticket #1544.
 *
 * Capture CONTENT is verified by attaching the returned texture to a scratch
 * framebuffer and reading it back. The live-bind SAMPLING path (a shader
 * reading the capture) is verified separately with a normally-uploaded texture:
 * the headless software rasterizer used in CI does not reliably *sample* the
 * RGB capture texture (it captures + reads back fine, and real GPUs sample it
 * fine — see the Aquarium example), so the two concerns are checked
 * independently.
 */
const SIZE = 32;

describe("WebGLRenderer.toFrameTexture", () => {
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

	// paint the whole scene a known color THROUGH the engine (drawImage of a
	// solid canvas — the proven path the shadereffect specs use), then flush
	const paintScene = (hex) => {
		const c = document.createElement("canvas");
		c.width = SIZE;
		c.height = SIZE;
		const cx = c.getContext("2d");
		cx.fillStyle = hex;
		cx.fillRect(0, 0, SIZE, SIZE);
		renderer.save();
		renderer.drawImage(c, 0, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.restore();
	};

	// read a capture's content back directly: attach its GL texture to a scratch
	// FBO (the RGB capture texture is colour-renderable) and readPixels — RGBA
	// readback of an RGB texture returns alpha = 255 (opaque)
	const readCapture = (frame, px = SIZE / 2, py = SIZE / 2) => {
		const fb = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			frame.glTexture,
			0,
		);
		const out = new Uint8Array(4);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
			gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.deleteFramebuffer(fb);
		return out;
	};

	it("returns a GPU-resident Texture2d sized to the framebuffer", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#ff0000");
		const frame = renderer.toFrameTexture();
		expect(frame).toBeInstanceOf(Texture2d);
		expect(frame.isGPUResident).toBe(true);
		expect(frame.width).toBe(SIZE);
		expect(frame.height).toBe(SIZE);
		expect(gl.isTexture(frame.glTexture)).toBe(true);
		// getTexture() returns the opaque backing (itself)
		expect(frame.getTexture()).toBe(frame);
	});

	it("captures the current framebuffer contents (GPU-side, opaque alpha)", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#ff0000"); // red
		const frame = renderer.toFrameTexture();
		const px = readCapture(frame);
		expect(px[0]).toBeGreaterThan(200);
		expect(px[1]).toBeLessThan(60);
		expect(px[2]).toBeLessThan(60);
		expect(px[3]).toBe(255); // alpha-less source captured as opaque
	});

	it("reuses the shared slot (same object + handle), refreshed in place", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#00ff00");
		const a = renderer.toFrameTexture();
		const handleA = a.glTexture;
		paintScene("#0000ff");
		const b = renderer.toFrameTexture();
		expect(b).toBe(a); // same shared texture object
		expect(b.glTexture).toBe(handleA); // same GL handle, refreshed in place
		// contents now reflect the SECOND capture (blue)
		const px = readCapture(b);
		expect(px[2]).toBeGreaterThan(200);
		expect(px[0]).toBeLessThan(60);
	});

	it("mints (target:null) then refreshes an independent caller-owned capture", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#ff0000");
		const shared = renderer.toFrameTexture();
		// target: null → a fresh owned capture, distinct from the shared slot
		paintScene("#00ff00");
		const owned = renderer.toFrameTexture({ target: null });
		expect(owned).not.toBe(shared);
		expect(gl.isTexture(owned.glTexture)).toBe(true);

		// refreshing the SHARED slot must not disturb the owned one
		paintScene("#0000ff");
		renderer.toFrameTexture();
		let px = readCapture(owned);
		expect(px[1]).toBeGreaterThan(200); // still green
		expect(px[2]).toBeLessThan(60);

		// refreshing the owned capture in place returns the SAME object
		paintScene("#0000ff");
		const again = renderer.toFrameTexture({ target: owned });
		expect(again).toBe(owned);
		px = readCapture(owned);
		expect(px[2]).toBeGreaterThan(200); // now blue

		owned.destroy();
	});

	// paint the framebuffer LEFT half red, RIGHT half blue at KNOWN pixel coords
	// via scissored clears — bypasses the bare harness's centred projection (an
	// engine drawImage lands offset), so region x maps 1:1 to framebuffer x
	const paintHalves = () => {
		renderer.flush();
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, SIZE, SIZE);
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(0, 0, SIZE / 2, SIZE);
		gl.clearColor(1, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.scissor(SIZE / 2, 0, SIZE / 2, SIZE);
		gl.clearColor(0, 0, 1, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.disable(gl.SCISSOR_TEST);
	};

	it("captures the CORRECT sub-region offset (not just any painted pixels)", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintHalves();
		// a region fully in the LEFT half (x < SIZE/2) must read red; one in the
		// RIGHT half, blue. If the x offset were ignored (always captured from 0),
		// BOTH would read red — this distinguishes a correct offset from a full
		// capture (and would also catch an x-mirror).
		const left = renderer.toFrameTexture({
			target: null,
			region: { x: 2, y: 2, width: 8, height: 8 },
		});
		const lpx = readCapture(left, 4, 4);
		expect(lpx[0]).toBeGreaterThan(200); // red
		expect(lpx[2]).toBeLessThan(60);

		const right = renderer.toFrameTexture({
			target: null,
			region: { x: SIZE / 2 + 4, y: 2, width: 8, height: 8 },
		});
		const rpx = readCapture(right, 4, 4);
		expect(rpx[2]).toBeGreaterThan(200); // blue
		expect(rpx[0]).toBeLessThan(60);

		expect(left.width).toBe(8);
		expect(right.width).toBe(8);
		left.destroy();
		right.destroy();
	});

	it("accepts a Bounds region", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintHalves();
		// a real Bounds over the LEFT half (x2 y2 w8 h8)
		const bounds = new Bounds([
			{ x: 2, y: 2 },
			{ x: 10, y: 10 },
		]);
		const a = renderer.toFrameTexture({ target: null, region: bounds });
		expect(a.width).toBe(8);
		expect(a.height).toBe(8);
		expect(readCapture(a, 4, 4)[0]).toBeGreaterThan(200); // red (left)
		a.destroy();
	});

	// the documented migration path for a Rect region: pass rect.getBounds().
	// Adversarial: prove the Rect's ACTUAL position + size drive the capture —
	// a right-half Rect must read blue, a left-half Rect red, each sized to the
	// Rect (so a dropped offset or a wrong size can't pass).
	it("captures the exact region a Rect describes, via rect.getBounds()", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintHalves(); // framebuffer: left half red, right half blue

		// sanity: getBounds() reflects the Rect's position + size (non-square, to
		// catch a width/height swap)
		const rightRect = new Rect(SIZE / 2 + 2, 4, 8, 6);
		const rb = rightRect.getBounds();
		expect(rb.x).toBe(SIZE / 2 + 2);
		expect(rb.y).toBe(4);
		expect(rb.width).toBe(8);
		expect(rb.height).toBe(6);

		// a Rect fully in the RIGHT half → blue, sized 8x6. If the x offset were
		// dropped it would capture the left (red); a width/height swap → 6x8.
		const right = renderer.toFrameTexture({
			target: null,
			region: rightRect.getBounds(),
		});
		expect(right.width).toBe(8);
		expect(right.height).toBe(6);
		const rpx = readCapture(right, 4, 3);
		expect(rpx[2]).toBeGreaterThan(200); // blue
		expect(rpx[0]).toBeLessThan(60);
		right.destroy();

		// the mirror case: a Rect fully in the LEFT half → red — proves the
		// position (not a constant) selects what's captured
		const left = renderer.toFrameTexture({
			target: null,
			region: new Rect(2, 4, 8, 6).getBounds(),
		});
		const lpx = readCapture(left, 4, 3);
		expect(lpx[0]).toBeGreaterThan(200); // red
		expect(lpx[2]).toBeLessThan(60);
		left.destroy();
	});

	it("reallocates when the backing handle goes stale (context-loss self-heal)", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#ff0000");
		const first = renderer.toFrameTexture();
		// simulate the post-context-loss state: the GL handle is dead
		gl.deleteTexture(first.glTexture);
		expect(gl.isTexture(first.glTexture)).toBe(false);

		paintScene("#00ff00");
		const healed = renderer.toFrameTexture();
		expect(healed).toBe(first); // same shared slot object…
		expect(gl.isTexture(healed.glTexture)).toBe(true); // …with a fresh handle
		const px = readCapture(healed);
		expect(px[1]).toBeGreaterThan(200); // green
	});

	// the live-bind SAMPLING path: setTexture stores a live GPU-resident entry,
	// and _prepareTextures binds its current GL handle each draw so a shader
	// samples it. Verified with a normally-uploaded texture standing in as the
	// capture's backing (the headless rasterizer can't sample blit textures).
	it("setTexture live-binds a frame texture for a shader to sample", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		// upload a red texture the ordinary way, then reuse its GL handle
		const redC = document.createElement("canvas");
		redC.width = SIZE;
		redC.height = SIZE;
		const rcx = redC.getContext("2d");
		rcx.fillStyle = "#ff0000";
		rcx.fillRect(0, 0, SIZE, SIZE);
		const uploader = new ShaderEffect(
			renderer,
			"uniform sampler2D uX;\nvec4 apply(vec4 c, vec2 uv) { return texture2D(uX, uv); }",
		);
		uploader.setTexture("uX", redC);
		const blank = document.createElement("canvas");
		blank.width = SIZE;
		blank.height = SIZE;
		const drawEffect = (effect) => {
			paintScene("#101010"); // sentinel so a failed sample is visible
			renderer.save();
			renderer.customShader = effect;
			renderer.drawImage(blank, 0, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
			renderer.flush();
			renderer.customShader = undefined;
			renderer.restore();
			const px = new Uint8Array(4);
			gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return px;
		};
		drawEffect(uploader); // triggers the createTexture2D upload
		const redHandle = uploader._extraTextures.get("uX").tex;

		// stand a real FrameTexture up on that known-sampleable handle
		const frame = renderer.toFrameTexture();
		frame.glTexture = redHandle;

		const effect = new ShaderEffect(
			renderer,
			"uniform sampler2D uScene;\nvec4 apply(vec4 c, vec2 uv) { return texture2D(uScene, uv); }",
		);
		effect.setTexture("uScene", frame);
		// the setTexture entry is a LIVE GPU-resident binding, not a static copy
		const entry = effect._extraTextures.get("uScene");
		expect(entry.live).toBe(true);
		expect(entry.tex).toBe(null); // never uploads its own copy

		const px = drawEffect(effect);
		expect(px[0]).toBeGreaterThan(200); // red — sampled the live handle
		expect(px[2]).toBeLessThan(60);

		effect.destroy();
		uploader.destroy();
	});

	// toFrameTexture binds its capture to a scratch unit (the top of the quad
	// batcher's range) directly, bypassing the shared texture-cache accounting.
	// The LIT quad batcher parks normal maps in the top half of the unit range,
	// so that scratch unit overlaps a normal-map slot — without invalidating it
	// across batchers, a later lit draw would assume the normal is still resident
	// and skip re-binding it, sampling the just-captured frame AS a normal map.
	it("invalidates the scratch unit across all batchers so lighting survives a capture", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const quad = renderer.batchers.get("quad");
		const lit = renderer.batchers.get("litQuad");
		if (!quad || !lit) {
			ctx.skip();
			return;
		}

		// the exact unit toFrameTexture uses, and its paired lit normal-map slot
		const scratch = quad.maxBatchTextures - 1;
		const normalIndex = scratch - lit.maxBatchTextures;
		const normalInRange =
			normalIndex >= 0 && normalIndex < lit.maxBatchTextures;

		// seed the caches as a prior lit draw would: a colour texture the quad
		// batcher thinks is at the scratch unit, and a normal map the lit batcher
		// thinks is paired to it
		quad.boundTextures[scratch] = { fake: "color" };
		if (normalInRange) {
			lit.boundNormalMaps[normalIndex] = { fake: "normal" };
			lit.boundNormalVersions[normalIndex] = 7;
		}

		paintScene("#ff0000");
		const frame = renderer.toFrameTexture();

		// the stale color view of the scratch unit is cleared…
		expect(quad.boundTextures[scratch]).toBeUndefined();
		// …and (the crux) the lit batcher forgot its normal pairing for that unit,
		// so the next lit draw re-binds the real normal instead of the capture
		if (normalInRange) {
			expect(lit.boundNormalMaps[normalIndex]).toBe(null);
			expect(lit.boundNormalVersions[normalIndex]).toBe(-1);
		}
		// and the capture itself is intact — both features coexist
		expect(gl.isTexture(frame.glTexture)).toBe(true);
	});

	// adversarial: invalidateUnit must ONLY touch the normal slot for GL units in
	// the normal range (top half), never for a low colour/albedo unit
	it("invalidateUnit only drops the normal pairing for units in the normal range", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		if (!lit) {
			ctx.skip();
			return;
		}
		// a LOW unit (0) is a colour/albedo unit — its clobber must NOT drop the
		// normal at index 0 (which lives at GL unit maxBatchTextures + 0)
		lit.boundTextures[0] = { fake: true };
		lit.boundNormalMaps[0] = { keep: true };
		lit.invalidateUnit(0);
		expect(lit.boundTextures[0]).toBeUndefined(); // colour cleared
		expect(lit.boundNormalMaps[0]).toEqual({ keep: true }); // normal untouched

		// the GL unit that DOES pair to normal index 0 must drop it
		lit.invalidateUnit(lit.maxBatchTextures + 0);
		expect(lit.boundNormalMaps[0]).toBe(null);
	});

	// the latent gap this surfaced: a full texture-cache reset (unit-pool wrap)
	// must clear the lit normal-map cache too, not just colours
	it("a texture-cache reset clears the lit normal-map cache, not just colors", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		if (!lit) {
			ctx.skip();
			return;
		}
		lit.boundTextures[0] = { fake: "color" };
		lit.boundNormalMaps[0] = { fake: "normal" };
		lit.boundNormalVersions[0] = 9;

		renderer.cache.resetUnitAssignments(); // emits GPU_TEXTURE_CACHE_RESET

		expect(lit.boundTextures.length).toBe(0); // colours cleared (base handler)
		expect(lit.boundNormalMaps[0]).toBe(null); // normals cleared (the gap fix)
		expect(lit.boundNormalVersions[0]).toBe(-1);
	});

	// invalidateTextureUnit is the shared primitive: it must clear the unit on
	// EVERY batcher except the one that just bound it. GPU-independent.
	it("invalidateTextureUnit clears a unit on all batchers except the excluded one", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const quad = renderer.batchers.get("quad");
		const lit = renderer.batchers.get("litQuad");
		if (!quad || !lit) {
			ctx.skip();
			return;
		}
		const glUnit = lit.maxBatchTextures + 1; // a real lit normal-map GL unit
		lit.boundNormalMaps[1] = { fake: "normal" };
		quad.boundTextures[glUnit] = { fake: "color" };

		// exclude the quad batcher → its binding is kept, the lit one is dropped
		renderer.invalidateTextureUnit(glUnit, quad);
		expect(lit.boundNormalMaps[1]).toBe(null); // lit invalidated
		expect(quad.boundTextures[glUnit]).toEqual({ fake: "color" }); // quad kept
	});

	// the crux of the completeness fix: an effect with MULTIPLE extra samplers
	// binds them to several top units (counting down) — ALL of which overlap lit
	// normal-map units — so _prepareTextures must invalidate EVERY one, not just
	// the scratch. Verified GPU-independently by spying on the shared primitive.
	it("_prepareTextures invalidates every reserved sampler unit an effect binds", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const quad = renderer.batchers.get("quad");
		if (!quad) {
			ctx.skip();
			return;
		}
		const mk = (col) => {
			const c = document.createElement("canvas");
			c.width = SIZE;
			c.height = SIZE;
			const x = c.getContext("2d");
			x.fillStyle = col;
			x.fillRect(0, 0, SIZE, SIZE);
			return c;
		};
		// TWO extra samplers → bound to units (maxBatchTextures-1) and (-2)
		const effect = new ShaderEffect(
			renderer,
			"uniform sampler2D uA;\nuniform sampler2D uB;\nvec4 apply(vec4 c, vec2 uv) { return texture2D(uA, uv) + texture2D(uB, uv); }",
		);
		effect.setTexture("uA", mk("#ff0000"));
		effect.setTexture("uB", mk("#00ff00"));

		const spy = vi.spyOn(renderer, "invalidateTextureUnit");
		renderer.save();
		renderer.customShader = effect;
		renderer.drawImage(mk("#000000"), 0, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.customShader = undefined;
		renderer.restore();

		const u1 = quad.maxBatchTextures - 1;
		const u2 = quad.maxBatchTextures - 2;
		const calls = spy.mock.calls;
		const units = calls.map((c) => {
			return c[0];
		});
		// BOTH sampler units invalidated (the second one is the bug the review
		// caught — the pre-fix code only invalidated the scratch unit)
		expect(units).toContain(u1);
		expect(units).toContain(u2);
		// each excludes the drawing (quad) batcher, whose cache is already correct
		const callForU2 = calls.find((c) => {
			return c[0] === u2;
		});
		expect(callForU2?.[1]).toBe(quad);

		spy.mockRestore();
		effect.destroy();
	});

	it("rejects a target that is not a capture from this renderer", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		// not a FrameTexture at all
		expect(() => {
			renderer.toFrameTexture({ target: {} });
		}).toThrow();
		// a Texture2d but not a capture
		class NotACapture extends Texture2d {
			getTexture() {
				return document.createElement("canvas");
			}
		}
		expect(() => {
			renderer.toFrameTexture({ target: new NotACapture() });
		}).toThrow(/capture returned by this method/);
	});

	it("clamps an out-of-bounds region instead of erroring", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#ff0000");
		// x/y past the framebuffer + a size that would overflow — must not throw
		// (INVALID_VALUE) and must still yield a valid capture
		const frame = renderer.toFrameTexture({
			region: { x: SIZE + 100, y: SIZE + 100, width: SIZE, height: SIZE },
		});
		expect(gl.isTexture(frame.glTexture)).toBe(true);
		expect(frame.width).toBeGreaterThanOrEqual(1);
		expect(frame.width).toBeLessThanOrEqual(SIZE);
		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("rejects a capture that belongs to a DIFFERENT renderer", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		// a real capture from THIS renderer, re-owned by a fake renderer — the
		// instanceof check passes but the ownership check must reject it (else
		// frame.destroy() would delete a texture on the wrong GL context)
		const owned = renderer.toFrameTexture({ target: null });
		owned._renderer = { gl: renderer.gl }; // a different object, not `renderer`
		expect(() => {
			renderer.toFrameTexture({ target: owned });
		}).toThrow(/different renderer/);
		owned._renderer = renderer; // restore so destroy hits the right context
		owned.destroy();
	});

	it("treats a GPU-resident Texture2d WITHOUT a glTexture as a static asset", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		// a Texture2d that CLAIMS GPU-residency but exposes no glTexture handle:
		// the live path reads .glTexture, so taking it would silently never bind.
		// It must fall back to the static getTexture() unwrap instead.
		const backing = document.createElement("canvas");
		backing.width = SIZE;
		backing.height = SIZE;
		class FakeGPUResident extends Texture2d {
			constructor() {
				super();
				this.isGPUResident = true; // no glTexture field
			}
			getTexture() {
				return backing;
			}
		}
		const effect = new ShaderEffect(
			renderer,
			"uniform sampler2D uX;\nvec4 apply(vec4 c, vec2 uv) { return texture2D(uX, uv); }",
		);
		effect.setTexture("uX", new FakeGPUResident());
		const entry = effect._extraTextures.get("uX");
		expect(entry.live).toBe(false); // NOT taken as a live source
		expect(entry.image).toBe(backing); // unwrapped to its drawable instead
		effect.destroy();
	});

	it("invalidateUnit is a no-op (no throw) for an out-of-range unit", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const lit = renderer.batchers.get("litQuad");
		if (!lit) {
			ctx.skip();
			return;
		}
		// a unit far past the array bounds must neither throw nor corrupt state
		expect(() => {
			lit.invalidateUnit(9999);
			renderer.invalidateTextureUnit(9999);
		}).not.toThrow();
		expect(lit.boundNormalMaps.length).toBe(lit.maxBatchTextures);
	});
});

describe("CanvasRenderer.toFrameTexture", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(SIZE, SIZE, { parent: "screen", renderer: video.CANVAS });
		renderer = video.renderer;
		expect(renderer).toBeInstanceOf(CanvasRenderer);
	});

	it("returns a Texture2d backed by a canvas copy of the frame", () => {
		const ctx2d = renderer.getContext();
		ctx2d.setTransform(1, 0, 0, 1, 0, 0);
		ctx2d.fillStyle = "#ff0000";
		ctx2d.fillRect(0, 0, SIZE, SIZE);

		const frame = renderer.toFrameTexture();
		expect(frame).toBeInstanceOf(Texture2d);
		expect(frame.width).toBe(SIZE);
		expect(frame.height).toBe(SIZE);
		const backing = frame.getTexture();
		// a drawable canvas copy (not GPU-resident)
		const bctx = backing.getContext("2d");
		const px = bctx.getImageData(SIZE / 2, SIZE / 2, 1, 1).data;
		expect(px[0]).toBeGreaterThan(200);
		expect(px[1]).toBeLessThan(60);
	});

	it("reuses the shared canvas slot across calls", () => {
		const a = renderer.toFrameTexture();
		const b = renderer.toFrameTexture();
		expect(b).toBe(a);
	});

	it("rejects a target that is not a canvas capture", () => {
		expect(() => {
			renderer.toFrameTexture({ target: {} });
		}).toThrow(/capture returned by this method/);
	});

	it("captures the correct canvas sub-region and clamps out-of-bounds", () => {
		const ctx2d = renderer.getContext();
		ctx2d.setTransform(1, 0, 0, 1, 0, 0);
		ctx2d.fillStyle = "#ff0000"; // left half red
		ctx2d.fillRect(0, 0, SIZE / 2, SIZE);
		ctx2d.fillStyle = "#0000ff"; // right half blue
		ctx2d.fillRect(SIZE / 2, 0, SIZE / 2, SIZE);

		// a RIGHT region must read blue — proves the x offset is honored
		const right = renderer.toFrameTexture({
			target: null,
			region: { x: SIZE - 8, y: 4, width: 6, height: 6 },
		});
		const px = right
			.getTexture()
			.getContext("2d")
			.getImageData(3, 3, 1, 1).data;
		expect(px[2]).toBeGreaterThan(200); // blue
		expect(px[0]).toBeLessThan(60);

		// an out-of-bounds origin must clamp to a valid capture, not throw
		expect(() => {
			const oob = renderer.toFrameTexture({
				target: null,
				region: { x: 9999, y: 9999, width: 50, height: 50 },
			});
			expect(oob.width).toBeGreaterThanOrEqual(1);
			expect(oob.width).toBeLessThanOrEqual(SIZE);
		}).not.toThrow();
	});

	it("refreshes a canvas target IN PLACE on a size change (same object)", () => {
		const a = renderer.toFrameTexture({
			target: null,
			region: { x: 0, y: 0, width: 8, height: 8 },
		});
		expect(a.width).toBe(8);
		// re-capture a DIFFERENT size into the same target — must keep the object
		// identity (matches the WebGL variant), not return a new instance
		const b = renderer.toFrameTexture({
			target: a,
			region: { x: 0, y: 0, width: 16, height: 16 },
		});
		expect(b).toBe(a);
		expect(a.width).toBe(16);
		expect(a.canvas.width).toBe(16);
	});
});
