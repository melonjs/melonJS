/**
 * `WebGLTextureStore` — the WebGL realization of the shared residency policy
 * (#1585).
 *
 * The base owns the decision (reuse or upload, when to release); this subclass
 * owns the GL calls and nothing else, mirroring `Batcher` / `WebGLBatcher` /
 * `WebGPUBatcher`. Two instances live per renderer: the colour store every
 * batcher shares, and the lit batcher's normal-map store.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, game, WebGLRenderer } from "../src/index.js";
import { TextureStore } from "../src/video/gpu/texturestore.js";
import { WebGLTextureStore } from "../src/video/webgl/texture/store.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

describe("WebGLTextureStore", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		await boot();
		try {
			await getWebGLRenderer(64, 64);
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (game.renderer instanceof WebGLRenderer) {
			renderer = game.renderer;
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		try {
			releaseWebGLRenderer();
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("is a TextureStore, so the policy is the shared one", (ctx) => {
		requireWebGL(ctx);
		const store = new WebGLTextureStore(gl);
		expect(store).toBeInstanceOf(TextureStore);
		// the renderer's colour store and the lit batcher's normal store are
		// both this class — one policy, two instances, not two implementations
		expect(renderer.textureStore).toBeInstanceOf(WebGLTextureStore);
		expect(renderer.batchers.get("litQuad").normalStore).toBeInstanceOf(
			WebGLTextureStore,
		);
		// and they are DISTINCT: normal maps live outside the colour cache
		expect(renderer.batchers.get("litQuad").normalStore).not.toBe(
			renderer.textureStore,
		);
	});

	it("creates a real GL texture, and releases it exactly once", (ctx) => {
		requireWebGL(ctx);
		const store = new WebGLTextureStore(gl);
		const source = { name: "s" };
		const rec = store.getResidentRecord(source, {
			// bind it, as the real upload path does inside `createTexture2D`:
			// a name from `createTexture` is not a texture OBJECT until first
			// bound, so `isTexture` reports false before that
			upload: (handle) => {
				gl.bindTexture(gl.TEXTURE_2D, handle);
				return handle;
			},
		});
		expect(gl.isTexture(rec.handle)).toBe(true);

		expect(store.destroyTexture(source)).toBe(true);
		expect(gl.isTexture(rec.handle)).toBe(false);
		// a second destroy must not double-free — GL tolerates it, but the
		// handle may have been reissued to someone else by then
		const spy = vi.spyOn(gl, "deleteTexture");
		expect(store.destroyTexture(source)).toBe(false);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("does not upload again for an unchanged source", (ctx) => {
		requireWebGL(ctx);
		// the property the whole change rests on, at the subclass level
		const store = new WebGLTextureStore(gl);
		const source = { name: "s" };
		const upload = vi.fn((handle) => {
			return handle;
		});
		store.getResidentRecord(source, { upload });
		store.getResidentRecord(source, { upload });
		store.getResidentRecord(source, { upload });
		expect(upload).toHaveBeenCalledTimes(1);
		store.releaseAll(true);
	});

	it("adopts the handle the upload actually used", (ctx) => {
		requireWebGL(ctx);
		// immutable storage cannot be respecified, so a shape change makes
		// `createTexture2D` swap the texture object and return the new one —
		// tracking the old one would hand back a deleted handle forever
		const store = new WebGLTextureStore(gl);
		const source = { name: "s" };
		const swapped = gl.createTexture();
		const rec = store.getResidentRecord(source, {
			upload: () => {
				return swapped;
			},
		});
		expect(rec.handle).toBe(swapped);
		store.releaseAll(true);
	});

	it("rebuilds after a context loss rather than reusing a dead handle", (ctx) => {
		requireWebGL(ctx);
		const store = new WebGLTextureStore(gl);
		const source = { name: "s" };
		const before = store.getResidentRecord(source, {
			upload: (h) => {
				return h;
			},
		}).handle;

		// a LOST context: the GPU objects died with it, so nothing is freed
		const spy = vi.spyOn(gl, "deleteTexture");
		store.releaseAll();
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();

		const after = store.getResidentRecord(source, {
			upload: (h) => {
				return h;
			},
		}).handle;
		expect(after).not.toBe(before);
		store.releaseAll(true);
	});
});
