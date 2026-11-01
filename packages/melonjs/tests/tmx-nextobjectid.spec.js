/**
 * A Tiled map without `nextobjectid` (#1809).
 *
 * Tiled always writes `nextobjectid` on `<map>`, but the TMX format makes it
 * optional and hand-made or generated maps leave it out. `level.load()`
 * seeds the GUID counter with it, so with it missing the counter started at
 * 0, and objects added without an id took GUIDs equal to the map objects'
 * own (`<level>-<id>`). The builtin detector keys contacts by GUID, so two
 * different pairs shared a key and the second contact in a step was dropped:
 * in Alex 4, Alex fell through the boss.
 *
 * The map now seeds the counter past the highest object id it holds.
 */
import { describe, expect, it } from "vitest";
import { TMXTileMap, utils } from "../src/index.js";

/** a map's JSON with the given layers, and `nextobjectid` if given */
const mapJSON = (layers, nextobjectid) => {
	const data = {
		width: 10,
		height: 10,
		tilewidth: 32,
		tileheight: 32,
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.12.0",
		tilesets: [],
		layers,
	};
	if (nextobjectid !== undefined) {
		data.nextobjectid = nextobjectid;
	}
	return data;
};

/** an object layer holding objects with the given ids */
const objects = (...ids) => {
	return {
		type: "objectgroup",
		name: "objects",
		visible: true,
		opacity: 1,
		objects: ids.map((id) => {
			return { id, name: "", x: 0, y: 0, width: 16, height: 16 };
		}),
	};
};

describe("TMXTileMap#nextobjectid (#1809)", () => {
	it("is the map's own value when it has one", () => {
		const map = new TMXTileMap("with", mapJSON([objects(1, 2)], 20));
		expect(map.nextobjectid).toBe(20);
	});

	it("without one, is one past the highest object id in the map", () => {
		const map = new TMXTileMap("without", mapJSON([objects(3, 47, 7)]));
		expect(map.nextobjectid).toBe(48);
	});

	it("counts objects inside group layers, at any depth", () => {
		const layers = [
			objects(5),
			{
				type: "group",
				name: "boss room",
				layers: [
					objects(9),
					{ type: "group", name: "inner", layers: [objects(31)] },
				],
			},
		];
		const map = new TMXTileMap("groups", mapJSON(layers));
		expect(map.nextobjectid).toBe(32);
	});

	it("is 1 for a map with no objects", () => {
		const tiles = {
			type: "tilelayer",
			name: "ground",
			width: 1,
			height: 1,
			data: [0],
		};
		expect(new TMXTileMap("empty", mapJSON([tiles])).nextobjectid).toBe(1);
	});

	it("so GUIDs of objects added at runtime never meet those of the map's objects", () => {
		// the Alex 4 case: the boss and the player have no id of their own,
		// the cherries and stars in the map do
		const ids = [1, 2, 3, 45, 46, 47];
		const map = new TMXTileMap("level12", mapJSON([objects(...ids)]));
		// as level.load() does
		utils.resetGUID("level12", map.nextobjectid);
		const authored = ids.map((id) => {
			return utils.createGUID(id);
		});
		const spawned = Array.from({ length: 60 }, () => {
			return utils.createGUID();
		});
		const shared = spawned.filter((guid) => {
			return authored.includes(guid);
		});
		expect(shared).toEqual([]);
	});
});
