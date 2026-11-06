import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, TMXTileMap, video } from "../src/index.js";
import TMXTileset from "../src/level/tiled/TMXTileset.js";
import TMXTilesetGroup from "../src/level/tiled/TMXTilesetGroup.js";
import * as TMXUtils from "../src/level/tiled/TMXUtils.js";
import { imgList, tmxList } from "../src/loader/cache.js";

/**
 * A tileset's last gid was worked out from its image as
 * `columns * Math.round(image.height / (tileheight + spacing))`, ignoring the
 * margin and rounding a partial row up: a tileset of 4 x 4 tiles with a 4px
 * margin (72px high) counted 5 rows, so its last gid ran 4 into the next
 * tileset, and `getTilesetByGid` gave this tileset for the next one's first
 * tiles — drawn from the wrong image, with the wrong properties.
 *
 * The count Tiled saves (`tilecount`, always present since Tiled 0.13) is
 * the one Tiled gave the gids by; without it the tiles are counted as Tiled
 * cuts them: whole tiles only, from the margin, a tile plus the spacing
 * apart. An image collection's gids run to its highest tile id.
 */

const fakeImage = (name, w, h) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	imgList[name] = canvas;
};

const tileset = (data) => {
	return new TMXTileset({
		firstgid: 1,
		name: data.image,
		tilewidth: 16,
		tileheight: 16,
		...data,
		image: `${data.image}.png`,
	});
};

describe("TMXTileset gid range", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		// 4 x 4 tiles of 16px with a 4px margin all around: 4 + 64 + 4
		fakeImage("margin4", 72, 72);
		// 3 x 2 tiles of 16px, 2px margin, 1px spacing: 2 + 3 * 16 + 2 + 2
		fakeImage("margin2spacing1", 54, 2 + 2 * 16 + 1 + 2);
		// 4 x 2.5 tiles: the half row at the bottom is no tile
		fakeImage("partialrow", 64, 40);
		// margin on the top and left only, as Tiled allows
		fakeImage("topleftmargin", 4 + 64, 4 + 64);
		fakeImage("next", 64, 64);
		fakeImage("collection-a", 16, 16);
		fakeImage("collection-b", 16, 32);
	});

	afterAll(() => {
		app?.destroy();
	});

	it.each([
		["with tilecount and columns", { tilecount: 16, columns: 4 }],
		["without tilecount", { columns: 4 }],
		["without tilecount or columns", {}],
	])("a margin does not add a row (%s)", (_, counts) => {
		const ts = tileset({ image: "margin4", margin: 4, ...counts });
		expect(ts.lastgid).toEqual(16);
		expect(ts.contains(16)).toEqual(true);
		expect(ts.contains(17)).toEqual(false);
	});

	it("counts tiles with a margin and spacing as Tiled cuts them", () => {
		const ts = tileset({ image: "margin2spacing1", margin: 2, spacing: 1 });
		expect(ts.lastgid).toEqual(6);
	});

	it("a partial row at the bottom of the image is no tile", () => {
		const ts = tileset({ image: "partialrow" });
		expect(ts.lastgid).toEqual(8);
	});

	it("a margin on the top and left only still counts every tile", () => {
		const ts = tileset({ image: "topleftmargin", margin: 4 });
		expect(ts.lastgid).toEqual(16);
	});

	it("the tilecount Tiled saved is the range, even when the image holds more", () => {
		// Tiled keeps the count of a tileset whose image later grew
		const ts = tileset({ image: "next", tilecount: 10, columns: 4 });
		expect(ts.lastgid).toEqual(10);
	});

	it("the next tileset's gids resolve to it, in a map", () => {
		const map = new TMXTileMap("margin-map", {
			width: 3,
			height: 1,
			tilewidth: 16,
			tileheight: 16,
			orientation: "orthogonal",
			renderorder: "right-down",
			infinite: false,
			version: "1.10",
			tiledversion: "1.10.2",
			tilesets: [
				{
					firstgid: 1,
					name: "margin",
					tilewidth: 16,
					tileheight: 16,
					margin: 4,
					spacing: 0,
					tilecount: 16,
					columns: 4,
					imagewidth: 72,
					imageheight: 72,
					image: "margin4.png",
				},
				{
					firstgid: 17,
					name: "next",
					tilewidth: 16,
					tileheight: 16,
					margin: 0,
					spacing: 0,
					tilecount: 16,
					columns: 4,
					image: "next.png",
				},
			],
			layers: [
				{
					type: "tilelayer",
					name: "ground",
					width: 3,
					height: 1,
					data: [16, 17, 20],
					visible: true,
					opacity: 1,
				},
			],
		});
		const layer = map.getLayers()[0];
		expect(layer.cellAt(0, 0).tileset.name).toEqual("margin");
		expect(layer.cellAt(1, 0).tileset.name).toEqual("next");
		expect(layer.cellAt(2, 0).tileset.name).toEqual("next");
		expect(map.tilesets.getTilesetByGid(17).name).toEqual("next");
	});

	it("an external TSX tileset with a margin keeps to its own gids", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.10.2" name="margin-tsx" tilewidth="16" tileheight="16" margin="4" tilecount="16" columns="4">
 <image source="margin4.png" width="72" height="72"/>
</tileset>`;
		const doc = new DOMParser().parseFromString(xml, "text/xml");
		// as the loader stores a parsed .tsx
		const parsed = TMXUtils.parse(doc);
		tmxList["margin-tsx"] = parsed.map || parsed.tilesets[0] || parsed;
		const group = new TMXTilesetGroup();
		group.add(new TMXTileset({ firstgid: 1, source: "margin-tsx.tsx" }));
		group.add(
			new TMXTileset({
				firstgid: 17,
				name: "next",
				tilewidth: 16,
				tileheight: 16,
				tilecount: 16,
				columns: 4,
				image: "next.png",
			}),
		);
		expect(group.getTilesetByIndex(0).lastgid).toEqual(16);
		expect(group.getTilesetByGid(16).name).toEqual("margin-tsx");
		expect(group.getTilesetByGid(17).name).toEqual("next");
	});

	it("an image collection's gids run to its highest tile id", () => {
		const collection = new TMXTileset({
			firstgid: 1,
			name: "collection",
			tilewidth: 16,
			tileheight: 32,
			tilecount: 3,
			columns: 0,
			tiles: [
				{ id: 0, image: "collection-a.png", imagewidth: 16, imageheight: 16 },
				{ id: 1, image: "collection-b.png", imagewidth: 16, imageheight: 32 },
				// tile 2 was removed in Tiled: ids skip it
				{ id: 3, image: "collection-a.png", imagewidth: 16, imageheight: 16 },
			],
		});
		expect(collection.isCollection).toEqual(true);
		expect(collection.lastgid).toEqual(4);
		expect(collection.contains(2)).toEqual(true);
		expect(collection.contains(4)).toEqual(true);
		expect(collection.contains(5)).toEqual(false);
		const group = new TMXTilesetGroup();
		group.add(collection);
		group.add(
			new TMXTileset({
				firstgid: 5,
				name: "next",
				tilewidth: 16,
				tileheight: 16,
				tilecount: 16,
				columns: 4,
				image: "next.png",
			}),
		);
		expect(group.getTilesetByGid(2).name).toEqual("collection");
		expect(group.getTilesetByGid(4).name).toEqual("collection");
		expect(group.getTilesetByGid(5).name).toEqual("next");
	});
});
