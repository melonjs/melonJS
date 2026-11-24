import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, TextureAtlas, video } from "../src/index.js";
import { grabFrame } from "./helpers/pixels.js";

/**
 * Which parser reads an atlas, for every combination of the tool named in
 * `meta.app` and the layout of the file (issue #1915).
 *
 * A known name decides alone, as it always did. An unknown name, or none,
 * falls back to the structure: `meta.frameTags` is Aseprite's, frames with a
 * `frame` rectangle are TexturePacker's, as a list ("JSON (Array)") or keyed
 * by name ("JSON (Hash)").
 */

// two 16 × 16 frames side by side on a 32 × 16 sheet
const NAMES = ["a.png", "b.png"];

const entry = (index) => {
	return {
		frame: { x: index * 16, y: 0, w: 16, h: 16 },
		rotated: false,
		trimmed: false,
		spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 },
		sourceSize: { w: 16, h: 16 },
		duration: 100 + index * 50,
	};
};

const arrayFrames = () => {
	return NAMES.map((filename, index) => {
		return { filename, ...entry(index) };
	});
};

const hashFrames = () => {
	return Object.fromEntries(
		NAMES.map((filename, index) => {
			return [filename, entry(index)];
		}),
	);
};

const frameTags = () => {
	return [{ name: "blink", from: 0, to: 1, direction: "forward" }];
};

const layouts = [
	{ layout: "TexturePacker JSON (Array)", frames: arrayFrames, tags: false },
	{ layout: "TexturePacker JSON (Hash)", frames: hashFrames, tags: false },
	{ layout: "Aseprite JSON (Array)", frames: arrayFrames, tags: true },
	{ layout: "Aseprite JSON (Hash)", frames: hashFrames, tags: true },
];

// `parser` is what a known name selects; undefined leaves it to the structure
const apps = [
	{ app: "https://www.codeandweb.com/texturepacker", parser: "texturepacker" },
	{ app: "http://free-tex-packer.com", parser: "texturepacker" },
	{ app: "https://www.aseprite.org/", parser: "aseprite" },
	{
		app: "shoebox",
		parser: "texturepacker",
		format: "shoebox",
		meta: { exporter: "melonJS" },
	},
	{ app: "melonJS", parser: "texturepacker", format: "melonJS" },
	{ app: "https://spritesheet.dev/" },
	{ app: "https://example.com/my-packer" },
	{ app: "" },
	{ app: undefined },
];

const makeAtlas = (app, layout, image = "sheet.png") => {
	const meta = {
		version: "1.0",
		image,
		format: "RGBA8888",
		size: { w: 32, h: 16 },
		scale: "1",
		...app.meta,
	};
	if (app.app !== undefined) {
		meta.app = app.app;
	}
	if (layout.tags) {
		meta.frameTags = frameTags();
	}
	return { frames: layout.frames(), meta };
};

const fakeImage = { width: 32, height: 16, src: "sheet.png" };

describe.each(apps)("an atlas whose meta.app is $app", (app) => {
	describe.each(layouts)("in the $layout layout", (layout) => {
		// by name when the name is known, else by structure
		const parser = app.parser ?? (layout.tags ? "aseprite" : "texturepacker");
		// the Aseprite parser names the frames of a list by their position
		const names =
			parser === "aseprite" && Array.isArray(layout.frames())
				? ["0", "1"]
				: NAMES;

		const load = () => {
			return new TextureAtlas(makeAtlas(app, layout), fakeImage, false);
		};

		it(`is read as ${app.format ?? parser}`, () => {
			expect(load().format).toBe(app.format ?? parser);
		});

		it("holds every frame, at its rectangle", () => {
			const atlas = load();
			expect(Object.keys(atlas.getAnimationSettings().atlasIndices)).toEqual(
				names,
			);
			names.forEach((name, index) => {
				const region = atlas.getRegion(name);
				expect(region.name).toBe(name);
				expect(region.offset.x).toBe(index * 16);
				expect(region.offset.y).toBe(0);
				expect(region.width).toBe(16);
				expect(region.height).toBe(16);
				expect(region.angle).toBe(0);
				expect(region.trimmed).toBe(false);
				expect(Array.from(region.uvs)).toEqual([
					index / 2,
					0,
					(index + 1) / 2,
					1,
				]);
			});
		});

		// the Aseprite parser, on a file that has tags
		const tagged = parser === "aseprite" && layout.tags;

		it(
			tagged
				? "carries the tagged animations, with each frame's duration"
				: "carries no animation",
			() => {
				const anims = load().getAtlas().anims;
				if (tagged) {
					const blink = Object.values(anims)[0];
					expect(blink.name).toBe("blink");
					expect(blink.index).toEqual([
						{ name: 0, delay: 100 },
						{ name: 1, delay: 150 },
					]);
				} else {
					// none at all, or the Aseprite parser's empty list
					expect(Object.keys(anims ?? {})).toEqual([]);
				}
			},
		);
	});
});

