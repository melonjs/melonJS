import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	ImageLayer,
	TMXTileMap,
	video,
} from "../src/index.js";
import { applyTransparentColor, parse } from "../src/level/tiled/TMXUtils.js";
import { imgList } from "../src/loader/cache.js";

/**
 * Tiled's transparent color: an `<image>` may name one color (`trans` in
 * TMX, `transparentcolor` in JSON) that Tiled draws as transparent, the
 * color key of tilesets that have no alpha channel. Every pixel of exactly
 * that color is made transparent, once, on a copy of the image.
 */

// a 6x1 image: magenta, then magenta off by one in red, red, magenta again,
// then magenta off by one in green, then in blue
const COLORS = [
	"#ff00ff",
	"#fe00ff",
	"#ff0000",
	"#ff00ff",
	"#ff01ff",
	"#ff00fe",
];
const keyed = (name) => {
	const canvas = document.createElement("canvas");
	canvas.width = COLORS.length;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	COLORS.forEach((color, x) => {
		ctx.fillStyle = color;
		ctx.fillRect(x, 0, 1, 1);
	});
	if (name) {
		imgList[name] = canvas;
	}
	return canvas;
};

// magenta keyed out: exactly the two magenta pixels, no near one
const MAGENTA_OUT = [0, 255, 255, 0, 255, 255];
// red keyed out
const RED_OUT = [255, 255, 0, 255, 255, 255];

// the alpha of each pixel of an image's first row
const alphas = (image) => {
	const canvas = document.createElement("canvas");
	canvas.width = image.width;
	canvas.height = image.height;
	const ctx = canvas.getContext("2d");
	ctx.drawImage(image, 0, 0);
	const data = ctx.getImageData(0, 0, image.width, 1).data;
	const out = [];
	for (let i = 3; i < data.length; i += 4) {
		out.push(data[i]);
	}
	return out;
};

