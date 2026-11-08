import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { boot, CanvasRenderer, loader, WebGPURenderer } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Unloading an image frees the texture the renderer uploaded from it.
 *
 * `loader.unload()` used to drop an image from the loader's cache and leave
 * its GPU texture behind: the renderer's texture store keys textures by the
 * image object, so the texture stayed resident (on WebGL until the next level
 * reset swept every texture, on WebGPU for good) with nothing left to free it.
 * Now every way an image leaves the loader — `unload(asset)`, a bundle unload
 * that frees it, `unloadAll()` — releases its texture too, and a bundle unload
 * leaves alone the texture of an image another bundle still holds.
 */

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const img = (name) => {
	return { name, type: "image", src: PNG };
};

describe("unloading an image frees its GPU texture", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		renderer = await getWebGLRenderer(64, 64);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		loader.unloadAll();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** draw an image once, so the renderer uploads it, and return its texture */
	const upload = (name) => {
		const image = loader.getImage(name);
		renderer.drawImage(image, 0, 0);
		renderer.flush();
		const record = renderer.textureStore.peek(image);
		expect(record).toBeDefined();
		expect(renderer.gl.isTexture(record.handle)).toBe(true);
		return { image, handle: record.handle };
	};

	const expectFreed = ({ image, handle }) => {
		expect(renderer.textureStore.peek(image)).toBeUndefined();
		expect(renderer.cache.has(image)).toBe(false);
		expect(renderer.gl.isTexture(handle)).toBe(false);
	};

	it("unload(asset) frees the image's texture", async (ctx) => {
		requireWebGL(ctx, renderer);
		await loader.load(img("tx-desc"));
		const uploaded = upload("tx-desc");
		const deleteTexture = vi.spyOn(renderer.gl, "deleteTexture");

		expect(loader.unload(img("tx-desc"))).toBe(true);
		// by identity: every WebGLTexture compares deeply equal
		expect(
			deleteTexture.mock.calls.some(([texture]) => {
				return texture === uploaded.handle;
			}),
		).toBe(true);
		expectFreed(uploaded);
		// and no batcher still believes it bound
		for (const batcher of renderer.batchers.values()) {
			expect(batcher.boundTextures ?? []).not.toContain(uploaded.handle);
		}

		// whoever kept a reference to the image can still draw it: it is
		// simply uploaded again, into a new texture
		renderer.drawImage(uploaded.image, 0, 0);
		renderer.flush();
		const record = renderer.textureStore.peek(uploaded.image);
		expect(record).toBeDefined();
		expect(record.handle).not.toBe(uploaded.handle);
		expect(renderer.gl.isTexture(record.handle)).toBe(true);
	});

	it("unloading a bundle frees the textures of the images it frees, not of one another bundle holds", async (ctx) => {
		requireWebGL(ctx, renderer);
		loader.setBundle("tx-1", [img("tx-own"), img("tx-shared")]);
		loader.setBundle("tx-2", [img("tx-shared")]);
		await loader.load("tx-1");
		await loader.load("tx-2");
		const own = upload("tx-own");
		const shared = upload("tx-shared");

		loader.unload("tx-1");
		expectFreed(own);
		expect(renderer.textureStore.peek(shared.image)).toBeDefined();
		expect(renderer.gl.isTexture(shared.handle)).toBe(true);

		loader.unload("tx-2");
		expectFreed(shared);
	});

	it("unloadAll frees the textures of every image", async (ctx) => {
		requireWebGL(ctx, renderer);
		await loader.preload([img("tx-all-1"), img("tx-all-2")], undefined, false);
		const first = upload("tx-all-1");
		const second = upload("tx-all-2");

		loader.unloadAll();
		expectFreed(first);
		expectFreed(second);
	});
});

/**
 * The same release on the other two renderers, through their own
 * `releaseImage`: WebGPU retires the texture through its store, Canvas drops
 * the tinted copies it made of the image. Driven on stand-ins for the renderer
 * state they touch, so neither needs a device or a canvas here.
 */
describe("releaseImage on the WebGPU and Canvas renderers", () => {
	const image = { width: 1, height: 1 };

	const standIn = () => {
		return {
			textureStore: { destroyTexture: vi.fn() },
			cache: { delete: vi.fn(), tinted: new Map([[image, new Map()]]) },
		};
	};

	it("WebGPU destroys the image's texture in its store and drops it from the cache", () => {
		const renderer = standIn();
		WebGPURenderer.prototype.releaseImage.call(renderer, image);
		expect(renderer.textureStore.destroyTexture).toHaveBeenCalledWith(image);
		expect(renderer.cache.delete).toHaveBeenCalledWith(image);
		expect(renderer.cache.tinted.has(image)).toBe(false);
	});

	it("Canvas drops the image from its cache and its tinted copies", () => {
		const renderer = standIn();
		CanvasRenderer.prototype.releaseImage.call(renderer, image);
		expect(renderer.cache.delete).toHaveBeenCalledWith(image);
		expect(renderer.cache.tinted.has(image)).toBe(false);
	});
});
