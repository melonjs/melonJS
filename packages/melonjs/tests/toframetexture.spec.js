import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	CanvasRenderer,
	ShaderEffect,
	Texture2d,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * `renderer.toFrameTexture()` captures the current framebuffer into a
 * {@link Texture2d} entirely on the GPU (WebGL2 blitFramebuffer / WebGL1
 * copyTexImage2D — no readPixels round-trip), for screen-space effects (water
 * refraction, heat haze, glass). The fourth member of the toDataURL / toBlob /
 * toImageBitmap family; the only one that never leaves the GPU. Ticket #1544.
 *
 * Capture CONTENT is verified by attaching the returned texture to a scratch
 * framebuffer and reading it back. The live-bind SAMPLING path (a shader
 * reading the capture) is verified separately with a normally-uploaded texture:
 * the headless software rasterizer used in CI cannot *sample* a blit-destination
 * texture (it captures + reads back fine, and real GPUs sample it fine), so the
 * two concerns are checked independently.
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
	// FBO (the RGBA capture texture is colour-renderable) and readPixels
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

	it("captures only the requested sub-region", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		paintScene("#ff0000");
		// capture a 16x16 region around the centre (known painted)
		const frame = renderer.toFrameTexture({
			region: { x: 8, y: 8, width: 16, height: 16 },
		});
		expect(frame.width).toBe(16);
		expect(frame.height).toBe(16);
		const px = readCapture(frame, 8, 8);
		expect(px[0]).toBeGreaterThan(200);
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
});