describe("Tiled transparent color", () => {
	describe("applyTransparentColor", () => {
		it("makes every pixel of exactly that color transparent, on a copy", () => {
			const image = keyed();
			const result = applyTransparentColor(image, "#ff00ff");
			expect(result).not.toBe(image);
			expect(alphas(result)).toEqual(MAGENTA_OUT);
			// the image itself is left as it was
			expect(alphas(image)).toEqual([255, 255, 255, 255, 255, 255]);
		});

		it.each([["ff00ff"], ["#FF00FF"], ["#80ff00ff"]])(
			"reads %s as magenta",
			(color) => {
				expect(alphas(applyTransparentColor(keyed(), color))).toEqual(
					MAGENTA_OUT,
				);
			},
		);

		it("is worked out once per image and color", () => {
			const image = keyed();
			const first = applyTransparentColor(image, "#ff00ff");
			expect(applyTransparentColor(image, "ff00ff")).toBe(first);
			const red = applyTransparentColor(image, "#ff0000");
			expect(red).not.toBe(first);
			expect(alphas(red)).toEqual(RED_OUT);
		});

		it.each([[undefined], [""], ["#ff00"], ["not a color"]])(
			"leaves the image as it is with %s",
			(color) => {
				const image = keyed();
				expect(applyTransparentColor(image, color)).toBe(image);
			},
		);

		it("draws an image it may not read as it is, and says so once", () => {
			// a cross-origin image without CORS taints the canvas it is drawn on
			const read = vi
				.spyOn(CanvasRenderingContext2D.prototype, "getImageData")
				.mockImplementation(() => {
					throw new DOMException("tainted", "SecurityError");
				});
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const first = keyed();
				const second = keyed();
				expect(applyTransparentColor(first, "#ff00ff")).toBe(first);
				expect(applyTransparentColor(second, "#ff00ff")).toBe(second);
				expect(warn).toHaveBeenCalledTimes(1);
			} finally {
				read.mockRestore();
				warn.mockRestore();
			}
		});

		it("draws an image it cannot draw on a canvas as it is", () => {
			// a compressed texture: the canvas refuses to draw it
			const compressed = { width: 4, height: 1, isCompressed: true };
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				expect(applyTransparentColor(compressed, "#ff00ff")).toBe(compressed);
			} finally {
				warn.mockRestore();
			}
		});
	});

	describe("read from a TMX file", () => {
		const xml = (source) => {
			return parse(
				new DOMParser().parseFromString(source, "text/xml").documentElement,
			);
		};

		it("keeps a tileset image's trans", () => {
			const map =
				xml(`<map version="1.10" orientation="orthogonal" width="1" height="1" tilewidth="2" tileheight="1">
				<tileset firstgid="1" name="t" tilewidth="2" tileheight="1" tilecount="2" columns="2">
					<image source="t.png" trans="ff00ff" width="4" height="1"/>
				</tileset>
			</map>`);
			expect(map.tilesets[0].transparentcolor).toBe("#ff00ff");
			expect(map.tilesets[0].image).toBe("t.png");
		});

		it("keeps a collection tile's trans", () => {
			const map =
				xml(`<map version="1.10" orientation="orthogonal" width="1" height="1" tilewidth="4" tileheight="1">
				<tileset firstgid="1" name="c" tilewidth="4" tileheight="1" tilecount="1" columns="0">
					<tile id="0"><image source="c.png" trans="00ff00" width="4" height="1"/></tile>
				</tileset>
			</map>`);
			expect(map.tilesets[0].tiles[0].transparentcolor).toBe("#00ff00");
		});

		it("keeps an image layer's trans", () => {
			const map =
				xml(`<map version="1.10" orientation="orthogonal" width="1" height="1" tilewidth="4" tileheight="1">
				<imagelayer id="1" name="sky"><image source="sky.png" trans="ff00ff" width="4" height="1"/></imagelayer>
			</map>`);
			expect(map.layers[0].transparentcolor).toBe("#ff00ff");
			expect(map.layers[0].image).toBe("sky.png");
		});

		it("adds none where the image has no trans", () => {
			const map =
				xml(`<map version="1.10" orientation="orthogonal" width="1" height="1" tilewidth="2" tileheight="1">
				<tileset firstgid="1" name="t" tilewidth="2" tileheight="1" tilecount="2" columns="2">
					<image source="t.png" width="4" height="1"/>
				</tileset>
			</map>`);
			expect(map.tilesets[0].transparentcolor).toBeUndefined();
		});
	});

	describe("applied to a map", () => {
		let app;

		beforeAll(async () => {
			await boot();
			// tilesets build their atlas through the game's renderer
			app = new Application(64, 64, {
				parent: "screen",
				scale: "auto",
				renderer: video.CANVAS,
			});
			await app.init();
			keyed("trans-sheet");
			keyed("trans-tile");
			keyed("trans-sky");
		});

		afterAll(() => {
			app?.destroy();
		});

		const mapOf = (tileset, layers = []) => {
			const map = new TMXTileMap(`trans-${Math.random()}`, {
				width: 1,
				height: 1,
				tilewidth: 2,
				tileheight: 1,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: tileset ? [tileset] : [],
				layers,
			});
			// reads the tilesets and builds the layers
			map.getLayers();
			return map;
		};

		it("draws a tileset with its color transparent", () => {
			const map = mapOf({
				firstgid: 1,
				name: "sheet",
				tilewidth: 2,
				tileheight: 1,
				tilecount: 2,
				columns: 2,
				spacing: 0,
				margin: 0,
				image: "trans-sheet.png",
				transparentcolor: "#ff00ff",
			});
			const tileset = map.tilesets.getTilesetByIndex(0);
			expect(tileset.image).not.toBe(imgList["trans-sheet"]);
			expect(alphas(tileset.image)).toEqual(MAGENTA_OUT);
			// the atlas the tiles are drawn from is the keyed image
			expect(tileset.texture.getTexture()).toBe(tileset.image);
		});

		it("leaves a tileset with no transparent color as it is", () => {
			const map = mapOf({
				firstgid: 1,
				name: "plain",
				tilewidth: 2,
				tileheight: 1,
				tilecount: 2,
				columns: 2,
				spacing: 0,
				margin: 0,
				image: "trans-sheet.png",
			});
			expect(map.tilesets.getTilesetByIndex(0).image).toBe(
				imgList["trans-sheet"],
			);
		});

		it("draws a collection tile with its color transparent", () => {
			const map = mapOf({
				firstgid: 1,
				name: "collection",
				tilewidth: 4,
				tileheight: 1,
				tilecount: 1,
				columns: 0,
				tiles: [
					{
						id: 0,
						image: "trans-tile.png",
						imagewidth: 4,
						imageheight: 1,
						transparentcolor: "#ff0000",
					},
				],
			});
			const image = map.tilesets.getTilesetByIndex(0).imageCollection.get(1);
			expect(alphas(image)).toEqual(RED_OUT);
		});

		it("draws an image layer with its color transparent", () => {
			const map = mapOf(null, [
				{
					type: "imagelayer",
					name: "sky",
					image: "trans-sky.png",
					transparentcolor: "#ff00ff",
					visible: true,
					opacity: 1,
				},
			]);
			const layer = map.getLayers().find((l) => {
				return l instanceof ImageLayer;
			});
			expect(alphas(layer.image)).toEqual(MAGENTA_OUT);
		});
	});
});
