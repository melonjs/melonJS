import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Entity,
	TextureAtlas,
	video,
} from "../src/index.js";
import { grabFrame } from "./helpers/pixels.js";

/**
 * A texture packer stores some frames turned a quarter, to pack them tighter,
 * and a sprite turns them back when it draws.
 *
 * It turned them about the top left of the WORLD rather than of the frame, so
 * a turned frame was right only for a sprite at (0, 0): the renderable of an
 * `Entity`, which is how the engine's own example drew its atlas for years.
 * A sprite of its own anywhere else drew its turned frames somewhere off the
 * screen: in the Texture Packer example, rewritten as a plain `Sprite`, the
 * walking character vanished on three frames of its eight.
 *
 * Checked by drawing: a frame stored turned has to give, pixel for pixel, the
 * picture the same art stored plainly gives, wherever the sprite is.
 */
const SIZE = 96;

describe.each([
	{ name: "WebGL", renderer: video.WEBGL },
	{ name: "Canvas", renderer: video.CANVAS },
])("a sprite drawing an atlas frame stored turned, on $name", (backend) => {
	let app;
	let renderer;
	let atlas;

	beforeAll(async () => {
		boot();
		app = new Application(SIZE, SIZE, {
			parent: "screen",
			renderer: backend.renderer,
			failIfMajorPerformanceCaveat: false,
			antiAlias: false,
			backgroundColor: "#000000",
		});
		await app.init();
		renderer = app.renderer;

		// the art: a 12 × 20 Γ, which looks different turned or mirrored
		const art = document.createElement("canvas");
		art.width = 12;
		art.height = 20;
		const a = art.getContext("2d");
		a.fillStyle = "#ff0000";
		a.fillRect(0, 0, 12, 6);
		a.fillStyle = "#00ff00";
		a.fillRect(0, 6, 4, 14);
		// one sheet: plain at (0, 0), turned a quarter clockwise at (20, 0)
		// (20 wide, 12 tall), and the same two again at (0, 30) and (20, 30)
		// for the frames trimmed out of a larger one
		const sheet = document.createElement("canvas");
		sheet.width = sheet.height = 64;
		const s = sheet.getContext("2d");
		const turned = (x, y) => {
			s.save();
			s.translate(x + 20, y);
			s.rotate(Math.PI / 2);
			s.drawImage(art, 0, 0);
			s.restore();
		};
		s.drawImage(art, 0, 0);
		turned(20, 0);
		s.drawImage(art, 0, 30);
		turned(20, 30);
		const frame = (filename, x, y, extra = {}) => {
			return {
				filename,
				frame: { x, y, w: 12, h: 20 },
				rotated: false,
				trimmed: false,
				spriteSourceSize: { x: 0, y: 0, w: 12, h: 20 },
				sourceSize: { w: 12, h: 20 },
				...extra,
			};
		};
		const trimmed = {
			trimmed: true,
			spriteSourceSize: { x: 5, y: 3, w: 12, h: 20 },
			sourceSize: { w: 20, h: 28 },
		};
		atlas = new TextureAtlas(
			{
				frames: [
					frame("plain", 0, 0),
					frame("turned", 20, 0, { rotated: true }),
					frame("plain-trimmed", 0, 30, trimmed),
					frame("turned-trimmed", 20, 30, { ...trimmed, rotated: true }),
				],
				meta: {
					app: "texturepacker",
					image: "turned-sheet.png",
					size: { w: 64, h: 64 },
					scale: "1",
				},
			},
			sheet,
		);
	});

	afterAll(() => {
		app.destroy();
	});

	/** one frame of the world holding only this renderable */
	const picture = async (renderable) => {
		app.world.addChild(renderable);
		// drawn without waiting for an update to find it in view
		renderable.inViewport = true;
		app.isDirty = true;
		app.draw();
		// read in the task that drew it, then taken out
		const frame = grabFrame(renderer);
		app.world.removeChildNow(renderable, true);
		return Array.from((await frame).data);
	};

	/** the picture of a named frame, as a sprite set up by `place` */
	const spritePicture = async (name, place) => {
		const sprite = atlas.createSpriteFromName(name);
		place(sprite);
		// not destroyed: the sprites share the sheet, which goes with the app
		return picture(sprite);
	};

	/** how many pixels are lit: a frame drawn off the screen leaves none */
	const lit = (data) => {
		let count = 0;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i] + data[i + 1] > 100) {
				count++;
			}
		}
		return count;
	};

	const placements = [
		{
			where: "at the origin",
			place: (sprite) => {
				sprite.anchorPoint.set(0, 0);
				sprite.pos.set(0, 0);
			},
		},
		{
			where: "away from the origin",
			place: (sprite) => {
				sprite.anchorPoint.set(0, 0);
				sprite.pos.set(40, 30);
			},
		},
		{
			where: "away from the origin, on its centre",
			place: (sprite) => {
				sprite.pos.set(50, 44);
			},
		},
		{
			where: "away from the origin, scaled and flipped",
			place: (sprite) => {
				sprite.pos.set(48, 48);
				sprite.scale(2);
				sprite.flipX(true);
			},
		},
		{
			where: "away from the origin, turned itself",
			place: (sprite) => {
				sprite.pos.set(48, 48);
				sprite.rotate(Math.PI / 6);
			},
		},
	];

	for (const { where, place } of placements) {
		it(`${where}: the picture of the same art stored plainly`, async () => {
			const plain = await spritePicture("plain", place);
			// the art is on the screen at all: 12 × 6 and 4 × 14 pixels of it
			expect(lit(plain)).toBeGreaterThan(100);
			expect(await spritePicture("turned", place)).toEqual(plain);
		});

		it(`${where}, trimmed: the picture of the same art stored plainly`, async () => {
			const plain = await spritePicture("plain-trimmed", place);
			expect(lit(plain)).toBeGreaterThan(100);
			expect(await spritePicture("turned-trimmed", place)).toEqual(plain);
		});
	}

	it("an animation of plain and turned frames stays where the sprite is", async () => {
		const sprite = atlas.createAnimationFromName(["plain", "turned"]);
		sprite.anchorPoint.set(0, 0);
		sprite.pos.set(40, 30);
		sprite.setAnimationFrame(0);
		const first = await picture(sprite);
		sprite.setAnimationFrame(1);
		const second = await picture(sprite);
		expect(lit(first)).toBeGreaterThan(100);
		expect(second).toEqual(first);
	});

	// a nine-slice sprite stretches the frame over its own size, corners
	// kept: turned, its width is laid out along the stored frame's height
	const nineSlices = [
		{
			what: "at the frame's own size, at the origin",
			settings: { width: 12, height: 20 },
			at: [0, 0],
		},
		{
			what: "stretched, at the origin",
			settings: { width: 40, height: 30 },
			at: [0, 0],
		},
		{
			what: "stretched, away from the origin",
			settings: { width: 40, height: 30 },
			at: [30, 40],
		},
		{
			what: "stretched, with corners of its own, away from the origin",
			settings: { width: 44, height: 36, insetx: 3, insety: 5 },
			at: [28, 32],
		},
	];
	for (const { what, settings, at } of nineSlices) {
		it(`a nine-slice sprite ${what}: the picture of the same art stored plainly`, async () => {
			const nineSlicePicture = (name) => {
				const sprite = atlas.createSpriteFromName(name, { ...settings }, true);
				sprite.anchorPoint.set(0, 0);
				sprite.pos.set(at[0], at[1]);
				return picture(sprite);
			};
			const plain = await nineSlicePicture("plain");
			expect(lit(plain)).toBeGreaterThan(100);
			expect(await nineSlicePicture("turned")).toEqual(plain);
		});
	}

	it("as the renderable of an Entity, where it was right: unchanged", async () => {
		const pictureIn = async (name) => {
			const entity = new Entity(30, 20, { width: 12, height: 20 });
			entity.renderable = atlas.createSpriteFromName(name);
			const data = await picture(entity);
			return data;
		};
		const plain = await pictureIn("plain");
		expect(lit(plain)).toBeGreaterThan(100);
		expect(await pictureIn("turned")).toEqual(plain);
	});
});
