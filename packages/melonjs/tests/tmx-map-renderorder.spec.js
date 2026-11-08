import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, TMXTileMap, video } from "../src/index.js";
import * as TMXUtils from "../src/level/tiled/TMXUtils.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

/**
 * Tiled saves the render order on the map (`<map renderorder="left-up">`),
 * never on a layer. A tile layer used to read it from its own data only, so
 * every layer drew "right-down" whatever the map said. The order shows where
 * tiles overlap: tiles bigger than the map's grid, which reach up and right
 * of their cell.
 *
 * Here two 32 x 32 tiles, red then blue, sit side by side on a 16 x 16 grid:
 * they overlap on x 16 to 32. "right-down" draws the red one first, so blue
 * is on top there; "left-down" draws the blue one first, so red is on top.
 */

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

const tilesetImage = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 32;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "rgb(255,0,0)";
	ctx.fillRect(0, 0, 32, 32);
	ctx.fillStyle = "rgb(0,0,255)";
	ctx.fillRect(32, 0, 32, 32);
	imgList["renderorder-tiles"] = canvas;
	return "renderorder-tiles.png";
};

const jsonMap = (renderorder) => {
	return {
		width: 2,
		height: 1,
		tilewidth: 16,
		tileheight: 16,
		orientation: "orthogonal",
		renderorder,
		infinite: false,
		version: "1.10",
		tiledversion: "1.10.2",
		tilesets: [
			{
				firstgid: 1,
				name: "renderorder-tiles",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 2,
				columns: 2,
				image: tilesetImage(),
			},
		],
		// as Tiled saves it: no render order on the layer
		layers: [
			{
				type: "tilelayer",
				name: "ground",
				width: 2,
				height: 1,
				data: [1, 2],
				visible: true,
				opacity: 1,
			},
		],
	};
};

const tmxMap = (renderorder) => {
	tilesetImage();
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="${renderorder}" width="2" height="1" tilewidth="16" tileheight="16" infinite="0" nextlayerid="2" nextobjectid="1">
 <tileset firstgid="1" name="renderorder-tiles" tilewidth="32" tileheight="32" tilecount="2" columns="2">
  <image source="renderorder-tiles.png" width="64" height="32"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">1,2</data>
 </layer>
</map>`;
	const doc = new DOMParser().parseFromString(xml, "text/xml");
	return TMXUtils.parse(doc).map;
};

const FORMATS = { json: jsonMap, tmx: tmxMap };

// the colour on top where the two tiles overlap, the layer drawn tile by tile
const overlapColour = (layer) => {
	const renderer = new CanvasRenderer({
		width: 48,
		height: 16,
		transparent: true,
	});
	try {
		layer.getRenderer().drawTileLayer(renderer, layer, new Rect(0, 0, 48, 16));
		const [r, g, b] = renderer.getContext().getImageData(24, 8, 1, 1).data;
		return [r, g, b];
	} finally {
		renderer.destroy();
	}
};

describe("a tile layer takes the map's render order", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	describe.each(Object.keys(FORMATS))("%s", (format) => {
		const layerOf = (renderorder) => {
			const map = new TMXTileMap(
				`renderorder-${format}-${renderorder}`,
				FORMATS[format](renderorder),
			);
			return map.getLayers()[0];
		};

		it.each(["right-down", "right-up", "left-down", "left-up"])(
			"the layer of a %s map renders in that order",
			(renderorder) => {
				expect(layerOf(renderorder).renderorder).toEqual(renderorder);
			},
		);

		it("right-down draws the right tile last: it is on top where they overlap", () => {
			expect(overlapColour(layerOf("right-down"))).toEqual(BLUE);
		});

		it("left-down draws the left tile last: it is on top where they overlap", () => {
			expect(overlapColour(layerOf("left-down"))).toEqual(RED);
		});
	});

	it("a map without a render order still renders right-down", () => {
		const data = jsonMap("right-down");
		delete data.renderorder;
		const map = new TMXTileMap("renderorder-none", data);
		expect(map.renderorder).toEqual("right-down");
		expect(map.getLayers()[0].renderorder).toEqual("right-down");
	});

	it("a render order given on the layer itself still wins", () => {
		const data = jsonMap("right-down");
		data.layers[0].renderorder = "left-down";
		const map = new TMXTileMap("renderorder-layer", data);
		expect(map.getLayers()[0].renderorder).toEqual("left-down");
		expect(overlapColour(map.getLayers()[0])).toEqual(RED);
	});
});
