import { beforeAll, describe, expect, it } from "vitest";
import { boot, Sprite, Texture2d, TextureAtlas, video } from "../src/index.js";

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
		this._canvas = video.createCanvas(width, height);
	}
	getTexture() {
		return this._canvas;
	}
}

describe("Texture2d", () => {
	beforeAll(() => {
		boot();
		video.init(320, 240, { parent: "screen", renderer: video.CANVAS });
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
});