describe("an Aseprite export without tags, from an unknown tool", () => {
	it.each([
		{ form: "Array", frames: arrayFrames },
		{ form: "Hash", frames: hashFrames },
	])("$form: is read through the TexturePacker parser", ({ frames }) => {
		const atlas = new TextureAtlas(
			makeAtlas({ app: "https://spritesheet.dev/" }, { frames, tags: false }),
			fakeImage,
			false,
		);
		expect(atlas.format).toBe("texturepacker");
		expect(atlas.getRegion("b.png").offset.x).toBe(16);
	});
});

describe("a multipack atlas from an unknown tool", () => {
	it("holds the frames of every page, whatever the layout of each", () => {
		const app = { app: "https://spritesheet.dev/" };
		const second = makeAtlas(app, layouts[1], "sheet-1.png");
		second.frames = { "c.png": entry(0), "d.png": entry(1) };
		const atlas = new TextureAtlas(
			[makeAtlas(app, layouts[0], "sheet-0.png"), second],
			fakeImage,
			false,
		);
		expect(atlas.getRegion("b.png").texture).toBe("sheet-0.png");
		expect(atlas.getRegion("d.png").texture).toBe("sheet-1.png");
		expect(atlas.getRegion("d.png").offset.x).toBe(16);
	});
});

describe("an atlas that is in no layout it reads", () => {
	const unknown = { app: "https://example.com/my-packer" };

	it.each([
		{
			what: "frames without a frame rectangle",
			change: (json) => {
				json.frames = [{ filename: "a.png", x: 0, y: 0, w: 16, h: 16 }];
			},
		},
		{
			what: "no frames",
			change: (json) => {
				delete json.frames;
			},
		},
		{
			what: "an empty list of frames",
			change: (json) => {
				json.frames = [];
			},
		},
		{
			what: "no sheet size",
			change: (json) => {
				delete json.meta.size;
			},
		},
		{
			what: "tags but no sheet size",
			change: (json) => {
				json.meta.frameTags = frameTags();
				delete json.meta.size;
			},
		},
	])("$what: throws, naming the tool", ({ change }) => {
		const json = makeAtlas(unknown, layouts[0]);
		change(json);
		expect(() => {
			return new TextureAtlas(json, fakeImage, false);
		}).toThrow("Unknown texture atlas format: " + unknown.app);
	});

	it("ShoeBox still requires the melonJS exporter", () => {
		expect(() => {
			return new TextureAtlas(
				makeAtlas({ app: "shoebox" }, layouts[0]),
				fakeImage,
				false,
			);
		}).toThrow(/ShoeBox requires the JSON exporter/);
	});
});

/**
 * Checked by drawing: a file from an unknown tool has to give, pixel for
 * pixel, the picture the same file gives under a name the engine knows.
 */
const SIZE = 32;

describe.each([
	{ name: "WebGL", renderer: video.WEBGL },
	{ name: "Canvas", renderer: video.CANVAS },
])("drawing a frame of an atlas from an unknown tool, on $name", (backend) => {
	let app;
	let sheet;

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

		// a.png is red, b.png is green over blue
		sheet = document.createElement("canvas");
		sheet.width = 32;
		sheet.height = 16;
		const s = sheet.getContext("2d");
		s.fillStyle = "#ff0000";
		s.fillRect(0, 0, 16, 16);
		s.fillStyle = "#00ff00";
		s.fillRect(16, 0, 16, 8);
		s.fillStyle = "#0000ff";
		s.fillRect(16, 8, 16, 8);
	});

	afterAll(() => {
		app.destroy();
	});

	/** the frame of this name (or position), drawn at (8, 8) */
	const picture = async (json, name) => {
		const atlas = new TextureAtlas(json, sheet, false);
		const sprite = atlas.createSpriteFromName(name);
		sprite.anchorPoint.set(0, 0);
		sprite.pos.set(8, 8);
		app.world.addChild(sprite);
		sprite.inViewport = true;
		app.isDirty = true;
		app.draw();
		const frame = grabFrame(app.renderer);
		app.world.removeChildNow(sprite, true);
		return (await frame).data;
	};

	const pixel = (data, x, y) => {
		const o = (y * SIZE + x) * 4;
		return Array.from(data.subarray(o, o + 3));
	};

	it.each([
		{ ...layouts[0], known: apps[0], name: "b.png" },
		{ ...layouts[1], known: apps[0], name: "b.png" },
		{ ...layouts[2], known: apps[2], name: "1" },
		{ ...layouts[3], known: apps[2], name: "b.png" },
	])("$layout: the picture a known tool's file gives", async (testCase) => {
		const data = await picture(
			makeAtlas({ app: "https://spritesheet.dev/" }, testCase),
			testCase.name,
		);
		// the second frame, the right way up, and nothing around it
		expect(pixel(data, 12, 10)).toEqual([0, 255, 0]);
		expect(pixel(data, 20, 20)).toEqual([0, 0, 255]);
		expect(pixel(data, 4, 12)).toEqual([0, 0, 0]);
		expect(pixel(data, 28, 12)).toEqual([0, 0, 0]);

		const reference = await picture(
			makeAtlas(testCase.known, testCase),
			testCase.name,
		);
		expect(Array.from(data)).toEqual(Array.from(reference));
	});
});
