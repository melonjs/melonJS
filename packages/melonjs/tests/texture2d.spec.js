import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Sprite,
	Texture2d,
	TextureAtlas,
	video,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";

/**
 * `Texture2d` is the abstract base for user-constructed texture assets: an
 * object that owns a drawable source and is recognized by the renderables via
 * `instanceof`, then resolved to its backing canvas/image through
 * `getTexture()`. `TextureAtlas` is a `Texture2d`; so is any future procedural
 * texture (e.g. `NoiseTexture2d`). This guards both the base contract and the
 * generic acceptance path in `Sprite` for a non-atlas `Texture2d`.
 */

// minimal concrete Texture2d: bakes a canvas once and exposes it.
class StubTexture extends Texture2d {
	constructor(width, height) {
		super();
		this._canvas = Renderer.createCanvas(width, height);
	}
	getTexture() {
		return this._canvas;
	}
}

describe("Texture2d", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	it("TextureAtlas extends Texture2d", () => {
		expect(TextureAtlas.prototype instanceof Texture2d).toBe(true);
	});

	it("a concrete subclass is an instanceof Texture2d and exposes getTexture()", () => {
		const tex = new StubTexture(48, 24);
		expect(tex instanceof Texture2d).toBe(true);
		expect(tex.getTexture().width).toBe(48);
		expect(tex.getTexture().height).toBe(24);
	});

	it("destroy() is a no-op by default (no resources owned)", () => {
		const tex = new StubTexture(8, 8);
		expect(typeof tex.destroy).toBe("function");
		expect(() => {
			tex.destroy();
		}).not.toThrow();
	});

	it("Sprite accepts a non-atlas Texture2d and resolves it to its baked canvas", () => {
		const tex = new StubTexture(48, 24);
		const sprite = new Sprite(0, 0, {
			image: tex,
			anchorPoint: { x: 0, y: 0 },
		});
		// the asset object resolves to the same canvas getTexture() returns
		expect(sprite.image).toBe(tex.getTexture());
		// and the sprite is sized from that source
		expect(sprite.width).toBe(48);
		expect(sprite.height).toBe(24);
	});

	describe("isAtlas discriminates atlases without importing TextureAtlas", () => {
		// `sprite.js` asks `image instanceof Texture2d && image.isAtlas`
		// rather than `instanceof TextureAtlas`, because importing `atlas.js`
		// there forms a module cycle its subclasses cannot load through. These
		// pin the three ways that could silently stop being equivalent.
		it("is false on a plain Texture2d and true on a TextureAtlas", () => {
			expect(new StubTexture(8, 8).isAtlas).toBe(false);
			const atlas = new TextureAtlas(
				{
					meta: { app: "texturepacker", size: { w: 32, h: 32 }, image: "d" },
					frames: [
						{
							filename: "r.png",
							frame: { x: 0, y: 0, w: 16, h: 16 },
							rotated: false,
							trimmed: false,
							spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
							sourceSize: { w: 16, h: 16 },
						},
					],
				},
				Renderer.createCanvas(32, 32),
				{ cache: false },
			);
			expect(atlas.isAtlas).toBe(true);
		});

		it("does not show up as an own key of the texture", () => {
			// a prototype getter, not an instance field: as a field it became
			// the first own enumerable key of every texture, which reaches
			// `Object.keys`, `JSON.stringify`, console output and anything
			// that iterates a texture's properties
			const plain = new StubTexture(8, 8);
			expect(plain.isAtlas).toBe(false);
			expect(Object.keys(plain)).not.toContain("isAtlas");
			expect(Object.hasOwn(plain, "isAtlas")).toBe(false);
			// and it cannot be written over, so the atlas branch in
			// `sprite.js` cannot be entered by a texture with no regions
			expect(() => {
				plain.isAtlas = true;
			}).toThrow();
		});

		it("a USER SUBCLASS of TextureAtlas still takes the atlas branch", () => {
			// the case `instanceof TextureAtlas` used to cover for free, and
			// the one a field-based check could lose: it would break if
			// `isAtlas` ever moved after an early return in the constructor,
			// or became an own property set outside the class body
			class MyAtlas extends TextureAtlas {}
			const sub = new MyAtlas(
				{
					meta: { app: "texturepacker", size: { w: 32, h: 32 }, image: "d" },
					frames: [
						{
							filename: "r.png",
							frame: { x: 0, y: 0, w: 16, h: 16 },
							rotated: false,
							trimmed: false,
							spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
							sourceSize: { w: 16, h: 16 },
						},
					],
				},
				Renderer.createCanvas(32, 32),
				{ cache: false },
			);
			expect(sub.isAtlas).toBe(true);

			const sprite = new Sprite(0, 0, { image: sub, region: "r.png" });
			// the atlas branch is what sets these; the generic Texture2d
			// fallback leaves `textureAtlas` unset and drops the region
			expect(sprite.textureAtlas).toBe(sub);
			expect(sprite.width).toEqual(16);
		});
	});
});
