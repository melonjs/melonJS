import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Entity,
	level,
	loader,
	Renderable,
	registerObjectClass,
	TMXTileMap,
	video,
} from "../src/index.js";

/**
 * The objects a level places, as a game deals with them whatever the editor:
 * which of them are built (`objects`, an option of `level.load`), and how
 * one is found once built (by the id the level gives it). The same two for
 * an LDtk level are in the LDtk tests; this is a Tiled map.
 */

/** an object as Tiled saves it */
const object = (id, name, type, x, extra = {}) => {
	return {
		id,
		name,
		type,
		x,
		y: 16,
		width: 16,
		height: 16,
		rotation: 0,
		visible: true,
		...extra,
	};
};

const objectLayer = (name, objects, extra = {}) => {
	return {
		type: "objectgroup",
		name,
		visible: true,
		opacity: 1,
		x: 0,
		y: 0,
		objects,
		...extra,
	};
};

/** a map of 10 x 4 tiles with a tile layer and the layers given */
const mapJSON = (layers) => {
	return {
		type: "map",
		version: "1.10",
		tiledversion: "1.12.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 10,
		height: 4,
		tilewidth: 16,
		tileheight: 16,
		nextobjectid: 40,
		tilesets: [],
		layers: [
			{
				id: 1,
				name: "ground",
				type: "tilelayer",
				visible: true,
				opacity: 1,
				x: 0,
				y: 0,
				width: 10,
				height: 4,
				data: new Array(40).fill(0),
			},
			...layers,
		],
	};
};

// a class of the game's that does nothing with the id it is given
class Gem extends Renderable {
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);
		this.name = settings.name;
	}
}

// one that has an id of its own
class Boss extends Renderable {
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);
		this.name = settings.name;
		this.id = "the boss";
	}
}

/** the objects of the map under test: three gems, a boss, a wall, a coin */
const things = () => {
	return [
		objectLayer("things", [
			object(11, "gem", "LevelGem", 0),
			object(12, "gem", "LevelGem", 16),
			object(13, "boss", "LevelBoss", 32),
			// no name, no class: a wall
			object(14, "", "", 48),
			object(15, "coin", "LevelCoin", 64, { properties: { points: 5 } }),
		]),
		objectLayer("more", [object(21, "gem", "LevelGem", 96)]),
	];
};

describe("the objects of a Tiled level", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		registerObjectClass("LevelGem", Gem);
		registerObjectClass("LevelBoss", Boss);
		registerObjectClass("LevelCoin", Entity);
		await loader.preload(
			[{ name: "objects-level", type: "tmx", data: mapJSON(things()) }],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		app.world.reset();
	});

	const load = (options = {}) => {
		return level.load("objects-level", {
			container: app.world,
			async: true,
			...options,
		});
	};

	/** the ids of what is in the world, the tile layer and containers aside */
	const idsInWorld = () => {
		return app.world
			.getChildByProp("isRenderable", true)
			.filter((child) => {
				return child.id !== undefined && !(child instanceof Container);
			})
			.map((child) => {
				return child.id;
			})
			.sort();
	};

	describe("the id the level gives an object", () => {
		it("is on the object, whatever class built it", async () => {
			await load();
			// a class of the game's that does not take it
			const [first] = app.world.getChildByProp("id", 11);
			expect(first).toBeInstanceOf(Gem);
			expect(first.pos.x).toBe(0);
			const [second] = app.world.getChildByProp("id", 12);
			expect(second).toBeInstanceOf(Gem);
			expect(second.pos.x).toBe(16);
			// a class of the engine's, which takes it itself
			const [coin] = app.world.getChildByProp("id", 15);
			expect(coin).toBeInstanceOf(Entity);
			// a shape with no class
			const [wall] = app.world.getChildByProp("id", 14);
			expect(wall).toBeDefined();
			expect(wall.pos.x).toBe(48);
			// one of another layer
			const [upstairs] = app.world.getChildByProp("id", 21);
			expect(upstairs).toBeInstanceOf(Gem);
			// and each is the only one with its id
			for (const id of [11, 12, 14, 15, 21]) {
				expect(app.world.getChildByProp("id", id), String(id)).toHaveLength(1);
			}
			expect(app.world.getChildByProp("id", 99)).toEqual([]);
		});

		it("leaves a class its own id", async () => {
			await load();
			const [boss] = app.world.getChildByName("boss");
			expect(boss).toBeInstanceOf(Boss);
			expect(boss.id).toBe("the boss");
			expect(app.world.getChildByProp("id", 13)).toEqual([]);
		});

		it("is given by the map itself, built with no level director", () => {
			const map = new TMXTileMap("direct", mapJSON(things()));
			const built = map.getObjects(true);
			expect(
				built
					.filter((child) => {
						return child instanceof Gem;
					})
					.map((gem) => {
						return gem.id;
					}),
			).toEqual([11, 12, 21]);
		});

		it("is not made up for an object the level gave none", () => {
			const map = new TMXTileMap(
				"no-ids",
				mapJSON([
					objectLayer("things", [
						{
							name: "gem",
							type: "LevelGem",
							x: 0,
							y: 0,
							width: 16,
							height: 16,
						},
					]),
				]),
			);
			const [gem] = map.getObjects(true);
			expect(gem).toBeInstanceOf(Gem);
			expect(gem.id).toBeUndefined();
			expect("id" in gem).toBe(false);
		});
	});

	describe("the objects option", () => {
		it("is one of the options a Tiled map reads", () => {
			expect(TMXTileMap.loadOptions).toContain("objects");
		});

		it("builds every object when left out, or true", async () => {
			await load();
			expect(idsInWorld()).toEqual([11, 12, 14, 15, 21, "the boss"]);
			app.world.reset();
			await load({ objects: true });
			expect(idsInWorld()).toEqual([11, 12, 14, 15, 21, "the boss"]);
		});

		it("builds none when false, and the tile layers all the same", async () => {
			await load({ objects: false });
			expect(idsInWorld()).toEqual([]);
			expect(app.world.getChildByName("gem")).toEqual([]);
			expect(app.world.getChildByName("ground")).toHaveLength(1);
			expect(level.getCurrentLevel().getLayers()).toHaveLength(1);
		});

		it("asks a function for each object, with the settings its class is given", async () => {
			const asked = [];
			await load({
				objects: (settings) => {
					asked.push(settings);
					return true;
				},
			});
			expect(
				asked.map((settings) => {
					return [settings.id, settings.name, settings.class ?? settings.type];
				}),
			).toEqual([
				[11, "gem", "LevelGem"],
				[12, "gem", "LevelGem"],
				[13, "boss", "LevelBoss"],
				[14, "", ""],
				[15, "coin", "LevelCoin"],
				[21, "gem", "LevelGem"],
			]);
			// what a class reads of an object: where it is, and its properties
			expect(asked[4]).toMatchObject({ x: 64, y: 16, width: 16, points: 5 });
			expect(idsInWorld()).toEqual([11, 12, 14, 15, 21, "the boss"]);
		});

		it("leaves out the ones the function refuses: what the player took", async () => {
			const taken = new Set([12, 15, 21]);
			await load({
				objects: (settings) => {
					return !taken.has(settings.id);
				},
			});
			expect(idsInWorld()).toEqual([11, 14, "the boss"]);
			expect(app.world.getChildByName("gem")).toHaveLength(1);
			expect(app.world.getChildByName("coin")).toEqual([]);
			// and the next time the level is loaded, with one more taken
			taken.add(11);
			app.world.reset();
			await load({
				objects: (settings) => {
					return !taken.has(settings.id);
				},
			});
			expect(idsInWorld()).toEqual([14, "the boss"]);
		});

		it("chooses by name as well: only the walls", async () => {
			await load({
				objects: (settings) => {
					return settings.name === "";
				},
			});
			expect(idsInWorld()).toEqual([14]);
		});

		it("holds with the objects kept in a container for each layer", async () => {
			await load({
				flatten: false,
				objects: (settings) => {
					return settings.name === "gem" && settings.id !== 12;
				},
			});
			const gems = app.world.getChildByName("gem");
			expect(
				gems
					.map((gem) => {
						return gem.id;
					})
					.sort(),
			).toEqual([11, 21]);
			expect(app.world.getChildByName("boss")).toEqual([]);
			// each in the container of its layer
			for (const gem of gems) {
				expect(gem.ancestor).not.toBe(app.world);
			}
		});

		it("chooses among objects only: a group layer's tile layers are added all the same", () => {
			// a group layer lists the tile layers inside it with its objects
			const grouped = () => {
				return new TMXTileMap(
					"grouped",
					mapJSON([
						{
							type: "group",
							name: "upstairs",
							visible: true,
							opacity: 1,
							layers: [
								{
									type: "tilelayer",
									name: "balcony",
									visible: true,
									opacity: 1,
									x: 0,
									y: 0,
									width: 10,
									height: 4,
									data: new Array(40).fill(0),
								},
							],
						},
						objectLayer("things", [object(11, "gem", "LevelGem", 0)]),
					]),
				);
			};
			const namesOf = (built) => {
				return built
					.map((child) => {
						return child.name;
					})
					.sort();
			};
			expect(namesOf(grouped().getObjects(true))).toEqual(["balcony", "gem"]);
			expect(namesOf(grouped().getObjects(true, false))).toEqual(["balcony"]);
			// and a function is asked about the objects, not about the layer
			const asked = [];
			const built = grouped().getObjects(true, (settings) => {
				asked.push(settings.name);
				return false;
			});
			expect(asked).toEqual(["gem"]);
			expect(namesOf(built)).toEqual(["balcony"]);
		});

		it("is read by the map itself, built with no level director", () => {
			const map = new TMXTileMap("direct", mapJSON(things()));
			expect(map.getObjects(true, false)).toEqual([]);
			expect(
				map
					.getObjects(true, (settings) => {
						return settings.id > 14;
					})
					.map((child) => {
						return child.id;
					}),
			).toEqual([15, 21]);
			const container = new Container(0, 0, 160, 64);
			map.addTo(container, true, false, (settings) => {
				return settings.name === "boss";
			});
			expect(container.getChildByName("boss")).toHaveLength(1);
			expect(container.getChildByName("gem")).toEqual([]);
			expect(container.getChildByName("ground")).toHaveLength(1);
		});
	});
});
